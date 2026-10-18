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
RETURNS TRIGGER AS $$
BEGIN
    NEW.note_unaccent := LOWER(unaccent(COALESCE(NEW.note, '')));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
    day_of_month INT CHECK (day_of_month BETWEEN 1 AND 31), -- [FIX] Ngày lặp lại trong tháng (chỉ dùng khi frequency = 'monthly')
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
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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
CREATE POLICY "Users manage own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);

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
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Tự động tạo bản ghi Profile tương ứng với auth.users
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Người dùng mới'),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
    );

    -- 2. Tự động tạo Ví 'Tiền mặt' mặc định cho người dùng
    INSERT INTO public.wallets (user_id, name, type, balance, icon, color)
    VALUES (
        NEW.id,
        'Tiền mặt',
        'cash',
        0,
        'wallet',
        '#10B981'
    );

    -- 3. Tạo thông báo chào mừng ban đầu
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
        NEW.id,
        'Chào mừng đến với SpendWise!',
        'Hãy bắt đầu ghi chép các khoản chi tiêu đầu tiên để kiểm soát tài chính thông minh.',
        'system'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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