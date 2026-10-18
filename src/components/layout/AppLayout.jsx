import React, { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'
import { BottomNav } from './BottomNav'
import { AiChatWidget } from '@/components/ai/AiChatWidget'
import { supabase } from '@/lib/supabaseClient'

/**
 * Layout chung của toàn bộ ứng dụng SpendWise (AppLayout)
 * Phụ trách: TV2 (Hồ Nguyên Văn)
 */
export const AppLayout = () => {
  const [dbStatus, setDbStatus] = useState({ checking: true, connected: false, message: '' })
  const [showAiChat, setShowAiChat] = useState(false)

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-brand-500 selection:text-white">
      {/* Floating Island Navbar */}
      <Navbar
        dbStatus={dbStatus}
        onOpenAiChat={() => setShowAiChat(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4 pb-28 md:pb-12 transition-all">
        <Outlet />
      </main>

      {/* Mobile Floating Dock Navigation */}
      <BottomNav
        onOpenQuickEntry={() => {
          // Điều hướng về dashboard và focus vào Quick Entry bar
          window.location.href = '/#quick-entry'
        }}
      />

      {/* Trợ lý AI Gemini Widget */}
      <AiChatWidget
        isOpen={showAiChat}
        onClose={() => setShowAiChat(false)}
      />
    </div>
  )
}
export default AppLayout
