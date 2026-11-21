import { supabase } from '@/lib/supabaseClient'

// An RPC is required for atomic writes to transactions + wallets + recurring_rules.
// When it is absent, only inspect pending rules: NEVER debit money in multiple
// non-transactional client requests (race conditions, partial failures, duplicates).
export function isMissingRpc(error, functionName) {
  const code = String(error?.code ?? '')
  const message = String(error?.message ?? '')
  return code === 'PGRST202' ||
    (code === '42883' && /function|procedure/i.test(message)) ||
    ((/could not find the function|function .* does not exist|schema cache/i.test(message)) &&
      (!functionName || message.includes(functionName) || code === 'PGRST202'))
}

export function vietnamToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

export async function inspectDueRecurringRules(userId) {
  if (!userId) throw new Error('Người dùng chưa đăng nhập')
  const { data, error } = await supabase
    .from('recurring_rules')
    .select('id, next_due_date')
    .eq('user_id', userId)
    .eq('is_active', true)
    .lte('next_due_date', vietnamToday())
    .limit(1000)
  if (error) throw error
  return {
    generatedCount: 0,
    pendingCount: data?.length ?? 0,
    degraded: true,
    message: 'RPC chưa được cài đặt; các kỳ đến hạn được giữ nguyên, chưa ghi thu/chi hay thay đổi số dư ví.'
  }
}
