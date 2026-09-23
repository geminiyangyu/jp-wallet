# 📋 JP Wallet 專案交接文件

> 給接手的開發者或 AI：本文件描述**目前實際的**架構與設定。
> 最後更新：2026-09-24。所有數值都是從程式碼實際抓出來的，不是憑印象寫的。

---

## 0. 🚀 在新電腦上接手（先做這段）

### 0.1 需要先裝的東西

- **Node.js 20 以上**（Vite 8 的最低要求）
- **Git**

> 舊環境曾在專案內放 `.node_local`（內附 Node 20.18.0），該資料夾已被 `.gitignore` 排除、不會進版控。
> 新電腦請直接安裝系統版 Node，**指令前面不需要再加 `PATH=$(pwd)/.node_local/bin:...` 前綴**。

### 0.2 完整啟動步驟

```bash
git clone https://github.com/geminiyangyu/jp-wallet.git
cd jp-wallet
npm install
```

接著在專案根目錄建立 `.env`（這個檔案**不在 repo 裡**，必須自己建）：

```
GEMINI_API_KEY=你的_Gemini_金鑰
```

> ⚠️ **變數名稱沒有 `VITE_` 前綴，這一點很重要**，原因見第 3 節。
> 金鑰可從 Google AI Studio（<https://aistudio.google.com/apikey>）取得。

然後：

```bash
npm run dev      # 開發伺服器，/api/scan 由 vite.config.ts 的中介層代理
npm run build    # 正式建置（內含 tsc -b 型別檢查）
npm run lint     # oxlint
```

### 0.3 不在 repo 裡、需要自備的三樣東西

| 項目 | 說明 |
|---|---|
| `.env` | Gemini 金鑰。刻意排除，避免金鑰外流 |
| `.node_local` | 舊的內附 Node 執行環境。新電腦改用系統 Node |
| `node_modules` | `npm install` 會重建 |

### 0.4 GitHub 推送權限

GitHub 已不接受密碼認證。新電腦第一次 `git push` 時：

- **Username**：`geminiyangyu`
- **Password**：貼 **Personal Access Token**（<https://github.com/settings/tokens/new>，勾選 `repo` scope）

或改用 `gh auth login`（需先安裝 GitHub CLI）比較省事。
建議先設 `git config --global credential.helper osxkeychain`（macOS）讓系統記住。

---

## 1. 📌 專案概覽

- **名稱**：JP Wallet (`jp-wallet`)
- **定位**：赴日旅遊記帳 SPA。日文收據 AI 辨識、無發票手動記帳、多行程管理、日圓/台幣換算、分類統計與消費趨勢分析。
- **線上網址**：<https://jp-wallet.vercel.app>
- **GitHub**：<https://github.com/geminiyangyu/jp-wallet>（分支 `main`）
- **iOS PWA**：Safari「加入主畫面」後為無網址列的全螢幕 App。

### 技術棧

| 類別 | 使用 |
|---|---|
| 前端 | React 19 + TypeScript ~6.0 |
| 建置 | Vite 8 |
| 樣式 | Tailwind CSS v4、Lucide Icons |
| AI 辨識 | Gemini（**由伺服器端 Serverless Function 呼叫**，見第 3 節） |
| 本地資料庫 | 原生 IndexedDB + LocalStorage 降級備份 |
| 部署 | Vercel（接 GitHub 自動部署） |

**執行階段依賴只有 6 個**：`react`、`react-dom`、`lucide-react`、`clsx`、`tailwind-merge`、`canvas-confetti`。

> 註：`@google/generative-ai` 與 `tesseract.js` 已於 2026-09 移除——兩者從未被任何原始碼 import，
> 移除前後打包產物的雜湊完全相同，確認是死依賴。

---

## 2. 📂 目錄結構

```
jp wallet/
├── api/
│   └── scan.ts               # ⭐ Vercel Serverless Function：伺服器端呼叫 Gemini
├── src/
│   ├── App.tsx               # 主元件：行程管理、IndexedDB 持久化、刪除確認視窗
│   ├── main.tsx
│   ├── index.css
│   ├── types/receipt.ts      # Receipt / ReceiptItem / Trip / CATEGORY_METAS
│   ├── utils/
│   │   ├── currency.ts       # JPY ↔ TWD 換算與格式化
│   │   ├── dbStorage.ts      # IndexedDB + LocalStorage 防爆備份
│   │   ├── geminiScanner.ts  # ⭐ 前端：POST /api/scan、和曆換算、欄位對應
│   │   └── ocrParser.ts      # 備用本地 OCR 解析器（目前未啟用）
│   └── components/
│       ├── HeaderNav.tsx
│       ├── ReceiptList.tsx
│       ├── ReceiptDetailModal.tsx
│       ├── ReceiptUploadModal.tsx  # ⭐ 相片壓縮、批次併發掃描、手動記帳
│       ├── CategoryView.tsx
│       └── AnalyticsView.tsx
├── vite.config.ts            # ⭐ 含開發用 /api/scan 中介層
├── vercel.json               # SPA rewrite（已排除 /api）
├── .env.example
└── HANDOVER.md               # 本文件
```

