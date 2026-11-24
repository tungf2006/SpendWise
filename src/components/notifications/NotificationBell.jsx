import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, Check, CheckCheck, Trash2, AlertTriangle, CalendarClock, Loader2, X } from 'lucide-react'
import { useAuth } from '@/context/useAuth'
import {
  getNotifications, getUnreadCount, markAsRead, markAllAsRead, clearReadNotifications
} from '@/services/notificationService'

/** UC25 – Chuông và popover, hỗ trợ cảnh báo từ bảng hoặc fallback chỉ-đọc. */
export function NotificationBell() {
  const { user } = useAuth()
  const rootRef = useRef(null)
  const mountedRef = useRef(true)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setNotifications([])
      setUnread(0)
      return
    }
    const [list, count] = await Promise.all([getNotifications(50), getUnreadCount()])
    if (!mountedRef.current) return
    if (list.error || count.error) {
      setError(list.error?.message || count.error?.message || 'Không tải được thông báo.')
      return
    }
    setNotifications(list.data)
    setUnread(count.count)
    setError('')
  }, [user?.id])

  useEffect(() => {
    mountedRef.current = true
    const initTimer = window.setTimeout(() => { void refresh() }, 0)
    const onUpdated = () => { void refresh() }
    window.addEventListener('spendwise:notifications-updated', onUpdated)
    const intervalId = window.setInterval(onUpdated, 60000)
    return () => {
      mountedRef.current = false
      window.clearTimeout(initTimer)
      window.removeEventListener('spendwise:notifications-updated', onUpdated)
      window.clearInterval(intervalId)
    }
  }, [refresh])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (!next) return
    setLoading(true)
    try { await refresh() } finally { setLoading(false) }
  }

  const onMarkOne = async (notification) => {
    if (busy || notification.is_read) return
    setBusy(true)
    setError('')
    setNotifications(items => items.map(item => item.id === notification.id ? { ...item, is_read: true } : item))
    setUnread(count => Math.max(0, count - 1))
    try {
      const { error: actionError } = await markAsRead(notification.id)
      if (actionError) throw actionError
    } catch (err) {
      setError(err.message || 'Không đánh dấu đã đọc được.')
    } finally { await refresh(); setBusy(false) }
  }
  const onMarkAll = async () => {
    if (busy || !unread) return
    setBusy(true)
    setError('')
    setNotifications(items => items.map(item => ({ ...item, is_read: true })))
    setUnread(0)
    try {
      const { error: actionError } = await markAllAsRead()
      if (actionError) throw actionError
    } catch (err) {
      setError(err.message || 'Không đánh dấu tất cả được.')
    } finally { await refresh(); setBusy(false) }
  }
  const onClearRead = async () => {
    if (busy || !notifications.some(item => item.is_read)) return
    setBusy(true)
    setError('')
    setNotifications(items => items.filter(item => !item.is_read))
    try {
      const { error: actionError } = await clearReadNotifications(user?.id)
      if (actionError) throw actionError
    } catch (err) {
      setError(err.message || 'Không xóa các thông báo đã đọc được.')
    } finally { await refresh(); setBusy(false) }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={toggle}
        title="Thông báo"
        aria-label={unread > 0 ? `Thông báo: ${unread} chưa đọc` : 'Thông báo'}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200/80 flex items-center justify-center text-slate-700 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-500"
      >
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex min-w-5 h-5 px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Danh sách thông báo"
          className="absolute right-0 top-12 z-[80] w-[min(92vw,390px)] rounded-2xl bg-white shadow-2xl border border-slate-200 text-slate-900 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">Thông báo</h2>
              <p className="text-xs text-slate-500">{unread} chưa đọc</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Đóng thông báo"
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
          </div>
          <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-slate-100">
            <button type="button" disabled={!unread || busy} onClick={onMarkAll}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40">
              <CheckCheck size={14} /> Đánh dấu tất cả đã đọc
            </button>
            <button type="button" disabled={busy || !notifications.some(item => item.is_read)} onClick={onClearRead}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-40">
              <Trash2 size={14} /> Xóa đã đọc
            </button>
          </div>
          {error && <p role="alert" className="px-4 py-2 text-xs text-rose-700 bg-rose-50">{error}</p>}
          <div className="max-h-[min(60vh,440px)] overflow-y-auto" aria-live="polite">
            {loading && <div className="flex gap-2 items-center px-4 py-6 text-xs text-slate-500"><Loader2 size={16} className="animate-spin" /> Đang tải...</div>}
            {!loading && !notifications.length && <p className="px-4 py-8 text-center text-sm text-slate-500">Chưa có thông báo nào.</p>}
            {!loading && notifications.map(item => {
              const isBudget = item.type === 'budget_warning' || item.type === 'budget_exceeded'
              const Symbol = isBudget ? AlertTriangle : item.type === 'recurring_due' ? CalendarClock : Bell
              return (
                <div key={item.id} className={`flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-0 ${item.is_read ? 'bg-white' : 'bg-emerald-50/60'}`}>
                  <span className={`mt-0.5 shrink-0 rounded-lg p-2 ${isBudget ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}><Symbol size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="break-words text-xs font-bold text-slate-800">{item.title}</p>
                      {!item.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" aria-label="Chưa đọc" />}
                    </div>
                    <p className="text-xs mt-1 text-slate-600 break-words">{item.message}</p>
                    {item.is_virtual && <p className="text-[10px] text-slate-400 mt-1">Cảnh báo dự phòng (chưa đồng bộ máy chủ)</p>}
                    {!item.is_read && <button type="button" disabled={busy} onClick={() => onMarkOne(item)}
                      className="inline-flex items-center gap-1 text-[11px] mt-2 font-semibold text-emerald-700 hover:underline disabled:opacity-40"><Check size={13} /> Đánh dấu đã đọc</button>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
export default NotificationBell
