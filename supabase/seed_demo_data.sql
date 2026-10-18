-- ============================================================================
-- SPENDWISE DEMO SEED DATA (MÔI TRƯỜNG DEV / TEST CHO TEAM)
-- Hướng dẫn:
-- 1. Sau khi tạo user trên Supabase (VD: test@spendwise.vn), copy User UUID.
-- 2. Thay thế giá trị 'YOUR_USER_UUID_HERE' ở dòng DO block bên dưới bằng UUID của bạn.
-- 3. Chạy toàn bộ script này trong SQL Editor của Supabase.
-- ============================================================================

DO $$
DECLARE
    target_user_id UUID := 'YOUR_USER_UUID_HERE'; -- Thay bằng UUID thực tế của user test
    v_wallet_cash UUID;
    v_wallet_bank UUID;
    v_wallet_momo UUID;
    v_cat_food UUID;
    v_cat_transport UUID;
    v_cat_bill UUID;
    v_cat_shopping UUID;
    v_cat_salary UUID;
    v_cat_bonus UUID;
BEGIN
    -- Kiểm tra nếu chưa thay đổi UUID thì thông báo lỗi hướng dẫn
    IF target_user_id = 'YOUR_USER_UUID_HERE'::UUID OR target_user_id IS NULL THEN
        RAISE EXCEPTION 'Vui lòng thay đổi YOUR_USER_UUID_HERE thành UUID của user test trong bảng auth.users trước khi chạy!';
    END IF;

    -- 1. Đảm bảo bản ghi Profile tồn tại
    INSERT INTO public.profiles (id, full_name, avatar_url, default_bank_bin, default_bank_account)
    VALUES (
        target_user_id,
        'Người dùng Thử nghiệm (Demo)',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        '970436', -- Vietcombank
        '0123456789'
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        default_bank_bin = EXCLUDED.default_bank_bin,
        default_bank_account = EXCLUDED.default_bank_account;

    -- 2. Tạo 3 ví mẫu (Tiền mặt, Ngân hàng VCB, Ví MoMo)
    INSERT INTO public.wallets (user_id, name, type, balance, icon, color)
    VALUES (target_user_id, 'Tiền mặt', 'cash', 2500000, 'wallet', '#10B981')
    RETURNING id INTO v_wallet_cash;

    INSERT INTO public.wallets (user_id, name, type, balance, icon, color)
    VALUES (target_user_id, 'Vietcombank', 'bank', 18500000, 'credit-card', '#3B82F6')
    RETURNING id INTO v_wallet_bank;

    INSERT INTO public.wallets (user_id, name, type, balance, icon, color)
    VALUES (target_user_id, 'Ví MoMo', 'ewallet', 1200000, 'smartphone', '#EC4899')
    RETURNING id INTO v_wallet_momo;

    -- 3. Lấy ID các danh mục mặc định của hệ thống
    SELECT id INTO v_cat_food FROM public.categories WHERE name = 'Ăn uống' LIMIT 1;
    SELECT id INTO v_cat_transport FROM public.categories WHERE name = 'Di chuyển' LIMIT 1;
    SELECT id INTO v_cat_bill FROM public.categories WHERE name = 'Hóa đơn & Tiện ích' LIMIT 1;
    SELECT id INTO v_cat_shopping FROM public.categories WHERE name = 'Mua sắm' LIMIT 1;
    SELECT id INTO v_cat_salary FROM public.categories WHERE name = 'Lương' LIMIT 1;
    SELECT id INTO v_cat_bonus FROM public.categories WHERE name = 'Thưởng & Thu nhập phụ' LIMIT 1;

    -- 4. Tạo các giao dịch mẫu trong tháng hiện tại (Tháng 10/2026)
    -- Thu nhập
    INSERT INTO public.transactions (user_id, wallet_id, category_id, type, amount, transaction_date, note)
    VALUES 
    (target_user_id, v_wallet_bank, v_cat_salary, 'income', 25000000, '2026-10-05', 'Nhận lương tháng 10 chuyển khoản'),
    (target_user_id, v_wallet_momo, v_cat_bonus, 'income', 2000000, '2026-10-12', 'Thưởng dự án freelance hoàn thành');

    -- Chi tiêu
    INSERT INTO public.transactions (user_id, wallet_id, category_id, type, amount, transaction_date, note)
    VALUES 
    (target_user_id, v_wallet_cash, v_cat_food, 'expense', 45000, '2026-10-14', 'Ăn phở bò sáng'),
    (target_user_id, v_wallet_momo, v_cat_food, 'expense', 65000, '2026-10-15', 'Cafe Highlands cùng đồng nghiệp'),
    (target_user_id, v_wallet_bank, v_cat_bill, 'expense', 4500000, '2026-10-06', 'Thanh toán tiền thuê nhà và tiền điện'),
    (target_user_id, v_wallet_cash, v_cat_transport, 'expense', 100000, '2026-10-16', 'Đổ xăng xe máy Petrolimex'),
    (target_user_id, v_wallet_bank, v_cat_shopping, 'expense', 890000, '2026-10-11', 'Mua sắm đồ gia dụng siêu thị WinMart'),
    (target_user_id, v_wallet_momo, v_cat_food, 'expense', 120000, '2026-10-17', 'Ăn tối bún đậu mắm tôm');

    -- Chuyển tiền nội bộ (VCB -> MoMo 500k)
    INSERT INTO public.transactions (user_id, wallet_id, to_wallet_id, type, amount, transaction_date, note)
    VALUES 
    (target_user_id, v_wallet_bank, v_wallet_momo, 'transfer', 500000, '2026-10-10', 'Nạp tiền vào ví MoMo từ VCB');

    -- 5. Thiết lập Ngân sách tháng 10/2026 (Cho TV2 test thanh tiến độ)
    INSERT INTO public.budgets (user_id, category_id, month, year, amount_limit)
    VALUES 
    (target_user_id, v_cat_food, 10, 2026, 4000000),      -- Ăn uống: 4 triệu (đã chi 230k ~ 5.75% -> An toàn)
    (target_user_id, v_cat_bill, 10, 2026, 5000000),      -- Hóa đơn: 5 triệu (đã chi 4.5 triệu ~ 90% -> Cảnh báo)
    (target_user_id, v_cat_shopping, 10, 2026, 800000);   -- Mua sắm: 800k (đã chi 890k ~ 111.2% -> Đã vượt)

    -- 6. Mục tiêu tiết kiệm (Cho TV1 test GoalPage)
    INSERT INTO public.saving_goals (user_id, wallet_id, name, target_amount, current_amount, deadline, status)
    VALUES 
    (target_user_id, v_wallet_bank, 'Quỹ du lịch Đà Lạt cuối năm', 10000000, 4500000, '2026-12-30', 'in_progress'),
    (target_user_id, v_wallet_bank, 'Mua MacBook Pro M4', 45000000, 15000000, '2027-06-30', 'in_progress');

    -- 7. Giao dịch định kỳ lặp lại (Cho TV4 test Safe-to-spend và Định kỳ)
    INSERT INTO public.recurring_rules (user_id, wallet_id, category_id, title, type, amount, frequency, day_of_month, next_due_date, is_active)
    VALUES 
    (target_user_id, v_wallet_bank, v_cat_bill, 'Tiền mạng Internet FPT', 'expense', 260000, 'monthly', 25, '2026-10-25', true),
    (target_user_id, v_wallet_momo, v_cat_shopping, 'Gói Spotify Premium', 'expense', 59000, 'monthly', 28, '2026-10-28', true);

    -- 8. Thông báo mẫu (Cho TV4 test chuông thông báo)
    INSERT INTO public.notifications (user_id, title, message, type, is_read)
    VALUES 
    (target_user_id, 'Cảnh báo ngân sách', 'Ngân sách danh mục Mua sắm đã vượt hạn mức 111%!', 'budget_exceeded', false),
    (target_user_id, 'Sắp đến hạn hóa đơn', 'Khoản định kỳ Tiền mạng Internet (260.000đ) sẽ đến hạn vào ngày 25/10/2026.', 'recurring_due', false);

    RAISE NOTICE 'Nạp dữ liệu mẫu thành công cho User: %', target_user_id;
END $$;
