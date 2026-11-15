import { createApp } from './app.js'

const app = createApp()
const PORT = process.env.PORT || 5000

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log('====================================================')
    console.log(`🚀 SpendWise Backend REST API is running on port: ${PORT}`)
    console.log(`🌐 Base URL: http://localhost:${PORT}`)
    console.log(`📡 Healthcheck: http://localhost:${PORT}/api/finance/health`)
    console.log('====================================================')
  })
}

export default app
