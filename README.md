# 💴 JP Wallet - 日本旅遊記帳 / 發票辨識 App

專為赴日旅遊打造的智慧記帳錢包，支援 AI 發票相片辨識 (Gemini 2.0)、無發票手動記帳、日圓台幣即時換算與天數分類分析。

## 🌐 正式發布網址 (Vercel Live URL)
- **正式網址**: [https://jp-wallet-phau.vercel.app](https://jp-wallet-phau.vercel.app)
- **iOS PWA 安裝**: 於 iPhone Safari 打開上述網址，點擊「分享 ➔ 新增至主畫面」即可全螢幕獨立使用。

## 🔑 核心功能
- 📷 **AI 相片極速辨識**: 自動識別日文店家名、品項翻譯為繁體中文、和曆轉換與台幣無條件進位試算。
- ✏️ **無發票手動記帳**: 支援自動販賣機、路邊攤、神社御守等現金消費快速記帳。
- 📊 **每日消費趨勢**: 柱狀圖分析與 8 大分類統計。
- 💾 **IndexedDB 無限容量**: 全本地安全儲存，親友測試資料獨立隔離。

## 🚀 本地開發 (Local Development)
```bash
# 啟動開發伺服器
PATH=$(pwd)/.node_local/bin:$(pwd)/node_modules/.bin:$PATH vite --host
```
