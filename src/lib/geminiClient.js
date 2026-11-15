/**
 * Lưu ý bảo mật (UC21):
 * Google Gemini SDK và GEMINI_API_KEY tuyệt đối KHÔNG được khởi tạo hoặc lưu trữ
 * ở mã nguồn phía trình duyệt (Client) để tránh bị lộ trong JS Bundle sau khi build.
 * Mọi yêu cầu AI đều phải đi qua Backend REST API (`POST /api/ai/chat`).
 */
export const getGeminiModel = () => {
  if (import.meta.env.DEV) {
    console.warn(
      '[SpendWise Security] Đã vô hiệu hóa gọi Gemini SDK trực tiếp ở Client. Vui lòng dùng Backend /api/ai/chat.'
    )
  }
  return null
}
