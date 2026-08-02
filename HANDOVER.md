# 📋 JP Wallet 專案交接文件 (HANDOVER.md)

## 1. 📌 專案概覽
- **專案名稱**: JP Wallet (`jp-wallet`)
- **核心定位**: 專為赴日旅遊設計的單頁 Web 應用程式 (SPA)。支援 iOS PWA 全螢幕模式 (新增至主畫面)、日本發票/收據的相片與批次辨識 (Gemini AI)、無發票手動記帳、多行程管理、日圓/台幣即時匯率換算、按天數及按分類的明細統整與消費分析。
- **技術棧**:
  - **Core**: React 19, TypeScript ~6.0
  - **Build Tool**: Vite 8
  - **Styling**: Tailwind CSS v4, Lucide React Icons
  - **AI / OCR**: Google Generative AI SDK (Gemini Flash)
  - **Deployment**: Vercel Ready (`vercel.json`), PWA Web App Manifest (`manifest.json`), Apple Touch Icon (`favicon.svg`).
  - **Mac Desktop Launcher**: `/Users/yangchengyu/Desktop/啟動 JP Wallet.command` (雙擊自動檢查背景服務並開啟瀏覽器).
  - **Local Runtime**: `.node_local` 內含 Node.js v20.18.0 & npm

---

## 2. 📂 專案目錄結構
```
jp wallet/
├── .env.example              # API Key 環境變數範例
├── index.html                # PWA 全螢幕中元標籤、Viewport 視口設定
├── package.json              # 專案依賴與腳本
├── vite.config.ts            # Vite 配置檔
├── vercel.json               # Vercel 部署 SPA 路由重定向
├── HANDOVER.md               # 本交接文件
├── public/
│   ├── favicon.svg           # 精美 Emerald 日圓與錢包高解析度 SVG 圖示 (兼作 Apple Touch Icon)
│   └── manifest.json         # PWA Standalone 全螢幕設定檔
├── src/
│   ├── main.tsx              # React 入口檔
│   ├── App.tsx               # 主應用元件 (Tab 控制、行程管理、IndexedDB 持久化)
│   ├── index.css             # TailwindCSS + 自訂動畫 (fadeIn, slideUp, scanLine, scrollbar-none)
│   ├── types/
│   │   └── receipt.ts        # 核心 Data Models (Receipt, ReceiptItem, Trip, CategoryType, CATEGORY_METAS)
│   ├── utils/
│   │   ├── currency.ts       # 匯率計算 (JPY <-> TWD) 與格式化工具
│   │   ├── dbStorage.ts      # IndexedDB 無限容量資料庫儲存 + LocalStorage 備份與防崩潰保護
│   │   ├── geminiScanner.ts  # Gemini AI 發票辨識 + 和曆年份轉換
│   │   └── ocrParser.ts      # 備用 OCR 解析器 + 日文商品字典 + INITIAL_SAMPLE_RECEIPTS
│   └── components/
│       ├── HeaderNav.tsx          # 頂部導覽列 (行程切換/新增/刪除、匯率設定、三分頁 Tab)
│       ├── ReceiptList.tsx        # 【明細】分頁：頂部＋新增記帳按鈕、天數選擇列、搜尋過濾、useMemo 效能優化
│       ├── ReceiptDetailModal.tsx # 【發票詳情/編輯】彈窗 (編輯/取消/保存流程 + slideUp 動畫)
│       ├── ReceiptUploadModal.tsx # 【發票新增彈窗】(📷 AI 相片掃描 / ✏️ 無發票手動新增 切換 Tab)
│       ├── CategoryView.tsx       # 【分類】分頁 (跨發票品項統計與展開)
│       └── AnalyticsView.tsx      # 【分析】分頁 (總覽卡片 + 每日消費趨勢柱狀圖 + 分類進度條)
```

---

## 3. 🔑 核心功能

### A. Mac 桌面一鍵啟動腳本 (`啟動 JP Wallet.command`)
- 放置於 `/Users/yangchengyu/Desktop/啟動 JP Wallet.command`。
- 雙擊時自動檢測 Vite 通訊埠 `5173` 是否運行中；若未運行，自動在背景啟動 `.node_local` 伺服器，並喚起預設瀏覽器開啟 `http://localhost:5173/`。

### B. Vercel 免費部署與 PWA 支持 (`vercel.json` & `manifest.json`)
- **Vercel 一鍵部署**: 已新增 `vercel.json` 確保單頁應用路由在任何連線下 100% 正常。
- **iOS 全螢幕模式 (Standalone)**: 在任何人的 iPhone 上打開部署後的網址，點擊「分享 ➜ 新增至主畫面」即可全螢幕使用。
- **資料隔離安全性**: 每個人的手機瀏覽器（IndexedDB）各自獨立儲存各自的記帳資料，測試者之間互不干擾。

### C. 頂部新增按鈕與無發票手動記帳 (`ReceiptList.tsx` & `ReceiptUploadModal.tsx`)
- **頂部【＋ 新增記帳】按鈕**: 放置於搜尋與過濾器列最頂部，開啟即用，不需下滑即可直接新增。同時保留右下角浮動 `＋` 按鈕。
- **雙模式 Tab 切換 (`ReceiptUploadModal.tsx`)**:
  1. **📷 AI 相片掃描**: 原相片拖曳與批次 AI 掃描辨識。
  2. **✏️ 無發票手動新增**: 適合自動販賣機、無發票小吃、神社御守等現金消費。支援輸入中文/日文店家名、分類（帶色塊 Badge）、時間日期、JPY 金額（自動即時顯示進位台幣 `≈ NT$ XXX`）與購買細項。

---

## 4. 🚀 本地開發指令

```bash
# 雙擊桌面腳本（最快）
/Users/yangchengyu/Desktop/啟動\ JP\ Wallet.command

# 手動啟動開發伺服器
PATH=$(pwd)/.node_local/bin:$(pwd)/node_modules/.bin:$PATH vite --host

# TypeScript 類型檢查
PATH=$(pwd)/.node_local/bin:$(pwd)/node_modules/.bin:$PATH tsc -b

# 正式打包
PATH=$(pwd)/.node_local/bin:$(pwd)/node_modules/.bin:$PATH vite build
```
