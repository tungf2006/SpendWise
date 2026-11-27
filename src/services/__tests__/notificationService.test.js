import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAuthGetUser = vi.fn()
const mockRpc = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: (...args) => mockAuthGetUser(...args)
    },
    rpc: (...args) => mockRpc(...args),
    from: (...args) => mockFrom(...args)
  }
}))

import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  checkAndGenerateNotifications,
  createNotification
} from '../notificationService.js'

const VALID_NOTI_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

describe('notificationService - UC25', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null
    })
  })

  it('getNotifications: trả về danh sách thông báo và chặn limit ngoài [1..100]', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [{ id: VALID_NOTI_ID, title: 'Cảnh báo ngân sách', is_read: false }],
        error: null
      })
    }
    mockFrom.mockReturnValue(query)

    const ok = await getNotifications(20)
    expect(ok.error).toBeNull()
    expect(ok.data).toHaveLength(1)

    const bad = await getNotifications(500)
    expect(bad.data).toEqual([])
    expect(bad.error.message).toContain('1 đến 100')
  })

  it('getUnreadCount: đếm chính xác số thông báo chưa đọc', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(function () {
        if (query.eq.mock.calls.length === 2) {
          return Promise.resolve({ count: 3, error: null })
        }
        return query
      })
    }
    mockFrom.mockReturnValue(query)

    const res = await getUnreadCount()
    expect(res.count).toBe(3)
    expect(res.error).toBeNull()
  })

  it('markAsRead & deleteNotification: kiểm tra định dạng UUID trước khi gọi DB', async () => {
    const badRead = await markAsRead('invalid-id')
    expect(badRead.error.message).toContain('ID thông báo không hợp lệ')

    const badDel = await deleteNotification('not-a-uuid')
    expect(badDel.error.message).toContain('ID thông báo không hợp lệ')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('markAllAsRead: từ chối khi chưa đăng nhập', async () => {
    mockAuthGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const res = await markAllAsRead()
    expect(res.error.message).toContain('chưa đăng nhập')
  })

  it('checkAndGenerateNotifications: gọi RPC sync_finance_notifications và chặn daysAhead sai', async () => {
    mockRpc.mockResolvedValue({
      data: { budget_warning: 2, recurring_due: 1 },
      error: null
    })

    const ok = await checkAndGenerateNotifications({ daysAhead: 3 })
    expect(mockRpc).toHaveBeenCalledWith('sync_finance_notifications', { p_days_ahead: 3 })
    expect(ok.data).toEqual({ budget_warning: 2, budget_exceeded: 0, recurring_due: 1 })
    expect(ok.error).toBeNull()

    const bad = await checkAndGenerateNotifications({ daysAhead: 99 })
    expect(bad.error.message).toContain('0 đến 30')
  })

  it('createNotification: chặn client tự tạo notification giả mạo (tuân thủ RLS)', async () => {
    const res = await createNotification({ title: 'Fake' })
    expect(res.data).toBeNull()
    expect(res.error.message).toContain('Chỉ backend/RPC có quyền tạo thông báo')
  })
})
