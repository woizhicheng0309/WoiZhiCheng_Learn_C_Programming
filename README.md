# 魏志成的程式設計基礎學習網站

一個為 C 語言初學者設計的互動式學習網站。學生可以先預測結果、調整參數，再逐步觀察程式碼、記憶體與輸出如何同步改變，把抽象的程式流程變成看得見的過程。

**線上網站：** [https://woizhicheng0309.github.io/WoiZhiCheng_Learn_C_Programming/](https://woizhicheng0309.github.io/WoiZhiCheng_Learn_C_Programming/)

## 特色

- 「程式骨架、變數與運算」單元：預測 `int`／`double` 算式、觀察 `x`、`y`、`result` 記憶盒，並練習宣告、賦值與整數除法。
- 「條件判斷」單元：比較分數與出席率，逐步觀察 `if`／`else`、`&&`／`||` 與短路如何決定分支。
- `for` 迴圈實驗室：調整起始值、終止值、比較運算子與步進值，追蹤到最後一次條件為 `false` 的判斷。
- 巢狀迴圈乘法表：調整外層與內層上限，逐格觀察 `i × j` 如何產生最多 12 × 12 的乘法表。
- 共用播放、暫停、單步與重設流程，並可切換 `0.5×`、`1×`、`2×` 速度。
- 同步呈現目前執行的 C 程式碼片段、中文解釋、變數狀態、追蹤資料與 `printf` 輸出。
- 主動辨識 `step = 0`、步進方向錯誤與超過 100 次迭代等風險，不會執行任意 C 程式碼。
- 每個已開放單元各有三道挑戰；進度使用版本化資料保存在瀏覽器，舊版 `for` 進度會自動遷移。
- 支援鍵盤操作、清楚焦點、手機版介面與「減少動態效果」系統設定。
- 課程地圖依「主題 → 單元」呈現變數、條件、迴圈、函式、陣列與字串、指標；目前開放變數、條件判斷與 `for` 迴圈。

## 網站路由

網站使用 Hash Router，確保 GitHub Pages 重新整理後仍能正確開啟頁面。

| 頁面 | 路由 |
| --- | --- |
| Landing Page | `/#/` |
| 課程地圖 | `/#/learn` |
| 程式骨架、變數與運算 | `/#/learn/variables/basics` |
| `if` 與 `else` | `/#/learn/conditionals/if-else` |
| `for` 迴圈實驗室 | `/#/learn/loops/for` |

## 本機使用

需先安裝 [Node.js 24](https://nodejs.org/) 與 npm，然後在專案目錄執行：

```bash
npm ci
npm run dev
```

終端機會顯示本機預覽網址。若要檢查正式建置結果：

```bash
npm run build
npm run preview
```

Vite 的正式網站基礎路徑已設定為 `/WoiZhiCheng_Learn_C_Programming/`。

## 品質檢查與測試

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

- `lint`：檢查程式碼風格與常見錯誤。
- `typecheck`：執行 TypeScript 型別檢查。
- `test`：執行 Vitest 單元與元件測試。
- `build`：建立可發布的 `dist/` 靜態網站。

## GitHub Pages 發布

`.github/workflows/deploy.yml` 會在以下情況自動執行：

- 推送到 `main` 分支。
- 從 GitHub Actions 頁面手動執行 `workflow_dispatch`。

流程會依序安裝鎖定版本的相依套件、執行 lint、型別檢查、測試與正式建置，接著將 `dist/` 上傳並部署至 GitHub Pages。首次發布前，請在儲存庫的 **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**。

## 隱私與安全

- 網站是純前端靜態應用，不需要登入，也沒有後端服務。
- 不收集、上傳或分析學生的個人資料，不使用追蹤 Cookie。
- 學習進度與最後使用的參數只保存在目前瀏覽器的 `localStorage`，可由網站中的清除進度功能移除。
- 變數運算與迴圈結果都由受限制的瀏覽器端模擬器產生；網站不編譯或執行使用者輸入的任意 C 程式碼。

## 技術

React、TypeScript、Vite、Motion、React Router、Vitest 與 Testing Library。

## 授權

本專案採用 [MIT License](./LICENSE)。Copyright © 2026 魏志成。
