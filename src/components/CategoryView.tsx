import React, { useState } from 'react';
import type { Receipt, CategoryType } from '../types/receipt';
import { CATEGORIES, CATEGORY_METAS } from '../types/receipt';
import { calcTWD, formatJPY, formatTWD } from '../utils/currency';
import { Grid, ChevronDown, ChevronRight, MapPin, Calendar, Tag } from 'lucide-react';

interface CategoryViewProps {
  receipts: Receipt[];
  exchangeRate: number;
}

export const CategoryView: React.FC<CategoryViewProps> = ({ receipts, exchangeRate }) => {
  const [expandedCategory, setExpandedCategory] = useState<CategoryType | null>(null);

  // Group all items from all receipts by item category (fallback to receipt category if item category is missing)
  const categoryData = CATEGORIES.map((cat) => {
    const items: { item: any; receipt: Receipt }[] = [];
    
    receipts.forEach(r => {
      // Find items in this receipt that belong to this category
      r.items.forEach(it => {
        const itemCat = it.category || r.category;
        if (itemCat === cat) {
          items.push({ item: it, receipt: r });
        }
      });
    });

    // Sort items by date descending
    items.sort((a, b) => b.receipt.createdAt - a.receipt.createdAt);

    const totalJpy = items.reduce((sum, x) => sum + x.item.totalJpy, 0);
    const totalTwd = calcTWD(totalJpy, exchangeRate);
    
    return {
      category: cat,
      meta: CATEGORY_METAS[cat],
      items,
      totalJpy,
      totalTwd,
      count: items.length
    };
  }).filter(data => data.count > 0); // Only show categories that have items

  if (categoryData.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-gray-200 my-6 shadow-sm">
        <Grid className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-gray-700 mb-1">尚無分類數據</h3>
        <p className="text-xs text-gray-400 max-w-xs mx-auto">
          您的發票清單中尚未包含任何細項，當您匯入發票後，這裡將會跨發票統整各個分類的花費。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in pb-12">
      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-emerald-900 flex items-center gap-2">
            <Grid className="w-5 h-5" />
            分類細項統整
          </h2>
          <p className="text-xs text-emerald-700 mt-0.5">點擊各分類可檢視跨發票的所有購買項目清單與花費</p>
        </div>
      </div>

      <div className="space-y-3">
        {categoryData.map((data) => {
          const isExpanded = expandedCategory === data.category;
          
          return (
            <div key={data.category} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all">
              {/* Category Header (Clickable) */}
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedCategory(isExpanded ? null : data.category)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${data.meta.badgeBg} ${data.meta.badgeText} ${data.meta.border}`}>
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900">{data.category}</h3>
                    <p className="text-xs text-gray-400">{data.count} 項購買紀錄</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-sm font-extrabold text-gray-900">{formatJPY(data.totalJpy, false)}</div>
                    <div className="text-xs font-bold text-amber-600">≈ {formatTWD(data.totalTwd)}</div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Item List */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-2 sm:p-4 space-y-2 max-h-[60vh] overflow-y-auto scrollbar-thin">
                  {data.items.map((x, idx) => (
                    <div key={x.item.id || idx} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 text-[10px] text-gray-400 font-medium">
                          <span className="flex items-center gap-0.5 bg-gray-100 px-1.5 py-0.5 rounded">
                            <MapPin className="w-3 h-3" /> {x.receipt.storeNameZh || x.receipt.storeNameJp}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Calendar className="w-3 h-3" /> {x.receipt.date.split(' ')[0]}
                          </span>
                        </div>
                        
                        <div className="font-bold text-gray-900 text-sm truncate">{x.item.nameJp}</div>
                        <div className="text-xs text-emerald-600 font-semibold truncate">{x.item.nameZh}</div>
                      </div>
                      
                      <div className="flex items-end justify-between sm:flex-col sm:items-end shrink-0">
                        <div className="text-xs text-gray-500 font-medium sm:mb-1">
                          單價: {x.item.unitPriceJpy} × {x.item.quantity}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-extrabold text-gray-900">{formatJPY(x.item.totalJpy, false)}</div>
                          <div className="text-[10px] font-bold text-amber-600">≈ {formatTWD(calcTWD(x.item.totalJpy, exchangeRate))}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
