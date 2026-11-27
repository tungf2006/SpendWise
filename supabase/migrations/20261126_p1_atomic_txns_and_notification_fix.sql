-- ============================================================================
-- SPENDWISE – MIGRATION P1 (ATOMIC TRANSACTION RPCS & NOTIFICATION COUNT FIX)
-- Ngày: 26/11/2026
-- Nội dung:
--   1. Bổ sung 3 PostgreSQL RPC SECURITY DEFINER cho giao dịch (R3 #9):
--      - public.create_transaction_atomic(p_wallet_id, p_category_id, p_type, p_amount, p_note, p_transaction_date)
--      - public.update_transaction_atomic(p_transaction_id, p_wallet_id, p_category_id, p_type, p_amount, p_note, p_transaction_date)
--      - public.delete_transaction_atomic(p_transaction_id)
--   2. Sửa lỗi đếm trùng budget_exceeded vào budget_warning trong sync_finance_notifications (R3 #10)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RPC: TẠO GIAO DỊCH THU/CHI ATOMIC (UC12)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_transaction_atomic(
    p_wallet_id UUID,
    p_category_id UUID,
    p_type TEXT,
    p_amount NUMERIC,
    p_note TEXT DEFAULT '',
    p_transaction_date DATE DEFAULT NULL
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := (SELECT auth.uid());
    v_wallet RECORD;
    v_category RECORD;
    v_amount NUMERIC(15, 2);
    v_txn_date DATE := COALESCE(p_transaction_date, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date);
    v_note TEXT := COALESCE(p_note, '');
    v_txn public.transactions;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Người dùng chưa đăng nhập' USING ERRCODE = '28000';
    END IF;
    IF p_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Thiếu ví thanh toán';
    END IF;
    IF p_type = 'transfer' THEN
        RAISE EXCEPTION 'Giao dịch chuyển tiền phải sử dụng transfer_funds';
    END IF;
    IF p_type IS NULL OR p_type NOT IN ('income', 'expense') THEN
        RAISE EXCEPTION 'Loại giao dịch không hợp lệ';
    END IF;
    IF p_amount IS NULL OR NOT (p_amount > 0 AND p_amount <> 'NaN'::numeric) THEN
        RAISE EXCEPTION 'Số tiền giao dịch phải lớn hơn 0';
    END IF;

    v_amount := pg_catalog.round(p_amount, 2);
    IF v_amount IS NULL OR NOT (v_amount > 0 AND v_amount <> 'NaN'::numeric) THEN
        RAISE EXCEPTION 'Số tiền giao dịch phải lớn hơn 0';
    END IF;

    SELECT id, balance, is_archived
    INTO v_wallet
    FROM public.wallets
    WHERE id = p_wallet_id
      AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy ví thanh toán hợp lệ';
    END IF;
    IF v_wallet.is_archived THEN
        RAISE EXCEPTION 'Không thể tạo giao dịch trên ví đã lưu trữ';
    END IF;

    IF p_category_id IS NOT NULL THEN
        SELECT id, type
        INTO v_category
        FROM public.categories
        WHERE id = p_category_id
          AND (user_id IS NULL OR user_id = v_user_id);

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Không tìm thấy danh mục hợp lệ';
        END IF;
        IF v_category.type <> p_type THEN
            RAISE EXCEPTION 'Loại danh mục không khớp với loại giao dịch';
        END IF;
    END IF;

    INSERT INTO public.transactions (
        user_id,
        wallet_id,
        to_wallet_id,
        category_id,
        type,
        amount,
        transaction_date,
        note
    )
    VALUES (
        v_user_id,
        p_wallet_id,
        NULL,
        p_category_id,
        p_type,
        v_amount,
        v_txn_date,
        v_note
    )
    RETURNING * INTO v_txn;

    UPDATE public.wallets
    SET balance = CASE
        WHEN p_type = 'income' THEN balance + v_amount
        ELSE balance - v_amount
    END
    WHERE id = p_wallet_id
      AND user_id = v_user_id;

    RETURN v_txn;
END;
$$;

REVOKE ALL ON FUNCTION public.create_transaction_atomic(UUID, UUID, TEXT, NUMERIC, TEXT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_transaction_atomic(UUID, UUID, TEXT, NUMERIC, TEXT, DATE) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. RPC: CẬP NHẬT GIAO DỊCH ATOMIC (UC13)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_transaction_atomic(
    p_transaction_id UUID,
    p_wallet_id UUID,
    p_category_id UUID,
    p_type TEXT,
    p_amount NUMERIC,
    p_note TEXT DEFAULT NULL,
    p_transaction_date DATE DEFAULT NULL
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := (SELECT auth.uid());
    v_old public.transactions;
    v_wallet RECORD;
    v_category RECORD;
    v_new_wallet_id UUID;
    v_new_to_wallet_id UUID;
    v_new_category_id UUID;
    v_new_type TEXT;
    v_new_amount NUMERIC(15, 2);
    v_new_date DATE;
    v_new_note TEXT;
    v_txn public.transactions;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Người dùng chưa đăng nhập' USING ERRCODE = '28000';
    END IF;
    IF p_transaction_id IS NULL THEN
        RAISE EXCEPTION 'Thiếu ID giao dịch cần cập nhật';
    END IF;

    -- 1. Khóa dòng giao dịch cần sửa trước (thứ tự khóa cố định: transactions -> wallets ASC)
    SELECT *
    INTO v_old
    FROM public.transactions
    WHERE id = p_transaction_id
      AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy giao dịch cần cập nhật';
    END IF;

    IF p_amount IS NOT NULL AND NOT (p_amount > 0 AND p_amount <> 'NaN'::numeric) THEN
        RAISE EXCEPTION 'Số tiền giao dịch phải lớn hơn 0';
    END IF;

    v_new_wallet_id := COALESCE(p_wallet_id, v_old.wallet_id);
    v_new_type := COALESCE(p_type, v_old.type);
    v_new_amount := pg_catalog.round(COALESCE(p_amount, v_old.amount), 2);
    v_new_date := COALESCE(p_transaction_date, v_old.transaction_date);
    v_new_note := COALESCE(p_note, v_old.note);

    IF v_new_amount IS NULL OR NOT (v_new_amount > 0 AND v_new_amount <> 'NaN'::numeric) THEN
        RAISE EXCEPTION 'Số tiền giao dịch phải lớn hơn 0';
    END IF;
    IF v_new_type NOT IN ('income', 'expense', 'transfer') THEN
        RAISE EXCEPTION 'Loại giao dịch không hợp lệ';
    END IF;
    IF v_new_type = 'transfer' AND v_old.type <> 'transfer' THEN
        RAISE EXCEPTION 'Không thể đổi giao dịch thu/chi sang chuyển tiền vì thiếu ví đích';
    END IF;

    IF v_new_type = 'transfer' THEN
        IF v_old.to_wallet_id IS NULL THEN
            RAISE EXCEPTION 'Thiếu ví đích cho giao dịch chuyển tiền';
        END IF;
        IF v_new_wallet_id = v_old.to_wallet_id THEN
            RAISE EXCEPTION 'Ví nguồn và ví đích không được trùng nhau';
        END IF;
        v_new_to_wallet_id := v_old.to_wallet_id;
        v_new_category_id := NULL;
    ELSE
        v_new_to_wallet_id := NULL;
        v_new_category_id := p_category_id;
    END IF;

    IF v_new_category_id IS NOT NULL THEN
        SELECT id, type
        INTO v_category
        FROM public.categories
        WHERE id = v_new_category_id
          AND (user_id IS NULL OR user_id = v_user_id);

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Không tìm thấy danh mục hợp lệ';
        END IF;
        IF v_category.type <> v_new_type THEN
            RAISE EXCEPTION 'Loại danh mục không khớp với loại giao dịch';
        END IF;
    END IF;

    -- 2. Khóa tất cả ví liên quan theo thứ tự UUID tăng dần để tránh deadlock
    PERFORM 1
    FROM public.wallets
    WHERE user_id = v_user_id
      AND (
          id = v_old.wallet_id
          OR id = v_new_wallet_id
          OR (v_old.to_wallet_id IS NOT NULL AND id = v_old.to_wallet_id)
      )
    ORDER BY id
    FOR UPDATE;

    SELECT id, is_archived
    INTO v_wallet
    FROM public.wallets
    WHERE id = v_new_wallet_id
      AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy ví thanh toán hợp lệ';
    END IF;
    IF v_new_wallet_id <> v_old.wallet_id AND v_wallet.is_archived THEN
        RAISE EXCEPTION 'Không thể chuyển giao dịch sang ví đã lưu trữ';
    END IF;

    -- 3. Hoàn tác số dư của giao dịch cũ
    IF v_old.type = 'income' THEN
        UPDATE public.wallets
        SET balance = balance - v_old.amount
        WHERE id = v_old.wallet_id
          AND user_id = v_user_id;
    ELSIF v_old.type = 'expense' THEN
        UPDATE public.wallets
        SET balance = balance + v_old.amount
        WHERE id = v_old.wallet_id
          AND user_id = v_user_id;
    ELSIF v_old.type = 'transfer' THEN
        UPDATE public.wallets
        SET balance = balance + v_old.amount
        WHERE id = v_old.wallet_id
          AND user_id = v_user_id;

        IF v_old.to_wallet_id IS NOT NULL THEN
            UPDATE public.wallets
            SET balance = balance - v_old.amount
            WHERE id = v_old.to_wallet_id
              AND user_id = v_user_id;
        END IF;
    END IF;

    -- 4. Áp dụng số dư của giao dịch mới
    IF v_new_type = 'income' THEN
        UPDATE public.wallets
        SET balance = balance + v_new_amount
        WHERE id = v_new_wallet_id
          AND user_id = v_user_id;
    ELSIF v_new_type = 'expense' THEN
        UPDATE public.wallets
        SET balance = balance - v_new_amount
        WHERE id = v_new_wallet_id
          AND user_id = v_user_id;
    ELSIF v_new_type = 'transfer' THEN
        UPDATE public.wallets
        SET balance = balance - v_new_amount
        WHERE id = v_new_wallet_id
          AND user_id = v_user_id;

        UPDATE public.wallets
        SET balance = balance + v_new_amount
        WHERE id = v_new_to_wallet_id
          AND user_id = v_user_id;
    END IF;

    -- 5. Cập nhật bản ghi giao dịch (trigger trg_transactions_unaccent tự đồng bộ note_unaccent)
    UPDATE public.transactions
    SET wallet_id = v_new_wallet_id,
        to_wallet_id = v_new_to_wallet_id,
        category_id = v_new_category_id,
        type = v_new_type,
        amount = v_new_amount,
        transaction_date = v_new_date,
        note = v_new_note
    WHERE id = p_transaction_id
      AND user_id = v_user_id
    RETURNING * INTO v_txn;

    RETURN v_txn;
END;
$$;

REVOKE ALL ON FUNCTION public.update_transaction_atomic(UUID, UUID, UUID, TEXT, NUMERIC, TEXT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_transaction_atomic(UUID, UUID, UUID, TEXT, NUMERIC, TEXT, DATE) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. RPC: XÓA GIAO DỊCH ATOMIC (UC13)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_transaction_atomic(
    p_transaction_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := (SELECT auth.uid());
    v_txn public.transactions;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Người dùng chưa đăng nhập' USING ERRCODE = '28000';
    END IF;
    IF p_transaction_id IS NULL THEN
        RAISE EXCEPTION 'Thiếu ID giao dịch cần xóa';
    END IF;

    SELECT *
    INTO v_txn
    FROM public.transactions
    WHERE id = p_transaction_id
      AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy giao dịch cần xóa';
    END IF;

    PERFORM 1
    FROM public.wallets
    WHERE user_id = v_user_id
      AND (
          id = v_txn.wallet_id
          OR (v_txn.to_wallet_id IS NOT NULL AND id = v_txn.to_wallet_id)
      )
    ORDER BY id
    FOR UPDATE;

    IF v_txn.type = 'income' THEN
        UPDATE public.wallets
        SET balance = balance - v_txn.amount
        WHERE id = v_txn.wallet_id
          AND user_id = v_user_id;
    ELSIF v_txn.type = 'expense' THEN
        UPDATE public.wallets
        SET balance = balance + v_txn.amount
        WHERE id = v_txn.wallet_id
          AND user_id = v_user_id;
    ELSIF v_txn.type = 'transfer' THEN
        UPDATE public.wallets
        SET balance = balance + v_txn.amount
        WHERE id = v_txn.wallet_id
          AND user_id = v_user_id;

        IF v_txn.to_wallet_id IS NOT NULL THEN
            UPDATE public.wallets
            SET balance = balance - v_txn.amount
            WHERE id = v_txn.to_wallet_id
              AND user_id = v_user_id;
        END IF;
    END IF;

    DELETE FROM public.transactions
    WHERE id = p_transaction_id
      AND user_id = v_user_id;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_transaction_atomic(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_transaction_atomic(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. RPC: ĐỒNG BỘ THÔNG BÁO NGÂN SÁCH & ĐỊNH KỲ (Sửa lỗi đếm warning vs exceeded)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_finance_notifications(p_days_ahead integer DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_user_id uuid := (SELECT auth.uid());
    v_today date := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
    v_month_begin date;
    v_next_month date;
    v_budget record;
    v_rule record;
    v_percent numeric;
    v_threshold integer;
    v_noti_type text;
    v_title text;
    v_message text;
    v_event_key text;
    v_rows integer;
    v_budgets_created integer := 0;
    v_exceeded_created integer := 0;
    v_recurring_created integer := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Người dùng chưa đăng nhập' USING ERRCODE = '28000';
    END IF;
    IF p_days_ahead IS NULL OR p_days_ahead < 0 OR p_days_ahead > 30 THEN
        RAISE EXCEPTION 'p_days_ahead phải trong khoảng 0..30';
    END IF;

    v_month_begin := pg_catalog.date_trunc('month', v_today::timestamp)::date;
    v_next_month := (v_month_begin + interval '1 month')::date;

    FOR v_budget IN
        SELECT b.id, b.amount_limit, c.name AS category_name,
               COALESCE(SUM(t.amount), 0) AS spent_amount
        FROM public.budgets AS b
        JOIN public.categories AS c ON c.id = b.category_id
        LEFT JOIN public.transactions AS t
            ON t.user_id = b.user_id
           AND t.category_id = b.category_id
           AND t.type = 'expense'
           AND t.transaction_date >= v_month_begin
           AND t.transaction_date < v_next_month
        WHERE b.user_id = v_user_id
          AND b.month = EXTRACT(MONTH FROM v_today)::integer
          AND b.year = EXTRACT(YEAR FROM v_today)::integer
        GROUP BY b.id, b.amount_limit, c.name
    LOOP
        IF v_budget.amount_limit <= 0 THEN
            CONTINUE;
        END IF;

        v_percent := (v_budget.spent_amount * 100) / v_budget.amount_limit;

        IF v_percent >= 100 THEN
            v_threshold := 100;
            v_noti_type := 'budget_exceeded';
            v_title := 'Ngân sách đã đạt hoặc vượt hạn mức';
        ELSIF v_percent >= 80 THEN
            v_threshold := 80;
            v_noti_type := 'budget_warning';
            v_title := 'Ngân sách sắp vượt hạn mức';
        ELSE
            CONTINUE;
        END IF;

        v_message := pg_catalog.format(
            'Danh mục %s đã chi %s/%s VND (%s%%).',
            v_budget.category_name,
            pg_catalog.to_char(v_budget.spent_amount, 'FM999,999,999,999,990.00'),
            pg_catalog.to_char(v_budget.amount_limit, 'FM999,999,999,999,990.00'),
            pg_catalog.round(v_percent, 1)
        );
        v_event_key := pg_catalog.format(
            'budget:%s:%s:%s',
            v_budget.id,
            pg_catalog.to_char(v_month_begin, 'YYYY-MM'),
            v_threshold
        );

        INSERT INTO public.notifications (user_id, title, message, type, event_key)
        VALUES (v_user_id, v_title, v_message, v_noti_type, v_event_key)
        ON CONFLICT (user_id, event_key) DO NOTHING;

        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_noti_type = 'budget_exceeded' THEN
            v_exceeded_created := v_exceeded_created + v_rows;
        ELSIF v_noti_type = 'budget_warning' THEN
            v_budgets_created := v_budgets_created + v_rows;
        END IF;
    END LOOP;

    FOR v_rule IN
        SELECT id, title, type, amount, next_due_date
        FROM public.recurring_rules
        WHERE user_id = v_user_id
          AND is_active = true
          AND next_due_date BETWEEN v_today AND (v_today + p_days_ahead)
    LOOP
        v_event_key := pg_catalog.format('recurring:%s:%s', v_rule.id, v_rule.next_due_date);
        v_title := 'Sắp đến hạn giao dịch định kỳ';
        v_message := pg_catalog.format(
            '%s (%s VND, %s) đến hạn ngày %s.',
            v_rule.title,
            pg_catalog.to_char(v_rule.amount, 'FM999,999,999,999,990.00'),
            CASE WHEN v_rule.type = 'expense' THEN 'Khoản chi' ELSE 'Khoản thu' END,
            pg_catalog.to_char(v_rule.next_due_date, 'DD/MM/YYYY')
        );
        INSERT INTO public.notifications (user_id, title, message, type, event_key)
        VALUES (v_user_id, v_title, v_message, 'recurring_due', v_event_key)
        ON CONFLICT (user_id, event_key) DO NOTHING;

        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_recurring_created := v_recurring_created + v_rows;
    END LOOP;

    RETURN pg_catalog.jsonb_build_object(
        'budget_warning', v_budgets_created,
        'budget_exceeded', v_exceeded_created,
        'recurring_due', v_recurring_created
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_finance_notifications(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_finance_notifications(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
