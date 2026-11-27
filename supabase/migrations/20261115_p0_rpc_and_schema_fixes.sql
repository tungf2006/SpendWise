-- ============================================================================
-- SPENDWISE – MIGRATION P0 (LEADER PHAN THANH TÙNG)
-- Ngày: 15/11/2026
-- Nội dung:
--   1. Chuẩn hóa trigger sync_transaction_note_unaccent() & handle_new_user() + backfill
--   2. Chuẩn hóa recurring_rules (ON DELETE RESTRICT cho category_id, hỗ trợ 'daily')
--   3. Đồng bộ notifications.event_key & RLS an toàn
--   4. Bổ sung 4 PostgreSQL RPC SECURITY DEFINER:
--      - generate_due_recurring_transactions()
--      - deposit_to_goal(p_goal_id, p_wallet_id, p_amount)
--      - transfer_funds(p_from_wallet_id, p_to_wallet_id, p_amount, p_note, p_date)
--      - sync_finance_notifications(p_days_ahead)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CHUẨN HÓA TRIGGER KHÔNG DẤU (an toàn khi gọi từ SECURITY DEFINER)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_transaction_note_unaccent()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    NEW.note_unaccent := pg_catalog.lower(public.unaccent(COALESCE(NEW.note, '')));
    RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. CHUẨN HÓA BẢNG NOTIFICATIONS (event_key, index, RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS event_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_notifications_user_event_key
    ON public.notifications (user_id, event_key);

CREATE INDEX IF NOT EXISTS ix_notifications_user_created_at
    ON public.notifications (user_id, created_at DESC);

DROP POLICY IF EXISTS "Users manage own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Notifications: read own" ON public.notifications;
DROP POLICY IF EXISTS "Notifications: update own" ON public.notifications;
DROP POLICY IF EXISTS "Notifications: delete own" ON public.notifications;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notifications: read own"
    ON public.notifications FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Notifications: update own"
    ON public.notifications FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Notifications: delete own"
    ON public.notifications FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()));

REVOKE INSERT, UPDATE ON public.notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.notifications TO authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. CHUẨN HÓA TRIGGER HANDLE_NEW_USER & BACKFILL USER CŨ
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_full_name TEXT;
BEGIN
    v_full_name := COALESCE(
        NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(pg_catalog.split_part(COALESCE(NEW.email, ''), '@', 1), ''),
        'Người dùng mới'
    );

    -- 1. Tự động tạo Profile tương ứng với auth.users (chống lỗi trùng khóa)
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        v_full_name,
        NULLIF(NEW.raw_user_meta_data->>'avatar_url', '')
    )
    ON CONFLICT (id) DO NOTHING;

    -- 2. Tạo Ví 'Tiền mặt' mặc định nếu user chưa có ví nào
    IF NOT EXISTS (SELECT 1 FROM public.wallets WHERE user_id = NEW.id) THEN
        INSERT INTO public.wallets (user_id, name, type, balance, icon, color)
        VALUES (NEW.id, 'Tiền mặt', 'cash', 0, 'wallet', '#10B981');
    END IF;

    -- 3. Tạo thông báo chào mừng (idempotent qua event_key)
    INSERT INTO public.notifications (user_id, title, message, type, event_key)
    VALUES (
        NEW.id,
        'Chào mừng đến với SpendWise!',
        'Hãy bắt đầu ghi chép các khoản chi tiêu đầu tiên để kiểm soát tài chính thông minh.',
        'system',
        'system:welcome'
    )
    ON CONFLICT (user_id, event_key) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill Profile cho các tài khoản đã tồn tại trong auth.users nhưng thiếu dòng profiles
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT
    u.id,
    COALESCE(
        NULLIF(pg_catalog.btrim(u.raw_user_meta_data->>'full_name'), ''),
        NULLIF(pg_catalog.split_part(COALESCE(u.email, ''), '@', 1), ''),
        'Người dùng SpendWise'
    ),
    NULLIF(u.raw_user_meta_data->>'avatar_url', '')
FROM auth.users AS u
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. CHUẨN HÓA RÀNG BUỘC BẢNG RECURRING_RULES
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_conname TEXT;
BEGIN
    -- Đổi khóa ngoại category_id sang ON DELETE RESTRICT theo đặc tả UC11
    FOR v_conname IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
        WHERE n.nspname = 'public'
          AND t.relname = 'recurring_rules'
          AND c.contype = 'f'
          AND a.attname = 'category_id'
    LOOP
        EXECUTE format('ALTER TABLE public.recurring_rules DROP CONSTRAINT %I', v_conname);
    END LOOP;

    ALTER TABLE public.recurring_rules
        ADD CONSTRAINT recurring_rules_category_id_fkey
        FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT;

    -- Mở rộng CHECK(frequency) hỗ trợ đầy đủ daily/weekly/monthly/yearly
    FOR v_conname IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'recurring_rules'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%frequency%'
    LOOP
        EXECUTE format('ALTER TABLE public.recurring_rules DROP CONSTRAINT %I', v_conname);
    END LOOP;

    ALTER TABLE public.recurring_rules
        ADD CONSTRAINT recurring_rules_frequency_check
        CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly'));
