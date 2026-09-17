import type { Receipt, CategoryType, ReceiptItem } from '../types/receipt';

/**
 * 【安全性說明】
 * 這支檔案「不再持有 API Key」。
 *
 * 舊版是在前端直接讀 import.meta.env.VITE_GEMINI_API_KEY 呼叫 Gemini，
 * 而 Vite 會把 VITE_ 開頭的變數在建置時直接寫死進前端 JS，
 * 等於把金鑰公開在網路上，任何人按 F12 都能抄走。
 *
 * 現在改為 POST 到自家的 /api/scan（Vercel Serverless Function），
 * 由伺服器端持有金鑰並代為呼叫 Gemini。
 * 金鑰永遠不會出現在瀏覽器裡，SYSTEM_PROMPT 也一併移到 api/scan.ts。
 */

// 伺服器端最多花 34 秒（會依序嘗試多個 Gemini 模型），這裡留 6 秒餘裕。
// 寧可多等幾秒拿到結果，也不要在伺服器還在努力時就自己放棄。
const CLIENT_TIMEOUT_MS = 40000;

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
  // 去除 data URL 前綴，只留純 base64
  const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data, mimeType }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      throw new Error('網路連線回應超時（超過 40 秒無回應）');
    }
    throw err;
  }

  if (!response.ok) {
    const errorData: any = await response.json().catch(() => ({}));
    // 保留原始狀態碼，讓上層的 429 限頻冷卻重試邏輯仍能正確判斷
    const err: any = new Error(errorData?.error || `辨識服務回應異常 (${response.status})`);
    err.status = response.status;
    throw err;
  }

  const payload: any = await response.json();
  const textResponse: string | undefined = payload?.text;

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
  } catch {
    throw new Error('無法將 AI 回應解析為記帳格式，請確認圖片是否清晰。');
  }
}
