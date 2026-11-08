# 魏志成的程式設計基礎學習網站

一個為 C 語言初學者設計的互動式學習網站。學生可以先預測結果、調整參數，再逐步觀察程式碼、記憶體與輸出如何同步改變，把抽象的程式流程變成看得見的過程。

**線上網站：** [https://woizhicheng0309.github.io/WoiZhiCheng_Learn_C_Programming/](https://woizhicheng0309.github.io/WoiZhiCheng_Learn_C_Programming/)

## 特色

- 「程式骨架、變數與運算」單元：預測 `int`／`double` 算式、觀察 `x`、`y`、`result` 記憶盒，並練習宣告、賦值與整數除法。
- 「switch、case 與 break」單元：觀察入口匹配、default 與省略 break 的 fall-through 流程。
- 「條件判斷」單元：比較分數與出席率，逐步觀察 `if`／`else`、`&&`／`||` 與短路如何決定分支。
- `for` 迴圈實驗室：調整起始值、終止值、比較運算子與步進值，追蹤到最後一次條件為 `false` 的判斷。
- 「while 與 do…while」單元：切換先判斷與後判斷的流程，觀察起始條件為假時的零次／一次執行差別，並辨識沒有更新變數的迴圈風險。
- 「break 與 continue」單元：比較直接離開迴圈與跳過本次剩餘步驟，追蹤 `for` 的更新式，以及輸出與累加總和的差別。
- 巢狀迴圈乘法表：調整外層與內層上限，逐格觀察 `i × j` 如何產生最多 12 × 12 的乘法表。
- 「遞迴與呼叫堆疊」單元：以階乘追蹤獨立呼叫框架、終止條件，以及逐層回傳與計算。
- 「函式、參數與回傳值」單元：調整呼叫端引數，逐步追蹤參數綁定、區域變數與回傳值如何流動。
- 「結構與成員存取」單元：以 struct 組合不同型別的成員，比較完整、部分與指定初始化，以及兩份結構物件的獨立修改。
- 「結構陣列與逐筆統計」單元：以索引選取結構元素、更新成員，逐筆加總分數、統計達標人數，並追蹤索引與作用域界線。
- 「指向結構的指標」單元：比較箭頭與解參照成員存取，追蹤指標複製、共用物件、改指向，以及 NULL 時略過修改的分支。
- 「動態記憶體配置與釋放」單元：比較 malloc 與 calloc 的初始內容，追蹤配置失敗、先寫入再讀取、free 及指標改寫的完整生命週期。
- 「指標與 const」單元：比較四種宣告，追蹤透過指標改值、改指向與原變數的直接修改，並在 const 違規時於執行前停止。
- 「字串比較與 strcmp」單元：逐字追蹤第一個不同位置、前綴與空字元，交換左右字串，並區分手寫比較的數值與 strcmp 的結果符號。
- 「陣列作為函式參數」單元：比較唯讀加總與原地修改，追蹤兩個呼叫框架如何共用同一組陣列，以及明確傳入 count 的原因。
- 「字串長度與安全複製」單元：對照 strlen、sizeof 與目的容量，逐格複製含結尾空字元的內容，並在容量不足時拒絕複製。
- 「氣泡排序與提前結束」單元：追蹤相鄰交換、右側有序區段與每輪交換旗標，切換提前結束比較執行輪數與元素比較次數。
- 「插入排序與右移」單元：暫存 key、右移元素並追蹤有序前綴，觀察短路判斷如何避免負索引存取。
- 「選擇排序與交換」單元：切換升冪、降冪與不同資料，追蹤候選索引、三步交換、已排序區段與比較次數。
- 「二分搜尋與區間縮小」單元：在有序陣列中追蹤 left、right、mid，理解區間排除、找不到及空區間的終止流程。
- 「線性搜尋與提前結束」單元：比較第一筆與最後一筆搜尋，追蹤索引、重複值、比較次數與 -1 找不到標記。
- 「二維陣列與巢狀走訪」單元：比較逐列與逐欄讀取，對照列欄索引、元素偏移及 C 的逐列記憶體排列。
- 「陣列、索引與字串」單元：追蹤五格陣列的宣告、讀取與改寫，辨識越界索引，並看見 C 字串尾端的 `\0`。
- 「指標、位址與間接存取」單元：讓 `p` 指向 `x` 或 `y`，觀察 `&` 取址與 `*p` 讀寫原變數的流程，並辨識 NULL 解參照的未定義行為；畫面中的位址僅為教學示意。
- 「指標參數與交換變數」單元：比較交換區域副本與透過指標交換原變數，追蹤 `main` 與 `swap` 呼叫框架、位址副本及 `temp` 暫存值；C 的參數一律傳值。
- 「陣列與指標走訪」單元：比較 `scores[i]` 與指標 `*p` 的逐項讀取，觀察 `p++` 前進一個元素，並在尾端下一格解參照前停止，保留先前合法讀取的輸出。
- 「字串與字元指標」單元：以 `CODE`、`C0DE` 與內嵌空字元的範例追蹤 `char *`，分辨 `'0'` 與 `'\0'`，並比較停止條件如何影響輸出與長度。
- 共用播放、暫停、單步與重設流程，並可切換 `0.5×`、`1×`、`2×` 速度。
- 同步呈現目前執行的 C 程式碼片段、中文解釋、變數狀態、追蹤資料與 `printf` 輸出。
- 主動辨識 `step = 0`、步進方向錯誤與超過 100 次迭代等風險，不會執行任意 C 程式碼。
- 每個已開放單元各有三道挑戰；進度使用版本化資料保存在瀏覽器，舊版 `for` 進度會自動遷移。
- 支援鍵盤操作、清楚焦點、手機版介面與「減少動態效果」系統設定。
- 互動單元依頁面載入；等待下載時顯示提示，載入失敗時可保留已儲存的進度並重新載入，換頁後焦點會等到標題出現再移動。
- 課程地圖依「主題 → 單元」呈現變數、條件、迴圈、函式、陣列與字串、指標、結構與自訂型別、動態記憶體；目前開放二十七個單元，共八十一道挑戰。

## 網站路由

網站使用 Hash Router，確保 GitHub Pages 重新整理後仍能正確開啟頁面。

| 頁面 | 路由 |
| --- | --- |
| Landing Page | `/#/` |
| 課程地圖 | `/#/learn` |
| 程式骨架、變數與運算 | `/#/learn/variables/basics` |
| `if` 與 `else` | `/#/learn/conditionals/if-else` |
| switch、case 與 break | `/#/learn/conditionals/switch` |
| `for` 迴圈實驗室 | `/#/learn/loops/for` |
| while 與 do…while | `/#/learn/loops/while-do-while` |
| break 與 continue | `/#/learn/loops/break-continue` |
| 函式、參數與回傳值 | `/#/learn/functions/basics` |
| 遞迴與呼叫堆疊 | `/#/learn/functions/recursion` |
| 陣列、索引與字串 | `/#/learn/arrays/basics` |
| 二維陣列與巢狀走訪 | `/#/learn/arrays/matrices` |
| 線性搜尋與提前結束 | `/#/learn/arrays/search` |
| 二分搜尋與區間縮小 | `/#/learn/arrays/binary-search` |
| 選擇排序與交換 | `/#/learn/arrays/selection-sort` |
| 插入排序與右移 | `/#/learn/arrays/insertion-sort` |
| 氣泡排序與提前結束 | `/#/learn/arrays/bubble-sort` |
| 字串長度與安全複製 | `/#/learn/arrays/string-copy` |
| 字串比較與 strcmp | `/#/learn/arrays/string-comparison` |
| 指標、位址與間接存取 | `/#/learn/pointers/basics` |
| 指標參數與交換變數 | `/#/learn/pointers/swap` |
| 陣列與指標走訪 | `/#/learn/pointers/traversal` |
| 字串與字元指標 | `/#/learn/pointers/strings` |
| 陣列作為函式參數 | `/#/learn/pointers/array-parameters` |
| 指標與 const | `/#/learn/pointers/const` |
| 結構與成員存取 | `/#/learn/structures/basics` |
| 結構陣列與逐筆統計 | `/#/learn/structures/arrays` |
| 指向結構的指標 | `/#/learn/structures/pointers` |
| 動態記憶體配置與釋放 | `/#/learn/memory/allocation` |

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
- 變數運算、條件判斷、迴圈、函式、陣列、指標、結構與動態記憶體結果都由受限制的瀏覽器端模擬器產生；網站不編譯或執行使用者輸入的任意 C 程式碼。

## 技術

React、TypeScript、Vite、Motion、React Router、Vitest 與 Testing Library。

## 授權

本專案採用 [MIT License](./LICENSE)。Copyright © 2026 魏志成。
