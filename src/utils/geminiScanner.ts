import type { Receipt, CategoryType, ReceiptItem } from '../types/receipt';

// The system prompt explicitly following the user's latest instructions
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

function normalizeJapaneseReceiptDate(rawDateStr: string | undefined): string {
  if (!rawDateStr) return '';

  let s = rawDateStr.trim();

  // Convert Reiwa (令和 / R) mathematically: 令和 N 年 -> (2018 + N) 年
  s = s.replace(/^(?:令和|令|R|r)\s*0?(\d{1,2})[年/.\-]/, (_, reiwaYear) => {
    const year = 2018 + parseInt(reiwaYear, 10);
    return `${year}年`;
  });

  // Convert Heisei (平成 / H) mathematically: 平成 N 年 -> (1988 + N) 年
  s = s.replace(/^(?:平成|平|H|h)\s*0?(\d{1,2})[年/.\-]/, (_, heiseiYear) => {
    const year = 1988 + parseInt(heiseiYear, 10);
    return `${year}年`;
  });

  // Match standard YYYY年MM月DD日
  const match = s.match(/(\d{4})[年/.\-](\d{1,2})[月/.\-](\d{1,2})/);
  if (match) {
    const year = match[1];
    const month = String(parseInt(match[2], 10)).padStart(2, '0');
    const day = String(parseInt(match[3], 10)).padStart(2, '0');
    const timeMatch = s.match(/\d{1,2}:\d{2}/);
    const timeStr = timeMatch ? ` ${timeMatch[0]}` : '';
    return `${year}年${month}月${day}日${timeStr}`;
  }

  return s;
}

export async function scanReceiptWithGemini(
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<Partial<Receipt> & { hasUnreadable?: boolean; unreadableNotes?: string }> {
  // Read API Key from .env file
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('未設定 API Key！請在專案根目錄建立 .env 檔案，並填入 VITE_GEMINI_API_KEY=您的金鑰');
  }

  // Strip data URL prefix if present
  const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

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
      responseMimeType: "application/json",
      temperature: 0.1, // Low temperature for factual extraction
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 寬鬆 25 秒超時

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('網路連線回應超時（超過 25 秒無回應）');
    }
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Gemini API 錯誤: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textResponse) {
    throw new Error('無法從 AI 取得有效回應');
  }

  try {
    const result = JSON.parse(textResponse);
    
    // Process items
    const items: ReceiptItem[] = (result.items || []).map((it: any, idx: number) => ({
      id: `ai-item-${Date.now()}-${idx}`,
      nameJp: it.nameJp || '未知名稱',
      nameZh: it.nameZh || '未知名稱',
      category: it.category || result.主要分類 || '其他',
      quantity: Number(it.quantity) || 1,
      unitPriceJpy: Number(it.unitPriceJpy) || 0,
      totalJpy: Number(it.totalJpy) || 0,
    }));

    const rawDate = result.日期與時間 || result.日期;
    const finalDate = normalizeJapaneseReceiptDate(rawDate);

    return {
      id: `rcpt-${Date.now()}`,
      storeNameJp: result.店名_日文 || '不明店家',
      storeNameZh: result.店名_繁中 || '未知名店家',
      address: '',
      date: finalDate,
      category: (result.主要分類 as CategoryType) || '其他',
      items,
      itemCount: items.reduce((acc, it) => acc + (it.quantity || 1), 0),
      subtotalJpy: Number(result.總金額_JPY) || items.reduce((acc, it) => acc + it.totalJpy, 0),
      taxJpy: Number(result.稅額_JPY) || 0,
      discountJpy: 0,
      totalJpy: Number(result.總金額_JPY) || items.reduce((acc, it) => acc + it.totalJpy, 0),
      hasUnreadable: result.信心程度 === '低' || result.店名_日文 === null || result.總金額_JPY === null,
      unreadableNotes: result.無法辨識原因 || '',
      country: 'Japan',
      createdAt: Date.now(),
    };
  } catch (error) {
    throw new Error('無法將 AI 回應解析為記帳格式，請確認圖片是否清晰。');
  }
}
