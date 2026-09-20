/**
 * Vercel Serverless Function — 發票辨識代理
 *
 * 【為什麼需要這支檔案】
 * 過去前端直接用 import.meta.env.VITE_GEMINI_API_KEY 呼叫 Gemini，
 * Vite 會在建置時把金鑰字串直接寫進前端 JS，任何人按 F12 都能抄走。
 *
 * 改成由這支伺服器端函式代為呼叫後，金鑰只存在 Vercel 後台的環境變數裡，
 * 永遠不會被打包進前端 bundle，也不會出現在瀏覽器的任何一個檔案中。
 *
 * 【環境變數】
 * 請在 Vercel 後台設定 GEMINI_API_KEY（注意：沒有 VITE_ 前綴，這很重要）。
 */

const SYSTEM_PROMPT = `
你是日文收據辨識助手。請只根據「本次傳入的這張圖片」進行辨識,不要參考任何先前的對話或圖片。

請仔細辨識圖片中的所有日文文字，包含店名、日期時間、每個品項名稱(單價/數量/小計)、總金額。

【日期與時間解析特別要求】
請如實辨識收據上的實際日期與時間，切勿隨意修改或強制蓋掉照片上的年份：
1. 若收據印有日本和曆（如 令和8年 / R8 / 平成31年），請依據公曆公式正確換算為對應西元年份（例如：令和8年 = 2026年, 令和7年 = 2025年, 令和6年 = 2024年）。
2. 若收據印有西元年份（如 2024年、2025年、2026年），請如實完整輸出。
3. 輸出格式請為 "YYYY年MM月DD日 HH:mm"。若收據無印時間僅有日期，時間部分可省略。

【翻譯特別要求】
繁體中文翻譯請盡量貼近「台灣人常用的商品名稱與習慣用語」，翻譯必須通順自然，像是真實包裝上的商品名。例如：'つまんで' 可翻譯為 '一口' 或 '隨手包'；'カリッと' 可翻譯為 '酥脆' 等。不要死板直譯。

【分類特別要求】
若品項為「食品、點心、糖果餅乾」類的伴手禮（例如名稱含有「お土産(食品)」或「菓子」），請務必將其分類為「零食」或「吃飯」，**絕對不要**分類為「紀念品」。紀念品僅限於非食品類的實體紀念小物（如鑰匙圈、明信片、御守等）。

請辨識並輸出以下欄位(嚴格的 JSON 格式，不可包含 markdown 標籤或 \`\`\`json 等字眼)：
{
  "店名_日文": "日文原文",
  "店名_繁中": "中文翻譯，保留品牌名",
  "日期與時間": "YYYY年MM月DD日 HH:mm",
  "總金額_JPY": 0,
  "稅額_JPY": 0,
  "主要分類": "藥品 或 零食 或 生活用品 或 吃飯 或 交通 或 御守 或 紀念品 或 其他",
  "信心程度": "高/中/低 (若圖片模糊或有疑慮請標示低並說明原因)",
  "無法辨識原因": "如果有請填寫，沒有則留空",
  "items": [
    {
      "nameJp": "日文品項名",
      "nameZh": "繁體中文翻譯",
      "category": "藥品 或 零食 或 生活用品 或 吃飯 或 交通 或 御守 或 紀念品 或 其他",
      "quantity": 1,
      "unitPriceJpy": 100,
      "totalJpy": 100
    }
  ]
}

若圖片內容無法辨識清楚,總金額或店名請填 null,並在「信心程度」與「無法辨識原因」欄位說明原因,不要用其他收據的內容替代或猜測。
`;

/**
 * 模型清單（並行競速，最快回來的那個勝出，詳見下方說明）。
 *
 * 為什麼需要清單而不是單一模型——2026-09-17 實測發現兩種故障：
 *   1. gemini-2.0-flash 回傳 404「no longer available」，Google 已停止提供
 *   2. gemini-3.8-flash（9/2 才發布）頻繁回傳 503「experiencing high demand」，
 *      實測 5 次只成功 2 次，批次掃描會一直失敗
 * 單押任何一個模型都不可靠，所以同時問多個，誰活著誰回答。
 *
 * 可用 Vercel 環境變數 GEMINI_MODEL 覆寫（逗號分隔）。
 * 只填一個就等於退回單發模式，不會並行。
 * 例：GEMINI_MODEL=gemini-3.6-flash
 */
