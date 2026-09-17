# 📋 JP Wallet 專案交接文件 (HANDOVER.md)

> **致接手的 AI Assistant / 開發者：**
> 本文件包含 **JP Wallet** 專案的完整架構、核心邏輯、資料庫設計、效能防護機制、近期完成的重大優化與未來擴充方向。請在接手作業前詳細閱讀本文件。

---

## 1. 📌 專案概覽 (Project Overview)
- **專案名稱**: JP Wallet (`jp-wallet`)
- **核心定位**: 專為赴日旅遊設計的單頁 Web 應用程式 (SPA)。支援日本發票/收據相片批次辨識 (Gemini 2.0 AI)、無發票手動記帳、多行程管理、日圓/台幣即時匯率換算、天數標籤篩選、分類明細統整與每日消費趨勢分析。
- **iOS PWA 支援**: 支援在 iPhone Safari 點擊「新增至主畫面」作為無網址列的全螢幕獨立 App 使用（永久有效不失效）。
- **技術棧 (Tech Stack)**:
  - **前端框架**: React 19, TypeScript ~6.0
  - **構建工具**: Vite 8
  - **樣式庫**: Tailwind CSS v4, Lucide React Icons
  - **AI 辨識**: Google Generative AI SDK (`gemini-2.0-flash`)
  - **本地資料庫**: 原生 IndexedDB (`dbStorage.ts`) + LocalStorage 防崩潰備份
  - **本地環境**: `.node_local` 內含 Node.js v20.18.0 & npm

---

## 2. 📂 專案目錄結構 (Directory Structure)

```
jp wallet/
├── .env.example              # API Key 環境變數範例 (VITE_GEMINI_API_KEY)
├── index.html                # PWA 全螢幕 Meta 標籤、Viewport 視口設定
├── package.json              # 專案依賴與腳本 (已移除 Mac 專用封包以適應 Linux)
├── vite.config.ts            # Vite 配置檔
├── vercel.json               # Vercel SPA 路由重定向配置 ({ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] })
├── HANDOVER.md               # 本交接文件
├── public/
│   ├── favicon.svg           # 翡翠綠 (Emerald) 日圓錢包高解析度 SVG 圖示 (兼 Apple Touch Icon)
│   └── manifest.json         # PWA Standalone 全螢幕設定檔
├── src/
│   ├── main.tsx              # React 應用入口
│   ├── App.tsx               # 主應用元件 (Tab 切換、行程管理、IndexedDB 資料庫持久化)
│   ├── index.css             # TailwindCSS + 自訂動畫 (fadeIn, slideUp, scanLine, scrollbar-none)
│   ├── types/
│   │   └── receipt.ts        # 核心 Data Models (Receipt, ReceiptItem, Trip, CategoryType, CATEGORY_METAS)
│   ├── utils/
│   │   ├── currency.ts       # JPY <-> TWD 匯率換算與格式化 (calcTWD, formatJPY, formatTWD)
│   │   ├── dbStorage.ts      # IndexedDB 無限容量資料庫 + LocalStorage 備份與 QuotaExceeded 防爆保護
│   │   ├── geminiScanner.ts  # Gemini 2.0 Flash 發票辨識 + 25s 超時防護 (AbortController) + 和曆計算
│   │   └── ocrParser.ts      # 備用本地 OCR 解析器 + 日文商品字典 + INITIAL_SAMPLE_RECEIPTS
│   └── components/
│       ├── HeaderNav.tsx          # 頂部導覽列 (行程切換/新增/重命名/刪除、匯率設定、三分頁 Tab)
│       ├── ReceiptList.tsx        # 【明細】分頁：頂部與右下角＋新增記帳按鈕、天數選擇列、useMemo/useCallback 效能管線
│       ├── ReceiptDetailModal.tsx # 【發票詳情/編輯】彈窗 (檢視/編輯/取消/保存嚴格 UI 狀態 + twdTotal 即時連動)
│       ├── ReceiptUploadModal.tsx # 【發票新增】彈窗 (📷 AI 相片極速掃描 / ✏️ 無發票手動記帳 雙模式 Tab)
│       ├── CategoryView.tsx       # 【分類】分頁 (跨發票品項分類統計與展開)
│       └── AnalyticsView.tsx      # 【分析】分頁 (總覽卡片 + 每日消費趨勢純 CSS 柱狀圖 + 分類進度條)
```