---

## 3. 🔐 金鑰架構（最重要的一段）

### 演進

**舊版（已廢除）**：前端直接讀 `import.meta.env.VITE_GEMINI_API_KEY` 呼叫 Gemini。
Vite 會把 `VITE_` 開頭的變數在**建置時寫死進前端 JS**，等於把金鑰公開在網路上，任何人按 F12 都能抄走。

**現版**：前端 `POST /api/scan` → 由 Vercel Serverless Function 持有金鑰代為呼叫 Gemini。
金鑰只存在伺服器端環境變數，永遠不會進入 bundle。

### 環境變數

| 變數 | 位置 | 必填 | 說明 |
|---|---|---|---|
| `GEMINI_API_KEY` | Vercel 後台 + 本機 `.env` | ✅ | **不可有 `VITE_` 前綴** |
| `GEMINI_MODEL` | Vercel 後台（選填） | ❌ | 逗號分隔的模型清單，覆寫預設。只填一個 = 不並行 |

**Vercel 設定位置**：專案 → Settings → Environment Variables，三個環境（Production / Preview / Development）都要勾。
**環境變數改完必須重新部署才會生效。**

### ⚠️ 兩個 Vercel 專案

同一個 GitHub repo 目前被**兩個 Vercel 專案**部署：

| 網域 | 狀態 |
|---|---|
| `jp-wallet.vercel.app` | ✅ **正式使用**，已設定 `GEMINI_API_KEY` |
| `jp-wallet-phau.vercel.app` | ❌ 未設定金鑰，掃描必定失敗 |

用錯網域會看到「伺服器尚未設定 GEMINI_API_KEY 環境變數」。建議擇日刪除 phau 那個專案。

---

## 4. 🧠 AI 辨識管線

### 流程

```
使用者選相片
  → ReceiptUploadModal 壓縮出兩份（辨識用高解析 + 保存用縮圖）
  → 同時處理 3 張（CONCURRENCY = 3）
  → geminiScanner.ts：POST /api/scan
  → api/scan.ts：同時發給多個 Gemini 模型，誰先回來用誰
  → 回傳 AI 產生的 JSON 字串
  → geminiScanner.ts 做和曆換算與欄位對應
  → 寫入 IndexedDB
```

### 關鍵設定（皆為實測調校的結果）

| 設定 | 值 | 檔案 |
|---|---|---|
| 模型清單 | `gemini-3.5-flash-lite, gemini-3.6-flash, gemini-3.8-flash, gemini-3.5-flash` | `api/scan.ts` |
| 呼叫方式 | **並行競速**（`Promise.any`），首個成功者勝出，其餘中止 | `api/scan.ts` |
| 思考模式 | `thinkingConfig.thinkingLevel = 'low'` | `api/scan.ts` |
| 伺服器總預算 | 50 秒 | `api/scan.ts` |
| Vercel 函式上限 | 60 秒（必須大於總預算） | `api/scan.ts` |
| 前端逾時 | 56 秒（必須大於伺服器總預算） | `geminiScanner.ts` |
| 辨識用圖片 | 寬 ≤ 1200、高 ≤ 3200、品質 0.75 | `ReceiptUploadModal.tsx` |
| 保存用縮圖 | 最長邊 400、品質 0.5 | `ReceiptUploadModal.tsx` |
| 批次併發數 | 3 | `ReceiptUploadModal.tsx` |

> **逾時數字彼此有依存關係**：前端 56s > 伺服器 50s，且 Vercel 上限 60s > 伺服器 50s。
> 改任何一個都要一起檢查，否則會出現「伺服器還在跑、前端先放棄」的假逾時。

### API 回應格式

成功：
```json
{ "text": "<AI 產生的 JSON 字串>", "model": "實際勝出的模型", "ms": 8342, "tried": ["..."] }
```

失敗：
```json
{ "error": "Gemini API 錯誤: ...", "tried": ["..."], "details": ["模型A: 原因", "模型B: 原因"] }
```

`model` / `ms` / `details` 是除錯用的，排查問題時很有用。

---

## 5. 🐛 踩過的坑（別再踩一次）

