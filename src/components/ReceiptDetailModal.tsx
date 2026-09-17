import React, { useState } from 'react';
import type { Receipt, ReceiptItem, CategoryType } from '../types/receipt';
import { CATEGORIES, CATEGORY_METAS } from '../types/receipt';
import { calcTWD, formatJPY, formatTWD } from '../utils/currency';
import { Calendar, MapPin, Globe, Image as ImageIcon, Plus, Trash2, Check } from 'lucide-react';

interface ReceiptDetailModalProps {
  receipt: Receipt;
  exchangeRate: number;
  onClose: () => void;
  onUpdateReceipt: (updatedReceipt: Receipt) => void;
}

export const ReceiptDetailModal: React.FC<ReceiptDetailModalProps> = ({
  receipt,
  exchangeRate,
  onClose,
  onUpdateReceipt,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedReceipt, setEditedReceipt] = useState<Receipt>({ ...receipt });
  const [showImageFull, setShowImageFull] = useState(false);

  const twdTotal = calcTWD(editedReceipt.totalJpy, exchangeRate);
  const catMeta = CATEGORY_METAS[editedReceipt.category] || CATEGORY_METAS['其他'];

  // Handle item change during edit
  const handleItemChange = (index: number, field: keyof ReceiptItem, value: any) => {
    const updatedItems = [...editedReceipt.items];
    const item = { ...updatedItems[index], [field]: value };

    // Recalculate item line total if qty or unit price changed
    if (field === 'quantity' || field === 'unitPriceJpy') {
      const q = field === 'quantity' ? parseFloat(value) || 0 : item.quantity;
      const p = field === 'unitPriceJpy' ? parseFloat(value) || 0 : item.unitPriceJpy;
      item.totalJpy = q * p;
    }

    updatedItems[index] = item;

    // Recalculate receipt totals
    const subtotalJpy = updatedItems.reduce((acc, it) => acc + (it.totalJpy || 0), 0);
    const taxJpy = editedReceipt.taxJpy;
    const discountJpy = editedReceipt.discountJpy;
    const totalJpy = subtotalJpy + taxJpy - discountJpy;

    setEditedReceipt({
      ...editedReceipt,
      items: updatedItems,
      itemCount: updatedItems.reduce((acc, it) => acc + (it.quantity || 1), 0),
      subtotalJpy,
      totalJpy: Math.max(0, totalJpy),
    });
  };

  const handleAddItem = () => {
    const newItem: ReceiptItem = {
      id: `item-new-${Date.now()}`,
      nameJp: '新しい商品',
      nameZh: '新商品項目',
      category: editedReceipt.category,
      quantity: 1,
      unitPriceJpy: 100,
      totalJpy: 100,
    };
    const updatedItems = [...editedReceipt.items, newItem];
    const subtotalJpy = updatedItems.reduce((acc, it) => acc + it.totalJpy, 0);

    setEditedReceipt({
      ...editedReceipt,
      items: updatedItems,
      itemCount: updatedItems.reduce((acc, it) => acc + it.quantity, 0),
      subtotalJpy,
      totalJpy: subtotalJpy + editedReceipt.taxJpy - editedReceipt.discountJpy,
    });
  };

  const handleDeleteItem = (index: number) => {
    const updatedItems = editedReceipt.items.filter((_, i) => i !== index);
    const subtotalJpy = updatedItems.reduce((acc, it) => acc + it.totalJpy, 0);

    setEditedReceipt({
      ...editedReceipt,
      items: updatedItems,
      itemCount: updatedItems.reduce((acc, it) => acc + it.quantity, 0),
      subtotalJpy,
      totalJpy: Math.max(0, subtotalJpy + editedReceipt.taxJpy - editedReceipt.discountJpy),
    });
  };

  const handleSave = () => {
    onUpdateReceipt(editedReceipt);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedReceipt({ ...receipt });
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-[#f4f5f8] w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up">
        
        {/* Header Bar matching IMG_8341.PNG top nav */}
        <div className="bg-white/90 backdrop-blur border-b border-gray-200/80 px-4 py-3.5 flex items-center justify-between sticky top-0 z-10">
          {isEditing ? (
            <button
              onClick={handleCancelEdit}
              className="text-sm font-semibold text-rose-600 hover:text-rose-800 transition-colors flex items-center gap-0.5"
            >
              取消
            </button>
          ) : (
            <button
              onClick={onClose}
              className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-0.5"
            >
              關閉
            </button>
          )}

          <h2 className="text-base font-bold text-gray-900">
            {isEditing ? '編輯收據詳情' : '收據詳情'}
          </h2>

          {isEditing ? (
            <button
              onClick={handleSave}
              className="text-sm font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              保存
            </button>
          ) : (
            <button
              onClick={() => {
                setEditedReceipt({ ...receipt });
                setIsEditing(true);
              }}
              className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              編輯
            </button>
          )}
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
          
          {/* Card 1: Store & Meta Info (IMG_8341 style) */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0 flex-1">
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      className="w-full text-base font-bold bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1"
                      value={editedReceipt.storeNameJp}
                      onChange={(e) => setEditedReceipt({ ...editedReceipt, storeNameJp: e.target.value })}
                      placeholder="店家日文名稱"
                    />
                    <input
                      type="text"
                      className="w-full text-xs font-semibold text-emerald-600 bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1"
                      value={editedReceipt.storeNameZh}
                      onChange={(e) => setEditedReceipt({ ...editedReceipt, storeNameZh: e.target.value })}
                      placeholder="店家繁中翻譯"
                    />
                  </div>
                ) : (
                  <>
                    <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">
                      {editedReceipt.storeNameJp}
                    </h1>
                    <p className="text-xs font-semibold text-emerald-600">
                      {editedReceipt.storeNameZh}
                    </p>
                  </>
                )}

                {/* Category Badge Tag matching IMG_8341 */}
                <div className="pt-1">
                  {isEditing ? (
                    <select
                      value={editedReceipt.category}
                      onChange={(e) => setEditedReceipt({ ...editedReceipt, category: e.target.value as CategoryType })}
                      className="text-xs font-bold bg-white border border-gray-300 rounded-lg px-2 py-1 text-gray-700"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-md border ${catMeta.badgeBg} ${catMeta.badgeText} ${catMeta.border}`}>
                      {editedReceipt.category}
                    </span>
                  )}
                </div>
              </div>

              {/* Total JPY & TWD Display */}
              <div className="text-right shrink-0">
                <div className="text-xl font-extrabold text-emerald-700 tracking-tight">
                  {formatJPY(editedReceipt.totalJpy, true)}
                </div>
                <div className="text-xs font-extrabold text-amber-600 mt-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 inline-block">
                  ≈ {formatTWD(calcTWD(editedReceipt.totalJpy, exchangeRate))}
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Date & Location rows */}
            <div className="space-y-2 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                {isEditing ? (
                  <input
                    type="text"
                    className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-xs text-gray-700"
                    value={editedReceipt.date}
                    onChange={(e) => setEditedReceipt({ ...editedReceipt, date: e.target.value })}
                  />
                ) : (
                  <span>{editedReceipt.date}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                {isEditing ? (
                  <input
                    type="text"
                    className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-xs text-gray-700"
                    value={editedReceipt.address || ''}
                    onChange={(e) => setEditedReceipt({ ...editedReceipt, address: e.target.value })}
                    placeholder="輸入地址"
                  />
                ) : (
                  <span>{editedReceipt.address || '日本地區'}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span>{editedReceipt.country || 'Japan'}</span>
              </div>
            </div>
          </div>

          {/* Card 2: 交易明細 (Transaction Details matching IMG_8341) */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">交易明細</h3>
              <span className="text-xs text-gray-400">{editedReceipt.items.length} 項商品</span>
            </div>

            <div className="space-y-3">
              {editedReceipt.items.map((item, idx) => {
                const itemTwd = calcTWD(item.totalJpy, exchangeRate);
                const itemCatMeta = CATEGORY_METAS[item.category] || CATEGORY_METAS['其他'];

                return (
                  <div
                    key={item.id || idx}
                    className="p-3 rounded-xl bg-gray-50/70 border border-gray-100 space-y-1 transition-all hover:bg-gray-50"
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className="flex-1 text-xs font-bold bg-white border border-gray-300 rounded px-2 py-1"
                            value={item.nameJp}
                            onChange={(e) => handleItemChange(idx, 'nameJp', e.target.value)}
                            placeholder="日文品項"
                          />
                          <button
                            onClick={() => handleDeleteItem(idx)}
                            className="text-rose-500 hover:text-rose-700 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className="w-full text-xs text-emerald-600 bg-white border border-gray-300 rounded px-2 py-1"
                            value={item.nameZh}
                            onChange={(e) => handleItemChange(idx, 'nameZh', e.target.value)}
                            placeholder="繁中翻譯"
                          />
                          <select
                            value={item.category}
                            onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                            className="text-[10px] font-bold bg-white border border-gray-300 rounded px-1.5 py-1 text-gray-700 w-24 shrink-0"
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-400">數量:</span>
                          <input
                            type="number"
                            step="1"
                            className="w-14 bg-white border border-gray-300 rounded px-1.5 py-0.5 text-center"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          />
                          <span className="text-gray-400">單價(JPY):</span>
                          <input
                            type="number"
                            className="w-20 bg-white border border-gray-300 rounded px-1.5 py-0.5 text-right"
                            value={item.unitPriceJpy}
                            onChange={(e) => handleItemChange(idx, 'unitPriceJpy', e.target.value)}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-gray-900">{item.nameJp}</span>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded border ${itemCatMeta.badgeBg} ${itemCatMeta.badgeText} ${itemCatMeta.border}`}>
                                {item.category}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-emerald-600 mt-0.5">
                              {item.nameZh}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-extrabold text-gray-900">
                              {item.totalJpy.toFixed(2)}
                            </span>
                            <div className="text-[10px] font-bold text-amber-600">
                              ≈ {formatTWD(itemTwd)}
                            </div>
                          </div>
                        </div>

                        <div className="text-[11px] text-gray-400 flex items-center justify-between pt-1">
                          <span>數量: {item.quantity.toFixed(1)}   價格: {item.unitPriceJpy.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {isEditing && (
                <button
                  onClick={handleAddItem}
                  className="w-full py-2 border border-dashed border-emerald-300 bg-emerald-50/50 text-emerald-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-emerald-50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>新增購買細項</span>
                </button>
              )}
            </div>
          </div>

          {/* Card 3: 總金額 Breakdown (IMG_8341 matching layout) */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">總金額</h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span className="font-semibold text-gray-700">小計</span>
                <span className="font-bold text-gray-900">{formatJPY(editedReceipt.subtotalJpy, true)}</span>
              </div>

              <div className="flex justify-between text-gray-600">
                <span className="font-semibold text-gray-700">稅額 (8%/10%)</span>
                {isEditing ? (
                  <input
                    type="number"
                    className="w-20 text-right bg-gray-50 border border-gray-300 rounded px-1.5 py-0.5"
                    value={editedReceipt.taxJpy}
                    onChange={(e) => {
                      const tax = parseFloat(e.target.value) || 0;
                      setEditedReceipt({
                        ...editedReceipt,
                        taxJpy: tax,
                        totalJpy: editedReceipt.subtotalJpy + tax - editedReceipt.discountJpy,
                      });
                    }}
                  />
                ) : (
                  <span className="font-bold text-gray-900">{formatJPY(editedReceipt.taxJpy, true)}</span>
                )}
              </div>

              {editedReceipt.discountJpy > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span className="font-semibold">折扣優惠</span>
                  <span className="font-bold">-{formatJPY(editedReceipt.discountJpy, true)}</span>
                </div>
              )}

              <hr className="border-gray-100 my-1" />

              <div className="flex justify-between items-center text-sm pt-1">
                <span className="font-bold text-gray-900">總計</span>
                <div className="text-right">
                  <span className="text-base font-extrabold text-emerald-700">
                    {formatJPY(editedReceipt.totalJpy, true)}
                  </span>
                </div>
              </div>

              {/* TWD Math.ceil summary block */}
              <div className="flex justify-between items-center text-xs bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-2">
                <div className="flex items-center gap-1 text-amber-900 font-bold">
                  <span>折合台幣 (無條件進位)</span>
                </div>
                <span className="text-sm font-extrabold text-amber-700">
                  {formatTWD(twdTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: 原始收據照片 (IMG_8341 matching photo card) */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">原始收據照片</h3>
            
            <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-900 group">
              <img
                src={editedReceipt.imageUrl || 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=600&auto=format&fit=crop&q=80'}
                alt="Receipt Scan"
                className="w-full h-48 object-cover opacity-90 group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                onClick={() => setShowImageFull(true)}
              />
              <div
                onClick={() => setShowImageFull(true)}
                className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-xs font-semibold gap-1.5"
              >
                <ImageIcon className="w-4 h-4" />
                <span>點擊查看完整大圖</span>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer (只在非編輯模式下顯示「完成」按鈕) */}
        {!isEditing && (
          <div className="bg-white border-t border-gray-200/80 p-3 flex justify-end">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold hover:bg-emerald-800 transition-colors shadow-sm"
            >
              完成
            </button>
          </div>
        )}

      </div>

      {/* Image Lightbox */}
      {showImageFull && (
        <div
          onClick={() => setShowImageFull(false)}
          className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4 cursor-pointer animate-fade-in"
        >
          <div className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center">
            <img
              src={editedReceipt.imageUrl || 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=600&auto=format&fit=crop&q=80'}
              alt="Receipt full size"
              className="max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <p className="text-xs text-white/70 mt-2">點擊任意處關閉大圖</p>
          </div>
        </div>
      )}
    </div>
  );
};
