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
 * 模型遞補清單（依序嘗試，第一個成功就回傳）。
 *
 * 為什麼需要清單而不是單一模型——2026-09-17 實測發現兩種故障：
 *   1. gemini-2.0-flash 回傳 404「no longer available」，Google 已停止提供
 *   2. gemini-3.8-flash（9/2 才發布）頻繁回傳 503「experiencing high demand」，
 *      實測 5 次只成功 2 次，批次掃描會一直失敗
 * 單押任何一個模型都不可靠，因此改為自動遞補：
 * 遇到 404（模型消失）、503/500（過載）、429（限頻）就換下一個，使用者無感。
 *
 * 可用 Vercel 環境變數 GEMINI_MODEL 覆寫（逗號分隔，依優先順序）。
 * 例：GEMINI_MODEL=gemini-3.8-flash,gemini-3.6-flash
 */
const MODEL_CHAIN: string[] = (
  process.env.GEMINI_MODEL || 'gemini-3.6-flash,gemini-3.8-flash,gemini-3.5-flash'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// 總預算 18 秒，比前端的 25 秒短，確保前端一定收得到伺服器的錯誤訊息而非自己逾時
// 時間預算依 2026-09-17 實測數據調整：
//   成功的辨識耗時 5.4～9.0 秒，原本單次 12 秒上限太緊——第一個模型一旦卡住，
//   剩餘預算只夠 6 秒，第二個模型等於沒機會，結果全部落到逾時。
//   改為單次 16 秒（涵蓋實測最慢值再加一倍餘裕），總預算 34 秒可容納兩次完整嘗試。
const TOTAL_BUDGET_MS = 34000; // 比前端的 40 秒短，確保前端一定收得到伺服器訊息
const PER_ATTEMPT_MS = 16000; // 單一模型最多等 16 秒
const MIN_ATTEMPT_MS = 6000; // 剩餘不足 6 秒就不再嘗試下一個，避免註定失敗的空轉

// 這些狀態碼代表「這個模型現在不能用」，換下一個還有機會成功。
// 其他錯誤（400 圖片格式錯誤、403 金鑰無效）換模型也沒用，直接回報。
const RETRYABLE = new Set([404, 429, 500, 502, 503, 504]);

async function callGemini(
  model: string,
  apiKey: string,
  requestBody: unknown,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      }
    );
  } finally {
    clearTimeout(timeoutId);
  }
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
    },
  };

  const startedAt = Date.now();
  const tried: string[] = [];
  let lastStatus = 500;
  let lastError = '未知錯誤';

  for (const model of MODEL_CHAIN) {
    const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
    if (remaining < MIN_ATTEMPT_MS) break; // 時間不夠了，別讓前端等到自己逾時

    tried.push(model);

    try {
      const response = await callGemini(
        model,
        apiKey,
        requestBody,
        Math.min(remaining, PER_ATTEMPT_MS)
      );

      if (response.ok) {
        const data: any = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
          lastStatus = 502;
          lastError = `模型 ${model} 未回傳內容`;
          continue; // 換下一個模型試試
        }

        // 只回傳 AI 產生的 JSON 字串，所有欄位對應與和曆換算仍由前端處理。
        // 一併回傳 model 方便日後除錯：可以知道實際是哪個模型辨識的。
        res.status(200).json({ text, model, tried });
        return;
      }

      const errorData: any = await response.json().catch(() => ({}));
      lastStatus = response.status;
      lastError = errorData?.error?.message || response.statusText;

      // 不是「換個模型就可能好」的錯誤，繼續試也是浪費時間，直接回報
      if (!RETRYABLE.has(response.status)) break;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        lastStatus = 504;
        lastError = `模型 ${model} 回應逾時`;
        continue; // 這個模型太慢，換下一個
      }
      lastStatus = 500;
      lastError = err?.message || '伺服器端發生未預期錯誤';
      break; // 網路層錯誤，換模型無濟於事
    }
  }

  res.status(lastStatus).json({
    error: `Gemini API 錯誤: ${lastError}`,
    tried, // 讓前端／除錯時看得出試過哪些模型
  });
}
