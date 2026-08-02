import React, { useState } from 'react';
import type { Receipt, ReceiptItem, CategoryType } from '../types/receipt';
import { CATEGORIES, CATEGORY_METAS } from '../types/receipt';
import { calcTWD, formatTWD } from '../utils/currency';
import { scanReceiptWithGemini } from '../utils/geminiScanner';
import confetti from 'canvas-confetti';
import { UploadCloud, Camera, X, AlertTriangle, PenTool, Plus, Trash2, Calendar, Store, Tag } from 'lucide-react';

interface ReceiptUploadModalProps {
  exchangeRate: number;
  onClose: () => void;
  onAddReceipt: (newReceipt: Receipt | Receipt[]) => void;
}

interface FailedError {
  index: number;
  fileName: string;
  reason: string;
}

export const ReceiptUploadModal: React.FC<ReceiptUploadModalProps> = ({
  exchangeRate,
  onClose,
  onAddReceipt,
}) => {
  const [activeTab, setActiveTab] = useState<'scan' | 'manual'>('scan');
  const [isScanning, setIsScanning] = useState(false);
  const [failedErrors, setFailedErrors] = useState<FailedError[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Manual Form States
  const [manualStoreJp, setManualStoreJp] = useState('');
  const [manualStoreZh, setManualStoreZh] = useState('');
  const [manualCategory, setManualCategory] = useState<CategoryType>('零食');
  const [manualDate, setManualDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${y}年${m}月${d}日 ${hh}:${mm}`;
  });
  const [manualTotalJpy, setManualTotalJpy] = useState<string>('');
  const [manualItems, setManualItems] = useState<{ nameJp: string; nameZh: string; qty: number; price: number }[]>([
    { nameJp: '', nameZh: '', qty: 1, price: 0 }
  ]);

  const handleAddManualItemRow = () => {
    setManualItems(prev => [...prev, { nameJp: '', nameZh: '', qty: 1, price: 0 }]);
  };

  const handleRemoveManualItemRow = (idx: number) => {
    setManualItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleManualItemChange = (idx: number, field: string, value: any) => {
    setManualItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleSaveManualReceipt = () => {
    const totalJpyNum = parseFloat(manualTotalJpy) || 0;
    const computedItemsTotal = manualItems.reduce((acc, it) => acc + (it.qty * it.price), 0);
    const finalTotalJpy = totalJpyNum > 0 ? totalJpyNum : computedItemsTotal;

    if (finalTotalJpy <= 0) {
      alert('請輸入有效的金額 (JPY)！');
      return;
    }

    const storeJp = manualStoreJp.trim() || '手動記帳';
    const storeZh = manualStoreZh.trim() || '無發票消費';

    const validItems: ReceiptItem[] = manualItems
      .filter(it => it.nameJp.trim() || it.nameZh.trim() || it.price > 0)
      .map((it, idx) => ({
        id: `manual-item-${Date.now()}-${idx}`,
        nameJp: it.nameJp.trim() || storeJp,
        nameZh: it.nameZh.trim() || storeZh,
        category: manualCategory,
        quantity: it.qty || 1,
        unitPriceJpy: it.price || (finalTotalJpy / (manualItems.length || 1)),
        totalJpy: (it.qty || 1) * (it.price || (finalTotalJpy / (manualItems.length || 1))),
      }));

    const finalReceiptItems: ReceiptItem[] = validItems.length > 0 ? validItems : [
      {
        id: `manual-item-${Date.now()}-default`,
        nameJp: storeJp,
        nameZh: storeZh,
        category: manualCategory,
        quantity: 1,
        unitPriceJpy: finalTotalJpy,
        totalJpy: finalTotalJpy,
      }
    ];

    const newReceipt: Receipt = {
      id: `rcpt-manual-${Date.now()}`,
      storeNameJp: storeJp,
      storeNameZh: storeZh,
      branchName: '',
      address: '',
      country: 'Japan',
      date: manualDate,
      category: manualCategory,
      items: finalReceiptItems,
      itemCount: finalReceiptItems.reduce((acc, it) => acc + (it.quantity || 1), 0),
      subtotalJpy: finalTotalJpy,
      taxJpy: 0,
      discountJpy: 0,
      totalJpy: finalTotalJpy,
      imageUrl: '', // 無發票手動記帳
      createdAt: Date.now(),
    };

    onAddReceipt(newReceipt);
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    onClose();
  };

  const [statusMessage, setStatusMessage] = useState<string>('');
  const shouldCancelRef = React.useRef(false);

  // Image compressor for scan mode (Max 600px, 0.5 quality for lightning-fast mobile upload)
  const compressImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600;
          const MAX_HEIGHT = 600;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.5)); 
        };
        img.onerror = () => reject(new Error('圖片讀取失敗'));
        img.src = e.target?.result as string;
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setIsScanning(true);
      setFailedErrors([]);
      shouldCancelRef.current = false;
      setProgress({ current: 0, total: files.length });

      const newReceipts: Receipt[] = [];
      let hasError = false;

      for (let i = 0; i < files.length; i++) {
        if (shouldCancelRef.current) break;

        const file = files[i];
        setProgress({ current: i + 1, total: files.length });
        setStatusMessage(`正在辨識第 ${i + 1} / ${files.length} 張（${file.name}）...`);

        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
        
        try {
          const base64 = await compressImageToBase64(file);
          if (shouldCancelRef.current) break;
          
          let result;
          try {
            result = await scanReceiptWithGemini(base64, 'image/jpeg');
          } catch (firstErr: any) {
            const msg = firstErr?.message || '';
            if (msg.includes('quota') || msg.includes('Quota') || msg.includes('429') || msg.includes('exceeded')) {
              setStatusMessage(`頻率過高，自動冷卻中 (${i + 1}/${files.length})...`);
              await new Promise(resolve => setTimeout(resolve, 3000));
              if (shouldCancelRef.current) break;
              result = await scanReceiptWithGemini(base64, 'image/jpeg');
            } else {
              throw firstErr;
            }
          }
          
          newReceipts.push({
            id: `rcpt-${Date.now()}-${i}`,
            storeNameJp: result.storeNameJp || '不明店家',
            storeNameZh: result.storeNameZh || '未知名店家',
            branchName: '',
            address: '',
            country: 'Japan',
            date: result.date || new Date().toLocaleString('zh-TW'),
            category: result.category || '其他',
            items: result.items || [],
            itemCount: result.items?.length || 1,
            subtotalJpy: (result.totalJpy || 0) - (result.taxJpy || 0),
            taxJpy: result.taxJpy || 0,
            discountJpy: 0,
            totalJpy: result.totalJpy || 0,
            imageUrl: base64, 
            createdAt: Date.now() + i,
          });
        } catch (err: any) {
          console.error(err);
          hasError = true;
          
          let reason = '辨識失敗';
          const rawMsg = err?.message || '';
          if (rawMsg.includes('超時') || rawMsg.includes('timeout')) {
            reason = '網路連線超時';
          } else if (rawMsg.includes('quota') || rawMsg.includes('Quota') || rawMsg.includes('exceeded') || rawMsg.includes('429')) {
            reason = '超過 API 額度限制';
          } else if (rawMsg.includes('API Key')) {
            reason = 'API Key 設定錯誤';
          } else if (rawMsg.includes('fetch') || rawMsg.includes('network')) {
            reason = '網路連線失敗';
          }

          setFailedErrors(prev => [
            ...prev,
            {
              index: i + 1,
              fileName: file.name,
              reason,
            }
          ]);
        }
      }

      if (newReceipts.length > 0) {
        onAddReceipt(newReceipts);
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        if (!hasError) {
          onClose();
        } else {
          setIsScanning(false);
        }
      } else {
        setIsScanning(false);
      }
    }
  };

  const manualTwdPreview = calcTWD(parseFloat(manualTotalJpy) || 0, exchangeRate);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-slide-up">
        
        {/* Header Bar */}
        <div className="px-5 py-4 border-b border-gray-100 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                {activeTab === 'scan' ? <Camera className="w-4 h-4" /> : <PenTool className="w-4 h-4" />}
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  {activeTab === 'scan' ? 'AI 掃描發票紀錄' : '無發票手動記帳'}
                </h2>
                <p className="text-xs text-gray-400">
                  {activeTab === 'scan' ? '支援一次選取多張發票相片批次掃描！' : '適合自動販賣機、無發票小吃、神社御守等消費'}
                </p>
              </div>
            </div>
            <button onClick={onClose} disabled={isScanning} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 disabled:opacity-50">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Switcher Pills */}
          <div className="flex items-center p-1 bg-gray-100 rounded-xl gap-1">
            <button
              onClick={() => setActiveTab('scan')}
              disabled={isScanning}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'scan' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>📷 AI 相片掃描</span>
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              disabled={isScanning}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'manual' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>✏️ 無發票手動新增</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
          
          {/* TAB 1: AI SCAN MODE */}
          {activeTab === 'scan' && (
            <div className="space-y-4">
              {failedErrors.length > 0 && (
                <div className="w-full bg-rose-50 border border-rose-200 p-4 rounded-2xl flex gap-3 text-rose-800 text-sm shadow-sm">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
                  <div className="w-full">
                    <p className="font-bold mb-2 text-rose-900">部分辨識發生錯誤</p>
                    <div className="space-y-1.5 text-xs max-h-44 overflow-y-auto pr-1">
                      {failedErrors.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white/80 border border-rose-200/60 px-3 py-2 rounded-xl shadow-xs">
                          <span className="font-medium text-gray-800 truncate max-w-[240px]">
                            第 {item.index} 張（{item.fileName}）
                          </span>
                          <span className="text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0">
                            {item.reason}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button 
                      onClick={() => {
                        setFailedErrors([]);
                        if (progress.current === progress.total) {
                          onClose();
                        }
                      }} 
                      className="mt-4 w-full py-2 bg-rose-600 text-white font-bold rounded-xl text-xs hover:bg-rose-700 transition-colors shadow-sm"
                    >
                      關閉返回
                    </button>
                  </div>
                </div>
              )}

              {isScanning ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-5 w-full text-center">
                  <div className="relative w-20 h-20">
                    <div className="absolute inset-0 rounded-full border-4 border-emerald-100"></div>
                    <div 
                      className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"
                      style={{ animationDuration: '1.5s' }}
                    ></div>
                    <div className="absolute inset-0 flex items-center justify-center text-emerald-700 font-extrabold text-sm">
                      {progress.current} / {progress.total}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">AI 智能分析中</h3>
                    <p className="text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 shadow-2xs inline-block max-w-xs truncate">
                      {statusMessage || '正在處理發票資料...'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      shouldCancelRef.current = true;
                      setIsScanning(false);
                    }}
                    className="px-4 py-2 bg-gray-100 hover:bg-rose-50 hover:text-rose-600 text-gray-600 text-xs font-bold rounded-xl transition-colors border border-gray-200"
                  >
                    中途停止 / 取消
                  </button>
                </div>
              ) : failedErrors.length === 0 ? (
                <div className="w-full relative border-2 border-dashed border-emerald-200 hover:border-emerald-500 rounded-2xl p-10 text-center bg-emerald-50/40 transition-colors group cursor-pointer">
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    onChange={handleFileChange} 
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" 
                  />
                  <div className="space-y-4 pointer-events-none">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform shadow-inner">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-gray-800">點擊選取或拖曳日本收據</p>
                      <p className="text-sm font-semibold text-emerald-600 mt-1">支援一次選取多張批次掃描！</p>
                      <p className="text-xs text-gray-400 mt-2">自動轉換台幣、翻譯明細、分類整理</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 2: MANUAL ENTRY MODE */}
          {activeTab === 'manual' && (
            <div className="space-y-4 text-xs">
              
              {/* 店家/名稱 */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                  <Store className="w-4 h-4 text-emerald-600" />
                  <span>消費地點 / 店家名稱</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-gray-400 font-medium block mb-1">繁體中文名稱 (主要顯示)</label>
                    <input
                      type="text"
                      placeholder="例：自販機、路邊攤拉麵、御守授與所"
                      value={manualStoreZh}
                      onChange={(e) => setManualStoreZh(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-emerald-500 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 font-medium block mb-1">日文原文 (選填)</label>
                    <input
                      type="text"
                      placeholder="例：自動販売機、屋台"
                      value={manualStoreJp}
                      onChange={(e) => setManualStoreJp(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-emerald-500 font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* 分類 & 日期 */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                  <Tag className="w-4 h-4 text-emerald-600" />
                  <span>分類與時間</span>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] text-gray-400 font-medium block">選擇分類</label>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map(cat => {
                      const meta = CATEGORY_METAS[cat];
                      const isSelected = manualCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setManualCategory(cat)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                            isSelected
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                              : `${meta.badgeBg} ${meta.badgeText} ${meta.border} hover:opacity-80`
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-1">
                  <label className="text-[11px] text-gray-400 font-medium block mb-1">日期與時間</label>
                  <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
                    <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                    <input
                      type="text"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      className="w-full bg-transparent text-xs font-semibold text-gray-800 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 金額與匯率試算 */}
              <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-100 space-y-2">
                <label className="text-xs font-extrabold text-emerald-900 block">總消費金額 (JPY 日圓)</label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      placeholder="0"
                      value={manualTotalJpy}
                      onChange={(e) => setManualTotalJpy(e.target.value)}
                      className="w-full bg-white border border-emerald-300 rounded-xl px-3.5 py-2.5 text-lg font-black text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600">JPY</span>
                  </div>

                  <div className="text-right bg-white border border-amber-200 px-3 py-2 rounded-xl shadow-2xs shrink-0">
                    <span className="text-[10px] text-gray-400 block font-medium">進位台幣</span>
                    <span className="text-sm font-extrabold text-amber-600">{formatTWD(manualTwdPreview)}</span>
                  </div>
                </div>
              </div>

              {/* 購買細項 (可選) */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">購買品項明細 (選填)</span>
                  <button
                    type="button"
                    onClick={handleAddManualItemRow}
                    className="text-[11px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>新增項目</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {manualItems.map((item, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded-xl border border-gray-200 space-y-2 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="品項名稱 (中文)"
                          value={item.nameZh}
                          onChange={(e) => handleManualItemChange(idx, 'nameZh', e.target.value)}
                          className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-800 focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="日文 (選填)"
                          value={item.nameJp}
                          onChange={(e) => handleManualItemChange(idx, 'nameJp', e.target.value)}
                          className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-800 focus:outline-none"
                        />
                        {manualItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveManualItemRow(idx)}
                            className="text-gray-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-gray-500">
                        <div className="flex items-center gap-1">
                          <span>數量:</span>
                          <input
                            type="number"
                            value={item.qty}
                            onChange={(e) => handleManualItemChange(idx, 'qty', parseFloat(e.target.value) || 1)}
                            className="w-12 bg-gray-50 border border-gray-200 rounded px-1 text-center"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span>單價(JPY):</span>
                          <input
                            type="number"
                            value={item.price}
                            onChange={(e) => handleManualItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                            className="w-20 bg-gray-50 border border-gray-200 rounded px-1 text-right"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 儲存按鈕 */}
              <button
                type="button"
                onClick={handleSaveManualReceipt}
                className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl text-xs font-extrabold shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>確認儲存這筆無發票記帳</span>
              </button>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
