import React, { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, X, Bot, User, RefreshCw } from 'lucide-react'
import { askGeminiAssistant, QUICK_REPLY_CHIPS } from '@/services/aiAssistantService'

/**
 * Render đoạn text có đánh dấu in đậm **...** và in nghiêng *...* an toàn bằng React elements.
 */
function renderFormattedMessage(text = '') {
  const lines = String(text).split('\n')
  return lines.map((rawLine, lineIdx) => {
    const line = rawLine.replace(/^\s*[-*]\s+/, '• ')
    const tokens = line.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g)
    return (
      <React.Fragment key={`line-${lineIdx}`}>
        {tokens.map((token, tokenIdx) => {
          if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
            return <strong key={`tok-${lineIdx}-${tokenIdx}`} className="font-semibold">{token.slice(2, -2)}</strong>
          }
          if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
            return <em key={`tok-${lineIdx}-${tokenIdx}`} className="italic opacity-90">{token.slice(1, -1)}</em>
          }
          return <React.Fragment key={`tok-${lineIdx}-${tokenIdx}`}>{token}</React.Fragment>
        })}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    )
  })
}

function createChatMessage(sender, text, isError = false) {
  return {
    id: `${sender}-${Date.now()}`,
    sender,
    text,
    timestamp: new Date(),
    isError
  }
}

const INITIAL_WELCOME_MESSAGE = {
  id: 'welcome',
  sender: 'bot',
  text: 'Xin chào! Tôi là Trợ lý AI SpendWise. Tôi có thể giúp bạn tra cứu chi tiêu, phân tích ngân sách hoặc tư vấn số tiền bạn có thể an toàn tiêu hôm nay.',
  timestamp: null
}

/**
 * Component Khung chat Trợ lý AI Gemini với 4 nút gợi ý nhanh (Quick Reply Chips)
 * Phụ trách: Leader (Phan Thanh Tùng) - Nhóm chức năng AIBOT (UC21)
 */
export const AiChatWidget = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([INITIAL_WELCOME_MESSAGE])
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

  useEffect(() => {
    if (!isOpen) return undefined
    const handleKeyUp = (event) => {
      if (event.key === 'Escape' && !isLoading) {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyUp)
    return () => window.removeEventListener('keydown', handleKeyUp)
  }, [isOpen, isLoading, onClose])

  if (!isOpen) return null

  const handleSend = async (textToSend) => {
    const prompt = (textToSend || inputValue).trim()
    if (!prompt || isLoading) return

    const userMessage = createChatMessage('user', prompt)

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      const { reply, error } = await askGeminiAssistant(prompt)
      const botMessage = createChatMessage(
        'bot',
        reply || (error ? 'Đã xảy ra lỗi khi kết nối với Gemini AI.' : 'Không nhận được câu trả lời.'),
        !!error
      )
      setMessages((prev) => [...prev, botMessage])
    } catch {
      setMessages((prev) => [
        ...prev,
        createChatMessage('bot', 'Xin lỗi, tôi gặp sự cố khi xử lý câu hỏi của bạn. Vui lòng thử lại sau.', true)
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

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose?.()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-chat-title"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-sm transition-all duration-300"
    >
      {/* Khung chat thiết kế Double-Bezel cao cấp */}
      <div className="w-full sm:max-w-xl h-[85vh] sm:h-[650px] bg-white dark:bg-slate-900 rounded-t-[2rem] sm:rounded-[2rem] p-1.5 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 flex flex-col overflow-hidden animate-slide-up">
        <div className="flex-1 bg-slate-50 dark:bg-[#0B0F19] rounded-t-[calc(2rem-0.375rem)] sm:rounded-[calc(2rem-0.375rem)] flex flex-col overflow-hidden border border-slate-200/60 dark:border-slate-800">
          {/* Header */}
          <div className="px-5 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-brand-600 text-white flex items-center justify-center shadow-md">
                <Sparkles className="w-5 h-5 text-amber-300" strokeWidth={1.5} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 id="ai-chat-title" className="font-display font-bold text-slate-900 dark:text-slate-100 text-sm">
                    Trợ lý AI Gemini
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px] tracking-wide border border-emerald-200/60 dark:border-emerald-800/60">
                    Live Context
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Tư vấn tài chính cá nhân dựa trên dữ liệu thực tế</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Đóng khung chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Reply Chips */}
          <div className="px-4 py-2 bg-slate-100/60 dark:bg-slate-900/70 border-b border-slate-200/40 dark:border-slate-800 flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap pl-1">Gợi ý:</span>
            {QUICK_REPLY_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleSend(chip)}
                disabled={isLoading}
                className="whitespace-nowrap px-3 py-1 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-900 dark:hover:bg-brand-600 hover:text-white text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-200 active:scale-95 disabled:opacity-50 cursor-pointer"
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
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-900 dark:bg-slate-800 text-amber-300'
                  }`}
                >
                  {msg.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>

                <div
                  className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-slate-900 dark:bg-brand-600 text-white rounded-tr-none'
                      : msg.isError
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800/70 rounded-tl-none'
                      : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200/70 dark:border-slate-800 rounded-tl-none'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{renderFormattedMessage(msg.text)}</div>
                  <div
                    className={`mt-1 text-[9px] ${
                      msg.sender === 'user' ? 'text-slate-300 text-right' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {msg.timestamp
                      ? new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                      : 'Sẵn sàng'}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-slate-900 dark:bg-slate-800 text-amber-300 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-600 dark:text-brand-500" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">AI đang phân tích tài chính của bạn...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Hỏi Gemini về chi tiêu, ngân sách, số dư..."
              disabled={isLoading}
              className="flex-1 bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />

            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isLoading}
              className="w-10 h-10 rounded-full bg-slate-900 dark:bg-brand-600 hover:bg-slate-800 dark:hover:bg-brand-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white flex items-center justify-center shadow-sm transition-all duration-200 active:scale-95 shrink-0 cursor-pointer"
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
