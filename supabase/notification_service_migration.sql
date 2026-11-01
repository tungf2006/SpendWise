-- SPENDWISE UC25 – MIGRATION THÔNG BÁO (chạy một lần trong Supabase SQL Editor)
-- Dựa trên supabase/init_schema.sql của github.com/tungf2006/SpendWise:
-- notifications, budgets, transactions, recurring_rules, categories đều đã tồn tại.
-- KHÔNG chạy lại init_schema.sql trên DB có dữ liệu.

-- Mã định danh sự kiện: ngăn tạo lặp thông báo trên nhiều tab/thiết bị.
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS event_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_notifications_user_event_key
    ON public.notifications (user_id, event_key);

CREATE INDEX IF NOT EXISTS ix_notifications_user_created_at
    ON public.notifications (user_id, created_at DESC);

-- Bỏ chính sách cũ FOR ALL (cho phép user tự INSERT, khác tài liệu yêu cầu).
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

-- Không có policy INSERT cho authenticated: chỉ SQL function SECURITY DEFINER
-- (hoặc service_role server tin cậy) tạo thông báo.
-- Chỉ cho frontend UPDATE cột is_read; không được sửa title/message/user_id/type.
REVOKE INSERT, UPDATE ON public.notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.notifications TO authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;

-- RPC lấy auth.uid() trên server; tuyệt đối không nhận user_id từ client.
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
  v_title text;
  v_message text;
  v_event_key text;
  v_rows integer;
  v_budgets_created integer := 0;
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

  -- 1. Tổng số tiền chi của từng Ngân sách, chỉ tính giao dịch expense đúng kỳ.
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
      v_title := 'Ngân sách đã đạt hoặc vượt hạn mức';
    ELSIF v_percent >= 80 THEN
      v_threshold := 80;
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
    -- Mỗi Ngân sách + tháng + ngưỡng 80/100 chỉ tạo 1 bản ghi.
    v_event_key := pg_catalog.format('budget:%s:%s:%s',
      v_budget.id, pg_catalog.to_char(v_month_begin, 'YYYY-MM'), v_threshold);

INSERT INTO public.notifications (user_id, title, message, type, event_key)
VALUES (v_user_id, v_title, v_message, 'budget_warning', v_event_key)
    ON CONFLICT (user_id, event_key) DO NOTHING;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_budgets_created := v_budgets_created + v_rows;
END LOOP;

  -- 2. Nhắc các khoản đang hoạt động, hạn từ hôm nay đến N ngày tới.
FOR v_rule IN
SELECT id, title, type, amount, next_due_date
FROM public.recurring_rules
WHERE user_id = v_user_id
  AND is_active = true
  AND next_due_date BETWEEN v_today AND (v_today + p_days_ahead)
    LOOP
    v_event_key := pg_catalog.format('recurring:%s:%s',
      v_rule.id, v_rule.next_due_date);
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
        'recurring_due', v_recurring_created
       );
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_finance_notifications(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_finance_notifications(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';