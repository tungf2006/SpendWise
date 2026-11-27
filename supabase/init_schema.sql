-- ============================================================================
-- SPENDWISE DATABASE SCHEMA (SUPABASE POSTGRESQL)
-- Chạy trực tiếp file này trong mục SQL Editor của Supabase
-- ============================================================================

-- Kích hoạt extension hỗ trợ UUID và tìm kiếm không dấu
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ----------------------------------------------------------------------------
-- 1. BẢNG PROFILES (Mở rộng từ bảng auth.users của Supabase)
-- ----------------------------------------------------------------------------
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    default_bank_bin TEXT,       -- Mã BIN ngân hàng (VD: 970436 cho VCB) phục vụ VietQR
    default_bank_account TEXT,   -- Số tài khoản mặc định phục vụ VietQR
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. BẢNG WALLETS (Ví / Nguồn tiền)
-- ----------------------------------------------------------------------------
CREATE TABLE public.wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'ewallet')),
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    icon TEXT DEFAULT 'wallet',
    color TEXT DEFAULT '#3B82F6',
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. BẢNG CATEGORIES (Danh mục thu/chi mặc định và tự tạo)
-- ----------------------------------------------------------------------------
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL = Danh mục mặc định hệ thống
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    keywords TEXT[] DEFAULT '{}', -- Từ khóa phục vụ QuickEntryParser (Chức năng 8)
    icon TEXT DEFAULT 'tag',
    color TEXT DEFAULT '#10B981',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. BẢNG TRANSACTIONS (Giao dịch thu/chi & chuyển tiền nội bộ)
-- ----------------------------------------------------------------------------
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
    to_wallet_id UUID REFERENCES public.wallets(id) ON DELETE RESTRICT, -- Chỉ dùng khi type = 'transfer'
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    note TEXT DEFAULT '',
    note_unaccent TEXT DEFAULT '', -- Tự động lưu bản không dấu để tìm kiếm nhanh
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger tự động tạo note_unaccent khi thêm/sửa giao dịch
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

CREATE TRIGGER trg_transactions_unaccent
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_transaction_note_unaccent();

-- ----------------------------------------------------------------------------
-- 5. BẢNG BUDGETS (Ngân sách tháng theo danh mục)
-- ----------------------------------------------------------------------------
CREATE TABLE public.budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INT NOT NULL CHECK (year >= 2020),
    amount_limit NUMERIC(15, 2) NOT NULL CHECK (amount_limit > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, category_id, month, year)
);

-- ----------------------------------------------------------------------------
-- 6. BẢNG SAVING_GOALS (Mục tiêu tiết kiệm)
-- ----------------------------------------------------------------------------
CREATE TABLE public.saving_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL, -- [FIX] Ví dùng để nạp tiền vào mục tiêu
    name TEXT NOT NULL,
    target_amount NUMERIC(15, 2) NOT NULL CHECK (target_amount > 0),
    current_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
    deadline DATE,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. BẢNG RECURRING_RULES (Quy tắc giao dịch định kỳ)
-- ----------------------------------------------------------------------------
CREATE TABLE public.recurring_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    day_of_month INT CHECK (day_of_month BETWEEN 1 AND 31), -- Ngày lặp lại trong tháng (chỉ dùng khi frequency = 'monthly')
    next_due_date DATE NOT NULL,                             -- Tính lại mỗi lần rule được kích hoạt
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 8. BẢNG NOTIFICATIONS (Thông báo trong ứng dụng)
-- ----------------------------------------------------------------------------
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('budget_warning', 'budget_exceeded', 'recurring_due', 'system')),
    event_key TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_notifications_user_event_key
    ON public.notifications (user_id, event_key);

