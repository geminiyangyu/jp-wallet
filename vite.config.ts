import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * 本機開發用的 /api/scan 中介層。
 *
 * Vercel 上線後會自動把 api/ 資料夾裡的檔案變成 Serverless Function，
 * 但本機跑 `vite --host` 時沒有這個機制，/api/scan 會 404。
 *
 * 這個外掛讓開發伺服器也能處理 /api/scan，直接載入同一支 api/scan.ts，
 * 所以本機與線上跑的是「完全相同的一份程式碼」，不會有兩套邏輯不同步的問題。
 *
 * 只在 `vite dev` 生效，正式建置完全不受影響。
 * 本機請在 .env 填 GEMINI_API_KEY=你的金鑰（沒有 VITE_ 前綴）。
 */
function devApiPlugin() {
  return {
    name: 'dev-api-scan',

    // Vite 預設只會把 VITE_ 開頭的變數交給前端，不會放進 process.env，
    // 所以這裡手動把 .env 裡的 GEMINI_API_KEY 載入 Node 行程，讓 api/scan.ts 讀得到。
    // 只在開發模式執行，正式建置不碰，金鑰不可能進入前端 bundle。
    config(_config: any, { command, mode }: { command: string; mode: string }) {
      if (command !== 'serve') return
      const env = loadEnv(mode, process.cwd(), '') // 第三個參數留空字串 = 載入所有變數，不限前綴
      // 伺服器端會用到的變數都要轉進 process.env，否則本機行為會跟 Vercel 上不一致
      for (const key of ['GEMINI_API_KEY', 'GEMINI_MODEL']) {
        if (env[key] && !process.env[key]) process.env[key] = env[key]
      }
    },

    configureServer(server: any) {
      server.middlewares.use('/api/scan', async (req: any, res: any) => {
        try {
          // 收集 request body
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          req.body = Buffer.concat(chunks).toString('utf-8')

          // 補上 Vercel 風格的 res.status().json() 介面
          res.status = (code: number) => {
            res.statusCode = code
            return res
          }
          res.json = (obj: unknown) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(obj))
            return res
          }

          const mod = await server.ssrLoadModule('/api/scan.ts')
          await mod.default(req, res)
        } catch (err: any) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err?.message || '本機 /api/scan 中介層發生錯誤' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), devApiPlugin()],
})
