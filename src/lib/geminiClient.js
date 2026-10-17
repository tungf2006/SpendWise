import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKey = import.meta.env.VITE_GEMINI_API_KEY

export const getGeminiModel = (modelName = 'gemini-1.5-flash') => {
  if (!apiKey) {
    console.warn('VITE_GEMINI_API_KEY chưa được cấu hình trong file .env')
    return null
  }
  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({ model: modelName })
}