END
$$;

-- ----------------------------------------------------------------------------
-- 5. RPC: TỰ ĐỘNG SINH GIAO DỊCH ĐỊNH KỲ ĐẾN HẠN (UC24)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_due_recurring_transactions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := (SELECT auth.uid());
    v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
    v_rule RECORD;
    v_due_date DATE;
    v_next_month_start DATE;
    v_max_day INTEGER;
    v_target_day INTEGER;
    v_generated_count INTEGER := 0;
    v_rule_iterations INTEGER;
    v_max_iterations CONSTANT INTEGER := 60;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Người dùng chưa đăng nhập' USING ERRCODE = '28000';
    END IF;

    FOR v_rule IN
        SELECT *
        FROM public.recurring_rules
        WHERE user_id = v_user_id
          AND is_active = TRUE
          AND next_due_date <= v_today
        ORDER BY next_due_date ASC
        FOR UPDATE
    LOOP
        -- Khóa dòng ví tương ứng để đảm bảo cập nhật số dư an toàn
        PERFORM 1
        FROM public.wallets
        WHERE id = v_rule.wallet_id
          AND user_id = v_user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            CONTINUE;
        END IF;

        v_due_date := v_rule.next_due_date;
        v_rule_iterations := 0;

        WHILE v_due_date <= v_today AND v_rule_iterations < v_max_iterations LOOP
            v_rule_iterations := v_rule_iterations + 1;

            -- Tạo bản ghi giao dịch tự động cho kỳ đến hạn
            INSERT INTO public.transactions (
                user_id,
                wallet_id,
                category_id,
                type,
                amount,
                transaction_date,
                note
            )
            VALUES (
                v_user_id,
                v_rule.wallet_id,
                v_rule.category_id,
                v_rule.type,
                v_rule.amount,
                v_due_date,
                pg_catalog.format('Định kỳ: %s', v_rule.title)
            );

            -- Cộng hoặc trừ số dư ví tương ứng
            UPDATE public.wallets
            SET balance = CASE
                WHEN v_rule.type = 'income' THEN balance + v_rule.amount
                ELSE balance - v_rule.amount
            END
            WHERE id = v_rule.wallet_id
              AND user_id = v_user_id;

            v_generated_count := v_generated_count + 1;

            -- Tính ngày đến hạn kế tiếp theo chu kỳ
            IF v_rule.frequency = 'daily' THEN
                v_due_date := v_due_date + 1;
            ELSIF v_rule.frequency = 'weekly' THEN
                v_due_date := v_due_date + 7;
            ELSIF v_rule.frequency = 'monthly' THEN
                v_target_day := COALESCE(v_rule.day_of_month, EXTRACT(DAY FROM v_due_date)::integer);
                v_next_month_start := (pg_catalog.date_trunc('month', v_due_date::timestamp) + interval '1 month')::date;
                v_max_day := EXTRACT(DAY FROM (v_next_month_start + interval '1 month' - interval '1 day'))::integer;
                v_due_date := v_next_month_start + (LEAST(GREATEST(v_target_day, 1), v_max_day) - 1);
            ELSE
                v_due_date := (v_due_date + interval '1 year')::date;
            END IF;
        END LOOP;

        UPDATE public.recurring_rules
        SET next_due_date = v_due_date
        WHERE id = v_rule.id
          AND user_id = v_user_id;
    END LOOP;

    RETURN v_generated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_due_recurring_transactions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_due_recurring_transactions() TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. RPC: NẠP TIỀN VÀO MỤC TIÊU TIẾT KIỆM ATOMIC (UC23)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deposit_to_goal(
    p_goal_id UUID,
    p_wallet_id UUID,
    p_amount NUMERIC
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := (SELECT auth.uid());
    v_wallet RECORD;
    v_goal RECORD;
    v_remaining NUMERIC(15, 2);
    v_new_wallet_balance NUMERIC(15, 2);
    v_new_goal_amount NUMERIC(15, 2);
    v_new_status TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Người dùng chưa đăng nhập' USING ERRCODE = '28000';
    END IF;
    IF p_goal_id IS NULL OR p_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Thiếu thông tin mục tiêu hoặc ví nguồn';
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Số tiền nạp phải lớn hơn 0';
    END IF;

    SELECT id, balance, is_archived
    INTO v_wallet
    FROM public.wallets
    WHERE id = p_wallet_id
      AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy ví nguồn hợp lệ';
    END IF;
    IF v_wallet.is_archived THEN
        RAISE EXCEPTION 'Không thể trích tiền từ ví đã lưu trữ';
    END IF;
    IF v_wallet.balance < p_amount THEN
        RAISE EXCEPTION 'Số dư ví không đủ để nạp vào mục tiêu tiết kiệm';
    END IF;

    SELECT id, name, target_amount, current_amount, status
    INTO v_goal
    FROM public.saving_goals
    WHERE id = p_goal_id
      AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy mục tiêu tiết kiệm';
    END IF;
    IF v_goal.status = 'completed' THEN
        RAISE EXCEPTION 'Mục tiêu tiết kiệm này đã hoàn thành';
    END IF;

    v_remaining := GREATEST(0, v_goal.target_amount - v_goal.current_amount);
    IF p_amount > v_remaining THEN
        RAISE EXCEPTION 'Số tiền nạp vượt quá phần còn thiếu của mục tiêu';
    END IF;

    v_new_wallet_balance := v_wallet.balance - p_amount;
    v_new_goal_amount := v_goal.current_amount + p_amount;
    v_new_status := CASE
        WHEN v_new_goal_amount >= v_goal.target_amount THEN 'completed'
        ELSE 'in_progress'
    END;

    UPDATE public.wallets
    SET balance = v_new_wallet_balance
    WHERE id = p_wallet_id
      AND user_id = v_user_id;

    UPDATE public.saving_goals
    SET current_amount = v_new_goal_amount,
        status = v_new_status
    WHERE id = p_goal_id
      AND user_id = v_user_id;

    RETURN pg_catalog.jsonb_build_object(
        'goal_id', p_goal_id,
        'wallet_id', p_wallet_id,
        'amount', p_amount,
        'walletBalance', v_new_wallet_balance,
        'currentAmount', v_new_goal_amount,
        'status', v_new_status,
        'isCompleted', (v_new_status = 'completed')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.deposit_to_goal(UUID, UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deposit_to_goal(UUID, UUID, NUMERIC) TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. RPC: CHUYỂN TIỀN NỘI BỘ GIỮA 2 VÍ ATOMIC (UC09)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_funds(
    p_from_wallet_id UUID,
    p_to_wallet_id UUID,
    p_amount NUMERIC,
    p_note TEXT DEFAULT '',
    p_date DATE DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := (SELECT auth.uid());
    v_from_wallet RECORD;
    v_to_wallet RECORD;
    v_txn_date DATE := COALESCE(p_date, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date);
    v_note TEXT;
    v_new_from_balance NUMERIC(15, 2);
    v_new_to_balance NUMERIC(15, 2);
    v_txn_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Người dùng chưa đăng nhập' USING ERRCODE = '28000';
    END IF;
    IF p_from_wallet_id IS NULL OR p_to_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Thiếu ví nguồn hoặc ví đích';
    END IF;
    IF p_from_wallet_id = p_to_wallet_id THEN
        RAISE EXCEPTION 'Ví nguồn và ví đích không được trùng nhau';
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Số tiền chuyển phải lớn hơn 0';
    END IF;

    -- Khóa 2 ví theo thứ tự UUID tăng dần để phòng tránh deadlock
    PERFORM 1
    FROM public.wallets
    WHERE user_id = v_user_id
      AND id IN (p_from_wallet_id, p_to_wallet_id)
    ORDER BY id
    FOR UPDATE;

    SELECT id, name, balance, is_archived
    INTO v_from_wallet
    FROM public.wallets
    WHERE id = p_from_wallet_id
      AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy ví nguồn hợp lệ';
    END IF;
    IF v_from_wallet.is_archived THEN
        RAISE EXCEPTION 'Không thể chuyển tiền từ ví đã lưu trữ';
    END IF;

    SELECT id, name, balance, is_archived
    INTO v_to_wallet
    FROM public.wallets
    WHERE id = p_to_wallet_id
      AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy ví đích hợp lệ';
    END IF;
    IF v_to_wallet.is_archived THEN
        RAISE EXCEPTION 'Không thể chuyển tiền vào ví đã lưu trữ';
    END IF;

    IF v_from_wallet.balance < p_amount THEN
        RAISE EXCEPTION 'Số dư ví nguồn không đủ để thực hiện chuyển tiền';
    END IF;

    v_new_from_balance := v_from_wallet.balance - p_amount;
    v_new_to_balance := v_to_wallet.balance + p_amount;
    v_note := COALESCE(
        NULLIF(pg_catalog.btrim(p_note), ''),
        pg_catalog.format('Chuyển từ %s sang %s', v_from_wallet.name, v_to_wallet.name)
    );

    UPDATE public.wallets
    SET balance = v_new_from_balance
    WHERE id = p_from_wallet_id
      AND user_id = v_user_id;

    UPDATE public.wallets
    SET balance = v_new_to_balance
    WHERE id = p_to_wallet_id
      AND user_id = v_user_id;

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
        p_from_wallet_id,
        p_to_wallet_id,
        NULL,
        'transfer',
        p_amount,
        v_txn_date,
        v_note
    )
    RETURNING id INTO v_txn_id;

    RETURN pg_catalog.jsonb_build_object(
        'transactionId', v_txn_id,
        'fromWalletBalance', v_new_from_balance,
        'toWalletBalance', v_new_to_balance,
        'amount', p_amount,
        'transactionDate', v_txn_date,
        'note', v_note
    );
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_funds(UUID, UUID, NUMERIC, TEXT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_funds(UUID, UUID, NUMERIC, TEXT, DATE) TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. RPC: ĐỒNG BỘ THÔNG BÁO NGÂN SÁCH & ĐỊNH KỲ (UC25 - Phân biệt warning vs exceeded)
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