### 5.1 `gemini-2.0-flash` 已被 Google 移除
回傳 404 `no longer available`。**不要把模型改回 2.0 系列。**

### 5.2 Gemini 3.x 預設會「思考」
3.x Flash 的 `thinkingLevel` 預設是 `medium`，回答前先內部推理，
19 品項的長收據因此動輒 30 秒以上。設成 `'low'` 是長收據能用的關鍵。

### 5.3 圖片壓太小會讓 AI「用猜的」
舊版把最長邊壓到 600px，一張 284×1326 的收據會變成 **129×600**——日期那行糊到人眼都認不出。
症狀是**同一張圖每次辨識出不同結果**（年份 2020/2024、店名、品項數都會變）。
收據又高又窄，**必須寬高分開設限**，不能用「最長邊」。

### 5.4 `window.confirm` 會被瀏覽器靜默停用
連續跳幾次對話框後，瀏覽器會出現「防止此頁面建立其他對話方塊」的勾選；
一旦勾選，`confirm()` 直接回傳 false，使用者按刪除完全沒反應。
**發票刪除已改用 App 內建確認視窗**（`App.tsx` 的 `pendingDeleteId`）。
> 旅程刪除與清除資料仍在用 `window.confirm`，若遇到同樣症狀，比照辦理。

### 5.5 日期解析的兩個漏網格式
以 9 張實際收據測出來的：
- `2026年 7月12日`——「年」後面有空格
- `19時22分`——用時/分而非冒號

`geminiScanner.ts` 的正則已允許分隔符號前後有空白，時間也接受 `:` `：` `時`。
改這段之前先跑一輪多格式測試。

### 5.6 `vercel.json` 的 rewrite 會吃掉 API 路由
原本是 `/(.*)`，會把 `/api/scan` 一起導向 `index.html`。
現在是 `/((?!api/).*)`，**不要改回去**。

---

## 6. 🌐 部署

推到 `main` → Vercel 自動建置上線，約一到兩分鐘。

```bash
git add -A
git commit -m "說明這次改了什麼"
git push
```

`.gitignore` 已排除 `.env`、`api key.txt`、`*.key`、`*.pem`、`photo/`、`*.pdf`、`node_modules`、`dist`、`.node_local`。
**務必用 git 指令推送，不要用 GitHub 網頁拖曳上傳**——網頁拖曳不套用 `.gitignore`，手滑就會把金鑰公開。

---

## 7. 💡 待辦與建議

1. **更換 Gemini 金鑰**（優先）：現用的金鑰在舊架構下曾被打包進前端 bundle 公開過一段時間。
   換新金鑰只需改 Vercel 環境變數與本機 `.env`，程式碼不用動。
2. **刪除多餘的 Vercel 專案**：`jp-wallet-phau` 沒設金鑰，只會造成混淆。
3. **UI 顯示真實錯誤訊息**：目前批次掃描失敗只顯示「辨識失敗」，
   伺服器其實回傳了 `error` 與 `details`，把它顯示出來可大幅減少除錯往返。
4. **CSV / JSON 匯出**：方便回國後報帳或分享給同行者。
5. **離線備援 OCR**：`src/utils/ocrParser.ts` 已存在但未啟用，可在斷線或額度用盡時降級使用。
6. **旅程授權碼**：防止 Vercel 網址外流時，免費 API 額度被陌生人消耗。

---

## 8. 🔍 排查速查表

| 症狀 | 先查這裡 |
|---|---|
| 「伺服器尚未設定 GEMINI_API_KEY」 | Vercel 環境變數名稱是否正確、是否重新部署過、是不是開到 phau 網域 |
| 所有掃描都失敗 | 用瀏覽器 console 打 `/api/scan`，看回傳的 `details` 逐模型原因 |
| 長收據逾時、短的正常 | `thinkingLevel` 是否仍為 `low`；三個逾時數字的依存關係是否被破壞 |
| 同一張圖每次結果不同 | 圖片壓縮尺寸太小（見 5.3） |
| 年份/金額錯誤 | 同上，優先檢查解析度而非解析邏輯 |
| 按刪除沒反應 | 是否有程式碼改回 `window.confirm`（見 5.4） |
| 手機看到舊版行為 | iOS 快取。用無痕視窗驗證，或清除網站資料後重新加入主畫面 |

### 直接從瀏覽器測 API（排查神器）

在網站頁面的 console 執行：

```js
const r = await fetch('/api/scan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ base64Data: '<純 base64，不含 data: 前綴>', mimeType: 'image/jpeg' })
});
console.log(r.status, await r.text());
```

回應會告訴你哪個模型勝出、花多久、或每個模型各自失敗的原因。
