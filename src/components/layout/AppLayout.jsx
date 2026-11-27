import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Navbar } from './Navbar'
import { BottomNav } from './BottomNav'
import { AiChatWidget } from '@/components/ai/AiChatWidget'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { supabase } from '@/lib/supabaseClient'
import { checkAndGenerateRecurringTransactions } from '@/services/recurringService'
import { startNotificationAutoSync } from '@/services/notificationService'
/**
 * Layout chung của toàn bộ ứng dụng SpendWise (AppLayout)
 * Phụ trách: TV2 (Hồ Nguyên Văn)
 */
export const AppLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [dbStatus, setDbStatus] = useState({ checking: true, connected: false, message: '' })
  const [showAiChat, setShowAiChat] = useState(false)
  const quickEntryTimerRef = useRef(null)
  const quickEntryRafRef = useRef(null)

  useEffect(() => {
    return () => {
      if (quickEntryRafRef.current !== null) {
        window.cancelAnimationFrame(quickEntryRafRef.current)
      }
      if (quickEntryTimerRef.current) {
        window.clearTimeout(quickEntryTimerRef.current)
      }
    }
  }, [])

  const handleOpenQuickEntry = useCallback(() => {
    navigate('/#quick-entry')
    window.dispatchEvent(new Event('spendwise:focus-quick-entry'))

    if (quickEntryRafRef.current !== null) {
      window.cancelAnimationFrame(quickEntryRafRef.current)
      quickEntryRafRef.current = null
    }
    if (quickEntryTimerRef.current) {
      window.clearTimeout(quickEntryTimerRef.current)
      quickEntryTimerRef.current = null
    }

    let attempts = 0
    const tryFocusQuickEntry = () => {
      quickEntryRafRef.current = null
      const inputEl = document.getElementById('quick-entry-input')
      const sectionEl = inputEl || document.getElementById('quick-entry')
      if (sectionEl) {
        sectionEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        if (inputEl instanceof HTMLInputElement || inputEl instanceof HTMLTextAreaElement) {
          inputEl.focus()
        }
        quickEntryTimerRef.current = null
        return
      }
      if (attempts < 15) {
        attempts += 1
        quickEntryTimerRef.current = window.setTimeout(tryFocusQuickEntry, 50)
      } else {
        quickEntryTimerRef.current = null
      }
    }

    quickEntryRafRef.current = window.requestAnimationFrame(tryFocusQuickEntry)
  }, [navigate])

  useEffect(() => {
    async function testConnection() {
      try {
        const { error } = await supabase.from('categories').select('count', { count: 'exact', head: true })
        if (error) throw error
        setDbStatus({
          checking: false,
          connected: true,
          message: 'Supabase Connected'
        })
      } catch (err) {
        setDbStatus({
          checking: false,
          connected: false,
          message: err.message || 'Supabase Connection Error'
        })
      }
    }

    testConnection()
  }, [])
    useEffect(() => {
        const checkRecurring = async () => {
            const { data, error } =
                await checkAndGenerateRecurringTransactions()

            if (error) {
                console.error('Lỗi giao dịch định kỳ:', error)
                return
            }

            if (data?.generatedCount > 0) {
                window.dispatchEvent(new Event('spendwise:finance-updated')) // SPENDWISE_UC24_UC25_P0_FIX:layout
                console.log(
                    `Đã tạo ${data.generatedCount} giao dịch định kỳ`
                )
            }
        }

        // Kiểm tra ngay khi vào ứng dụng
        checkRecurring()

        // Kiểm tra định kỳ mỗi giờ khi ứng dụng mở
        const intervalId = setInterval(
            checkRecurring,
            60 * 60 * 1000
        )

        // Kiểm tra lại khi quay về tab ứng dụng
        const handleVisibilityChange = () => {
            if (!document.hidden) checkRecurring()
        }

        document.addEventListener(
            'visibilitychange',
            handleVisibilityChange
        )

        return () => {
            clearInterval(intervalId)
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange
            )
        }
    }, [])
    useEffect(() => startNotificationAutoSync({ intervalMs: 300000, daysAhead: 3 }), [])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white transition-colors">
      {/* Floating Island Navbar */}
      <Navbar
        dbStatus={dbStatus}
        onOpenAiChat={() => setShowAiChat(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4 pb-28 lg:pb-12 transition-all">
        <ErrorBoundary resetKey={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* Mobile Floating Dock Navigation */}
      <BottomNav onOpenQuickEntry={handleOpenQuickEntry} />

      {/* Trợ lý AI Gemini Widget */}
      <AiChatWidget
        isOpen={showAiChat}
        onClose={() => setShowAiChat(false)}
      />
    </div>
  )
}
export default AppLayout