---

## 3. 🔑 核心模組與資料架構 (Core Data Models & Architecture)

### 3.1 核心 Data Models (`src/types/receipt.ts`)
```typescript
export interface ReceiptItem {
  id: string;
  nameJp: string;         // 日文商品名稱
  nameZh: string;         // 繁體中文翻譯
  category: CategoryType; // 8大分類之一
  quantity: number;       // 數量
  unitPriceJpy: number;   // 單價 (JPY)
  totalJpy: number;       // 該項總價 (JPY)
}

export interface Receipt {
  id: string;
  storeNameJp: string;    // 店家日文名
  storeNameZh: string;    // 店家繁中名
  branchName?: string;
  address?: string;
  country: string;
  date: string;           // 格式：YYYY年MM月DD日 HH:mm
  category: CategoryType; // 主要分類
  items: ReceiptItem[];   // 細項列表
  itemCount: number;
  subtotalJpy: number;
  taxJpy: number;
  discountJpy: number;
  totalJpy: number;       // 發票總金額 (JPY)
  imageUrl?: string;      // 600px 高倍率壓縮相片 Base64 (手動記帳時為空字串)
  createdAt: number;
}

export interface Trip {
  id: string;
  name: string;           // 行程名稱 (例：東京賞櫻之旅)
  createdAt: number;
  receipts: Receipt[];    // 該行程所屬的所有發票
}
```

### 3.2 8 大消費分類與樣式定義
`CATEGORIES`: `['藥品', '零食', '生活用品', '吃飯', '交通', '御守', '紀念品', '其他']`
每個分類在 `CATEGORY_METAS` 中均定義了對應的色塊 Badge 背景 (`badgeBg`)、文字顏色 (`badgeText`)、邊框 (`border`) 與主題色 (`color`)。

---

## 4. ⚡ 近期完成的重大優化與 Bug 修正歷史

### 4.1 本地資料庫與記憶體防爆 (`src/utils/dbStorage.ts`)
- **問題原委**: 過去全數保存在 `localStorage`，上傳 5~10 張照片後因 LocalStorage 的 5MB 硬性限制引發 `QuotaExceededError` 導致 React 白屏崩潰。
- **修復方案**: 升級為原生 `IndexedDB` 資料庫，支援數 GB 容量。`saveTrips` 內建 `try-catch` 防護，若 LocalStorage 滿載會自動去相片化進行二次備份，絕不導致白屏。

### 4.2 AI 引擎升級與連線防卡死 (`src/utils/geminiScanner.ts`)
- **模型升級**: 由 `gemini-flash-latest` 升級為 Google 最新 **`gemini-2.0-flash`**，單張 OCR 辨識速度提昇 3~5 倍（~0.8 秒）。
- **25 秒超時防護**: 加上 `AbortController` 寬鬆 25 秒 Timeout 控制，避免在弱網/日本漫遊環境下無窮卡死。
- **和曆轉換算法**: 忠實解析發票年份，包含令和 N 年 (`2018+N`) 與平成 N 年 (`1988+N`) 的西元轉換。

### 4.3 相片極速壓縮與批次控制 (`src/components/ReceiptUploadModal.tsx`)
- **高倍率壓縮**: `compressImageToBase64` 壓縮至 max 600px 寬高、0.5 品質，圖片 Base64 體積從 ~400KB 大幅降至 **~20KB**（傳輸速度快 5 倍以上）。
- **批次間隔與重試**: 批次處理照片之間加入 800ms 間隔；若遇 Google 429 限頻自動冷卻 3 秒後重試一次。
- **實時狀態與中途取消**: 畫面上動態顯示「正在辨識第 X / Y 張 (檔名)...」，並配有【中途停止 / 取消】按鈕。