CREATE INDEX ix_notifications_user_created_at
    ON public.notifications (user_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - CÔ LẬP DỮ LIỆU NGƯỜI DÙNG
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saving_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies cho phép người dùng toàn quyền trên dữ liệu có user_id = auth.uid()
CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users manage own wallets" ON public.wallets FOR ALL USING (auth.uid() = user_id);
-- [FIX] Tách thành 3 policy riêng để tránh conflict giữa SELECT (cần xem danh mục hệ thống) và ghi (chỉ được sửa danh mục của mình)
CREATE POLICY "Categories: view default and own" ON public.categories FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "Categories: insert own" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Categories: update own" ON public.categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Categories: delete own" ON public.categories FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users manage own transactions" ON public.transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own budgets" ON public.budgets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own saving_goals" ON public.saving_goals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own recurring_rules" ON public.recurring_rules FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Notifications: read own" ON public.notifications FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Notifications: update own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Notifications: delete own" ON public.notifications FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

REVOKE INSERT, UPDATE ON public.notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.notifications TO authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;

-- ============================================================================
-- DỮ LIỆU MẪU: DANH MỤC MẶC ĐỊNH HỆ THỐNG (Kèm từ khóa cho Nhập nhanh)
-- ============================================================================
INSERT INTO public.categories (user_id, name, type, keywords, icon, color) VALUES
(NULL, 'Ăn uống', 'expense', ARRAY['an', 'uong', 'com', 'pho', 'bun', 'cafe', 'ca phe', 'tra sua', 'nhau', 'bua sang', 'bua trua', 'bua toi', 'highlands', 'kfc'], 'utensils', '#EF4444'),
(NULL, 'Di chuyển', 'expense', ARRAY['xang', 'grab', 'be', 'taxi', 'xe buyt', 'gui xe', 've xe', 'sua xe', 'di lai'], 'car', '#F59E0B'),
(NULL, 'Hóa đơn & Tiện ích', 'expense', ARRAY['tien nha', 'tien tro', 'dien', 'nuoc', 'internet', 'wifi', '4g', '5g', 'rac'], 'file-invoice', '#3B82F6'),
(NULL, 'Mua sắm', 'expense', ARRAY['shopee', 'lazada', 'tiktok', 'quan ao', 'giay dep', 'my pham', 'sieu thi', 'bach hoa xanh', 'winmart'], 'shopping-bag', '#8B5CF6'),
(NULL, 'Giải trí & Học tập', 'expense', ARRAY['xem phim', 'cgv', 'netflix', 'spotify', 'sach', 'khoa hoc', 'hoc phi', 'game', 'du lich'], 'film', '#EC4899'),
(NULL, 'Y tế & Sức khỏe', 'expense', ARRAY['thuoc', 'kham benh', 'benh vien', 'nha khoa', 'gym', 'the thao'], 'heartbeat', '#14B8A6'),
(NULL, 'Lương', 'income', ARRAY['luong', 'ứng lương', 'salary'], 'money-bill-wave', '#10B981'),
(NULL, 'Thưởng & Thu nhập phụ', 'income', ARRAY['thuong', 'freelance', 'ban do', 'lai tiet kiem', 'li xi', 'hoc bong'], 'gift', '#059669');

-- ============================================================================
-- 9. TRIGGER TỰ ĐỘNG KHỞI TẠO PROFILE VÀ VÍ TIỀN MẶT KHI USER ĐĂNG KÝ
-- ============================================================================
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

    -- 1. Tự động tạo bản ghi Profile tương ứng với auth.users
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        v_full_name,
        NULLIF(NEW.raw_user_meta_data->>'avatar_url', '')
    )
    ON CONFLICT (id) DO NOTHING;

    -- 2. Tự động tạo Ví 'Tiền mặt' mặc định nếu người dùng chưa có ví
    IF NOT EXISTS (SELECT 1 FROM public.wallets WHERE user_id = NEW.id) THEN
        INSERT INTO public.wallets (user_id, name, type, balance, icon, color)
        VALUES (
            NEW.id,
            'Tiền mặt',
            'cash',
            0,
            'wallet',
            '#10B981'
        );
    END IF;

    -- 3. Tạo thông báo chào mừng ban đầu (idempotent qua event_key)
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

-- Kích hoạt Trigger sau khi user đăng ký trong Supabase Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 10. VIEWS THỐNG KÊ (HỖ TRỢ DASHBOARD VÀ BÁO CÁO)
-- ============================================================================
-- View tổng hợp thu chi theo tháng cho từng người dùng
CREATE OR REPLACE VIEW public.v_monthly_summary WITH (security_invoker = true) AS
SELECT 
    user_id,
    TO_CHAR(transaction_date, 'YYYY-MM') AS month_key,
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense,
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) - 
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS net_savings
FROM public.transactions
WHERE type IN ('income', 'expense')
GROUP BY user_id, TO_CHAR(transaction_date, 'YYYY-MM');

-- View tiến độ ngân sách tháng theo danh mục
CREATE OR REPLACE VIEW public.v_budget_progress WITH (security_invoker = true) AS
SELECT 
    b.id AS budget_id,
    b.user_id,
    b.month,
    b.year,
    b.category_id,
    c.name AS category_name,
    c.color AS category_color,
    c.icon AS category_icon,
    b.amount_limit AS budget_amount,
    COALESCE(SUM(t.amount), 0) AS spent_amount,
    b.amount_limit - COALESCE(SUM(t.amount), 0) AS remaining_amount,
    CASE 
        WHEN b.amount_limit > 0 THEN ROUND((COALESCE(SUM(t.amount), 0) / b.amount_limit) * 100, 1)
        ELSE 0 
    END AS spent_percentage
FROM public.budgets b
JOIN public.categories c ON b.category_id = c.id
LEFT JOIN public.transactions t ON 
    t.category_id = b.category_id 
    AND t.user_id = b.user_id 
    AND t.type = 'expense'
    AND EXTRACT(MONTH FROM t.transaction_date) = b.month
    AND EXTRACT(YEAR FROM t.transaction_date) = b.year
GROUP BY b.id, b.user_id, b.month, b.year, b.category_id, c.name, c.color, c.icon, b.amount_limit;


-- ============================================================================
-- 11. CÁC HÀM RPC ATOMIC (SECURITY DEFINER) CHO RECURRING, GOAL, TRANSFER & NOTIFICATIONS
-- ============================================================================

-- 11.1. Tự động sinh giao dịch định kỳ đến hạn (UC24)
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

            UPDATE public.wallets
            SET balance = CASE
                WHEN v_rule.type = 'income' THEN balance + v_rule.amount
                ELSE balance - v_rule.amount
            END
            WHERE id = v_rule.wallet_id
              AND user_id = v_user_id;

            v_generated_count := v_generated_count + 1;

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

-- 11.2. Nạp tiền vào mục tiêu tiết kiệm atomic (UC23)
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

-- 11.3. Chuyển tiền nội bộ giữa 2 ví atomic (UC09)
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

-- 11.4. Đồng bộ thông báo cảnh báo ngân sách & định kỳ (UC25)
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

-- 11.5. Tạo giao dịch thu/chi atomic (UC12)
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

-- 11.6. Cập nhật giao dịch atomic (UC13)
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

-- 11.7. Xóa giao dịch atomic (UC13)
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

NOTIFY pgrst, 'reload schema';
