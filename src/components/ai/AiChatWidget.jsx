import React, { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, X, Bot, User, RefreshCw, AlertCircle } from 'lucide-react'
import { askGeminiAssistant, QUICK_REPLY_CHIPS } from '@/services/aiAssistantService'

/**
 * Component Khung chat Trợ lý AI Gemini với 4 nút gợi ý nhanh (Quick Reply Chips)
 * Phụ trách: Leader (Phan Thanh Tùng) - Nhóm chức năng AIBOT (UC21)
 */
export const AiChatWidget = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Xin chào! Tôi là Trợ lý AI SpendWise. Tôi có thể giúp bạn tra cứu chi tiêu, phân tích ngân sách hoặc tư vấn số tiền bạn có thể an toàn tiêu hôm nay.',
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
    }
  }, [messages, isOpen])

  if (!isOpen) return null

  const handleSend = async (textToSend) => {
    const prompt = (textToSend || inputValue).trim()
    if (!prompt || isLoading) return

    const userMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: prompt,
      timestamp: new Date()
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      const { reply, error } = await askGeminiAssistant(prompt)
      const botMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: reply || (error ? 'Đã xảy ra lỗi khi kết nối với Gemini AI.' : 'Không nhận được câu trả lời.'),
        timestamp: new Date(),
        isError: !!error
      }
      setMessages((prev) => [...prev, botMessage])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: 'Xin lỗi, tôi gặp sự cố khi xử lý câu hỏi của bạn. Vui lòng thử lại sau.',
          timestamp: new Date(),
          isError: true
        }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-sm transition-all duration-300">
      {/* Khung chat thiết kế Double-Bezel cao cấp */}
      <div className="w-full sm:max-w-xl h-[85vh] sm:h-[650px] bg-white rounded-t-[2rem] sm:rounded-[2rem] p-1.5 shadow-2xl ring-1 ring-black/5 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-300">
        <div className="flex-1 bg-slate-50 rounded-t-[calc(2rem-0.375rem)] sm:rounded-[calc(2rem-0.375rem)] flex flex-col overflow-hidden border border-slate-200/60">
          
          {/* Header */}
          <div className="px-5 py-3.5 bg-white border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md">
                <Sparkles className="w-5 h-5 text-amber-300" strokeWidth={1.5} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold text-slate-900 text-sm">Trợ lý AI Gemini</h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[10px] tracking-wide border border-emerald-200/60">
                    Live Context
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">Tư vấn tài chính cá nhân dựa trên dữ liệu thực tế</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
              aria-label="Đóng khung chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Reply Chips */}
          <div className="px-4 py-2 bg-slate-100/60 border-b border-slate-200/40 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap pl-1">Gợi ý:</span>
            {QUICK_REPLY_CHIPS.map((chip, index) => (
              <button
                key={index}
                onClick={() => handleSend(chip)}
                disabled={isLoading}
                className="whitespace-nowrap px-3 py-1 rounded-full bg-white hover:bg-slate-900 hover:text-white text-slate-700 text-xs font-medium border border-slate-200 shadow-2xs transition-all duration-200 active:scale-95 disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Messages list */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    msg.sender === 'user'
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'bg-slate-900 text-amber-300 shadow-xs'
                  }`}
                >
                  {msg.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>

                <div
                  className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                    msg.sender === 'user'
                      ? 'bg-slate-900 text-white rounded-tr-none'
                      : msg.isError
                      ? 'bg-rose-50 text-rose-800 border border-rose-200 rounded-tl-none'
                      : 'bg-white text-slate-800 border border-slate-200/70 rounded-tl-none'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                  <div
                    className={`mt-1 text-[9px] ${
                      msg.sender === 'user' ? 'text-slate-400 text-right' : 'text-slate-400'
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-slate-900 text-amber-300 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="bg-white border border-slate-200/70 rounded-2xl rounded-tl-none px-4 py-3 shadow-xs flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-600" />
                  <span className="text-xs text-slate-500">AI đang phân tích tài chính của bạn...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Hỏi Gemini về chi tiêu, ngân sách, số dư..."
              disabled={isLoading}
              className="flex-1 bg-slate-100/80 border border-slate-200 rounded-full px-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />

            <button
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isLoading}
              className="w-10 h-10 rounded-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white flex items-center justify-center shadow-sm transition-all duration-200 active:scale-95 shrink-0"
              aria-label="Gửi tin nhắn"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
