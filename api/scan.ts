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

const GEMINI_MODEL = 'gemini-2.0-flash';
const SERVER_TIMEOUT_MS = 20000; // 伺服器端 20 秒，比前端的 25 秒短，讓前端一定收得到錯誤訊息

// Vercel 免費方案單次函式最長可跑 60 秒，這裡設 30 秒已綽綽有餘
export const config = {
  maxDuration: 30,
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData: any = await response.json().catch(() => ({}));
      // 把 Google 的原始狀態碼原封不動往前端送，前端才能正確處理 429 限頻重試
      res.status(response.status).json({
        error: `Gemini API 錯誤: ${errorData?.error?.message || response.statusText}`,
      });
      return;
    }

    const data: any = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      res.status(502).json({ error: '無法從 AI 取得有效回應' });
      return;
    }

    // 只回傳 AI 產生的 JSON 字串，所有欄位對應與和曆換算仍由前端處理
    res.status(200).json({ text });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      res.status(504).json({ error: '辨識逾時（伺服器等待超過 20 秒）' });
      return;
    }
    res.status(500).json({ error: err?.message || '伺服器端發生未預期錯誤' });
  }
}