const MODEL_CHAIN: string[] = (
  process.env.GEMINI_MODEL ||
  // flash-lite 是 Google 目前最快的一檔，排最前面；
  // 萬一它不支援圖片輸入，在並行競速下只是輸掉這一局，不影響其他模型，等於零風險。
  'gemini-3.5-flash-lite,gemini-3.6-flash,gemini-3.8-flash,gemini-3.5-flash'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * 【為什麼改成並行競速】
 *
 * 舊版是「一個一個試」，總耗時是各次的「總和」：
 *   gemini-3.6 失敗 2s → gemini-3.8 失敗 2s → gemini-3.5 跑 30s ＝ 共 34 秒
 * 實測最慢到 34.7 秒，使用者等到不耐煩，前端也容易逾時。
 *
 * 現在改成同時發送給清單上所有模型，誰先回來就用誰，其餘立刻中止。
 * 總耗時從「總和」變成「最快的那一個」：上例變成 30 秒，而當 3.6 順利時只要 6～13 秒。
 *
 * 額外的 API 用量其實很有限——排前面的模型多半在 1～2 秒內就 503 失敗，
 * 真正同時「成功」的情況很少見。若日後擔心配額，把 GEMINI_MODEL 設成單一模型
 * 即可退回單發模式（清單只有一個時就沒有並行）。
 */
const TOTAL_BUDGET_MS = 50000; // 比前端的 56 秒短，確保前端一定收得到伺服器訊息

type ScanWin = { text: string; model: string; ms: number };

/**
 * 對單一模型發出請求。成功回傳辨識文字，失敗一律 throw（讓 Promise.any 去挑成功的那個）。
 * signal 由外部統一控制，這樣一有人成功就能立刻中止其他還在跑的請求。
 */
async function askModel(
  model: string,
  apiKey: string,
  requestBody: unknown,
  fallbackBody: unknown,
  signal: AbortSignal,
  startedAt: number
): Promise<ScanWin> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const post = (payload: unknown) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });

  let response = await post(requestBody);

  // 若這個模型不接受 thinkingConfig（400），改用不含該欄位的請求重試一次
  if (response.status === 400) {
    const probe: any = await response.clone().json().catch(() => ({}));
    if (String(probe?.error?.message || '').toLowerCase().includes('thinking')) {
      response = await post(fallbackBody);
    }
  }

  if (!response.ok) {
    const errorData: any = await response.json().catch(() => ({}));
    const err: any = new Error(errorData?.error?.message || response.statusText);
    err.status = response.status;
    err.model = model;
    throw err;
  }

  const data: any = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    const err: any = new Error(`模型 ${model} 未回傳內容`);
    err.status = 502;
    err.model = model;
    throw err;
  }

  return { text, model, ms: Date.now() - startedAt };
}

// Vercel 免費方案單次函式最長可跑 60 秒；需大於 TOTAL_BUDGET_MS 才不會被平台中途砍斷
export const config = {
  maxDuration: 60,
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: '此端點只接受 POST 請求' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: '伺服器尚未設定 GEMINI_API_KEY 環境變數，請於 Vercel 後台 Settings → Environment Variables 新增。',
    });
    return;
  }

  // Vercel 通常已自動解析 JSON body，但本機 dev 中介層送來的可能是字串，兩種都接
  let body: any = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: '請求內容不是合法的 JSON' });
      return;
    }
  }

  const rawImage: string | undefined = body?.base64Data;
  const mimeType: string = body?.mimeType || 'image/jpeg';

  if (!rawImage) {
    res.status(400).json({ error: '請求缺少 base64Data 欄位' });
    return;
  }

  // 若前端誤傳完整的 data URL（data:image/jpeg;base64,xxx），這裡再保險去掉前綴
  const base64Data = rawImage.includes(',') ? rawImage.split(',')[1] : rawImage;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: SYSTEM_PROMPT },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1, // 低溫度，事實抽取不需要創意

      /**
       * 【這是長收據會逾時的真正原因】
       *
       * Gemini 3.x 的 Flash 模型預設開啟「思考模式」（thinkingLevel 預設 medium），
       * 回答前會先在內部推理一輪。品項越多想得越久，19 品項的長收據因此動輒 30 秒以上。
       *
       * 舊的 gemini-2.0-flash 沒有這個機制，所以當年 0.8 秒就回來——
       * 慢下來的不是我們的程式，是換模型後多了這段思考。
       *
       * 收據辨識是「照著念」的抽取工作，不需要推理，設成 low 可大幅降低延遲。
       * 註：Gemini 3 Flash 無法完全關閉思考，low 已是最低檔。
       */
      thinkingConfig: {
        thinkingLevel: 'low',
      },
    },
  };

  // 萬一某個模型不認得 thinkingConfig（回 400），用這份不含該欄位的請求重試一次，
  // 確保不會因為一個相容性問題讓整個辨識功能掛掉。
  const fallbackBody = {
    ...requestBody,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  };

  const startedAt = Date.now();

  // 同時發給清單上所有模型，誰先成功就用誰，其餘立刻中止
  const controller = new AbortController();
  const budgetTimer = setTimeout(() => controller.abort(), TOTAL_BUDGET_MS);

  const attempts = MODEL_CHAIN.map((model) =>
    askModel(model, apiKey, requestBody, fallbackBody, controller.signal, startedAt)
  );

  try {
    const winner = await Promise.any(attempts);
    clearTimeout(budgetTimer);
    controller.abort(); // 中止其他還在跑的請求，不浪費配額

    // 只回傳 AI 產生的 JSON 字串，所有欄位對應與和曆換算仍由前端處理。
    // model／ms 方便除錯：看得出是哪個模型贏、花了多久。
    res.status(200).json({ text: winner.text, model: winner.model, ms: winner.ms, tried: MODEL_CHAIN });
    return;
  } catch (aggregate: any) {
    clearTimeout(budgetTimer);
    controller.abort();

    // Promise.any 全數失敗時給的是 AggregateError，把每個模型的原因整理出來
    const errors: any[] = aggregate?.errors || [aggregate];
    const details = errors.map((e: any) => `${e?.model || '?'}: ${e?.message || e?.name || '未知'}`);

    // 若有「換模型也沒用」的錯誤（金鑰無效、圖片格式錯），優先用它的狀態碼回報
    const hard = errors.find((e: any) => e?.status && ![404, 429, 500, 502, 503, 504].includes(e.status));
    const aborted = errors.some((e: any) => e?.name === 'AbortError');

    const status = hard?.status || (aborted ? 504 : errors[0]?.status || 500);
    const message = hard
      ? hard.message
      : aborted
        ? `所有模型都在 ${TOTAL_BUDGET_MS / 1000} 秒內沒有回應`
        : details.join('；');

    res.status(status).json({
      error: `Gemini API 錯誤: ${message}`,
      tried: MODEL_CHAIN,
      details,
    });
  }
}