### 4.4 雙模式發票新增 (`ReceiptUploadModal.tsx`)
- **📷 AI 相片掃描 Tab**: 批次選取相片並自動 AI 解析。
- **✏️ 無發票手動新增 Tab**: 適用於自動販賣機、路邊攤、神社御守等現金消費。支援填寫店家名稱（中/日）、分類選擇、日期時間、JPY 總額（即時顯示進位台幣 `≈ NT$ XXX`）與自由新增品項。

### 4.5 頁面效能與 UX 優化 (`ReceiptList.tsx` & `ReceiptDetailModal.tsx`)
- **頂部＋新增按鈕**: 搜尋列右側新增【＋ 新增記帳】按鈕，不需下滑即可直接點擊。
- **ReceiptList useMemo 全鏈路**: `filteredReceipts` → `sortedReceipts` → `groups` → `displayedGroups` 皆包裝在 `useMemo` 中，避免無謂 re-render。
- **ReceiptDetailModal twdTotal 即時連動**: 修正編輯模式下修改 JPY 金額時「折合台幣」未即時反應的 bug (改為引用 `editedReceipt.totalJpy`)。
- **嚴格 UI 狀態**: 檢視模式（左上關閉/右上編輯/右下完成）與編輯模式（左上取消/右上保存/右下完成隱藏）規範清晰。

---

## 5. 🌐 Vercel 部署與 PWA 免費發布配置

### 5.1 Vercel 部署說明
- 專案根目錄配有 `vercel.json`，已寫好 SPA 路由重定向。
- `package.json` 中已移除 Mac 專用 Linux 相斥封包 (`@rolldown/binding-darwin-x64`)，可直接在 Vercel 平台上 100% 成功建置。
- **環境變數設定**: 於 Vercel 後台將 `VITE_GEMINI_API_KEY` 設為個人的 Gemini API Key 即可。
- **線上展示網址**: `https://jp-wallet-phau.vercel.app`

### 5.2 PWA 設定 (iPhone 新增至主畫面)
- `index.html` 內含 `apple-mobile-web-app-capable: yes` 與 `viewport-fit=cover`。
- `public/manifest.json` 與 `public/favicon.svg` 已就緒，安裝到手機桌面後將擁有獨立無網址列的全螢幕體驗。

---

## 6. 🚀 本地開發與驗證指令 (Development Commands)

> **重要注意事項**: 本地開發環境使用 `.node_local` 內含的 Node.js，所有命令必須加上 PATH 前綴：

```bash
# 1. 雙擊桌面腳本一鍵啟動（Mac 最快）
/Users/yangchengyu/Desktop/啟動\ JP\ Wallet.command

# 2. 啟動 Vite 開發伺服器
PATH=$(pwd)/.node_local/bin:$(pwd)/node_modules/.bin:$PATH vite --host

# 3. TypeScript 類型檢查
PATH=$(pwd)/.node_local/bin:$(pwd)/node_modules/.bin:$PATH tsc -b

# 4. 正式打包編譯
PATH=$(pwd)/.node_local/bin:$(pwd)/node_modules/.bin:$PATH vite build
```

---

## 7. 💡 給後續開發者的改進建議 (Future Roadmap)

1. **動態行程授權碼 (Auth Code)**: 可在設定中新增「訪問密碼/行程授權碼」功能，防止 Vercel 網址外流時免費 API 額度被陌生人佔用。
2. **CSV / JSON 一鍵匯出**: 新增一鍵導出 CSV/Excel 功能，方便使用者回國後進行旅費報帳或分享給同行者。
3. **離線備用 OCR (Fallback OCR)**: 當網路完全斷線或 Gemini API 額度用盡時，可降級調用 `src/utils/ocrParser.ts` 進行本地文字比對與解析。
