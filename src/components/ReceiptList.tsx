import React, { useState, useMemo, useCallback } from 'react';
import type { Receipt, CategoryType } from '../types/receipt';
import { CATEGORIES, CATEGORY_METAS } from '../types/receipt';
import { calcTWD, formatJPY, formatTWD } from '../utils/currency';
import { Search, Filter, Plus, Trash2, Calendar, MapPin, Tag, ChevronRight, ShoppingBag, ArrowDownUp, Layers, List } from 'lucide-react';

interface ReceiptListProps {
  receipts: Receipt[];
  exchangeRate: number;
  onSelectReceipt: (receipt: Receipt) => void;
  onDeleteReceipt: (receiptId: string, e: React.MouseEvent) => void;
  onOpenUploadModal: () => void;
}

function parseDateInfo(dateStr: string, createdAt: number) {
  let year = 0, month = 0, day = 0;
  if (dateStr) {
    const match = dateStr.match(/(\d{4})[年/.\-](\d{1,2})[月/.\-](\d{1,2})/);
    if (match) {
      year = parseInt(match[1], 10);
      month = parseInt(match[2], 10);
      day = parseInt(match[3], 10);
    }
  }

  if (!year || !month || !day) {
    const fallbackDate = new Date(createdAt || Date.now());
    year = fallbackDate.getFullYear();
    month = fallbackDate.getMonth() + 1;
    day = fallbackDate.getDate();
  }

  const dateObj = new Date(year, month - 1, day);
  const weekDays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  const weekDayStr = weekDays[dateObj.getDay()] || '';

  const dateKey = `${year}年${String(month).padStart(2, '0')}月${String(day).padStart(2, '0')}日`;
  const displayTitle = `${dateKey} (${weekDayStr})`;
  const timestamp = dateObj.getTime();

  return { dateKey, displayTitle, timestamp };
}

function getDayLabel(index: number): string {
  const chineseNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
  const numStr = chineseNumbers[index] || String(index + 1);
  return `第${numStr}天`;
}

export const ReceiptList: React.FC<ReceiptListProps> = ({
  receipts,
  exchangeRate,
  onSelectReceipt,
  onDeleteReceipt,
  onOpenUploadModal,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | '全部'>('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const [groupByDate, setGroupByDate] = useState(true);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedDayKey, setSelectedDayKey] = useState<string | 'ALL'>('ALL');

  // Filter receipts based on category and search query
  const filteredReceipts = useMemo(() => {
    return receipts.filter((rcpt) => {
      const matchesCategory = selectedCategory === '全部' || rcpt.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        rcpt.storeNameJp.toLowerCase().includes(q) ||
        rcpt.storeNameZh.toLowerCase().includes(q) ||
        (rcpt.branchName && rcpt.branchName.toLowerCase().includes(q)) ||
        (rcpt.address && rcpt.address.toLowerCase().includes(q)) ||
        rcpt.items.some(item => item.nameJp.toLowerCase().includes(q) || item.nameZh.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [receipts, selectedCategory, searchQuery]);

  // Sort receipts by their actual purchase date first, then by createdAt
  const sortedReceipts = useMemo(() => {
    return [...filteredReceipts].sort((a, b) => {
      const infoA = parseDateInfo(a.date, a.createdAt);
      const infoB = parseDateInfo(b.date, b.createdAt);

      if (infoA.timestamp !== infoB.timestamp) {
        return sortOrder === 'desc'
          ? infoB.timestamp - infoA.timestamp
          : infoA.timestamp - infoB.timestamp;
      }
      return sortOrder === 'desc' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt;
    });
  }, [filteredReceipts, sortOrder]);

  interface DateGroup {
    dateKey: string;
    displayTitle: string;
    timestamp: number;
    receipts: Receipt[];
    totalJpy: number;
    totalTwd: number;
  }

  // Group receipts strictly by normalized date
  const groups: DateGroup[] = useMemo(() => {
    const groupsMap = new Map<string, DateGroup>();
    sortedReceipts.forEach(rcpt => {
      const { dateKey, displayTitle, timestamp } = parseDateInfo(rcpt.date, rcpt.createdAt);
      if (!groupsMap.has(dateKey)) {
        groupsMap.set(dateKey, {
          dateKey,
          displayTitle,
          timestamp,
          receipts: [],
          totalJpy: 0,
          totalTwd: 0,
        });
      }
      const group = groupsMap.get(dateKey)!;
      group.receipts.push(rcpt);
      group.totalJpy += rcpt.totalJpy;
      group.totalTwd += calcTWD(rcpt.totalJpy, exchangeRate);
    });

    return Array.from(groupsMap.values()).sort((a, b) => {
      return sortOrder === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
    });
  }, [sortedReceipts, exchangeRate, sortOrder]);

  // Sort groups in chronological order (earliest date to latest date) for "第一天, 第二天..."
  const chronologicalDayGroups = useMemo(() => {
    return [...groups].sort((a, b) => a.timestamp - b.timestamp);
  }, [groups]);

  // Filter displayed groups according to selected day pill
  const displayedGroups = useMemo(() => {
    return selectedDayKey === 'ALL'
      ? groups
      : groups.filter(g => g.dateKey === selectedDayKey);
  }, [groups, selectedDayKey]);

  const renderReceiptCard = useCallback((rcpt: Receipt) => {
    const twdAmount = calcTWD(rcpt.totalJpy, exchangeRate);
    const catMeta = CATEGORY_METAS[rcpt.category] || CATEGORY_METAS['其他'];

    return (
      <div
        key={rcpt.id}
        onClick={() => onSelectReceipt(rcpt)}
        className="receipt-card p-4 sm:p-5 border border-gray-100 cursor-pointer relative group transition-all"
      >
        {/* Store Header & Main JPY / TWD Amount */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-base font-extrabold text-gray-900 truncate tracking-tight">
                {rcpt.storeNameJp}
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${catMeta.badgeBg} ${catMeta.badgeText} ${catMeta.border}`}>
                {rcpt.category}
              </span>
            </div>

            <p className="text-xs font-semibold text-emerald-600 truncate mb-1">
              {rcpt.storeNameZh}
            </p>

            {rcpt.branchName && (
              <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                <MapPin className="w-3 h-3 text-gray-300 shrink-0" />
                <span>{rcpt.branchName}</span>
              </p>
            )}
          </div>

          <div className="text-right shrink-0">
            <div className="text-lg font-extrabold text-emerald-700 leading-tight tracking-tight">
              {formatJPY(rcpt.totalJpy, true)}
            </div>
            <div className="text-xs font-extrabold text-amber-600 mt-0.5 flex items-center justify-end gap-1">
              <span className="text-[10px] font-normal text-gray-400">進位台幣</span>
              <span>{formatTWD(twdAmount)}</span>
            </div>
          </div>
        </div>

        {/* Middle details */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-50 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-gray-400">
              <Calendar className="w-3 h-3 text-gray-300" />
              <span>{rcpt.date}</span>
            </span>

            {rcpt.discountJpy > 0 && (
              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                折扣: {rcpt.discountJpy.toFixed(2)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-gray-400 font-medium">
              {rcpt.itemCount || rcpt.items.length} 個
            </span>
            <span className="text-gray-300 font-light">
              {rcpt.country || 'Japan'}
            </span>

            <button
              onClick={(e) => onDeleteReceipt(rcpt.id, e)}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all"
              title="刪除此發票"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-600 transition-colors" />
          </div>
        </div>

        {/* Sub-item summary tooltip preview */}
        {rcpt.items.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-50 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px] text-gray-500">
            <Tag className="w-3 h-3 text-gray-300 shrink-0" />
            {rcpt.items.slice(0, 3).map((item, idx) => (
              <span key={item.id || idx} className="bg-gray-50 border border-gray-100 rounded-md px-1.5 py-0.5 text-gray-600 truncate max-w-[140px]">
                {item.nameZh || item.nameJp}
              </span>
            ))}
            {rcpt.items.length > 3 && (
              <span className="text-[10px] text-gray-400 font-medium">
                +{rcpt.items.length - 3} 項
              </span>
            )}
          </div>
        )}
      </div>
    );
  }, [exchangeRate, onSelectReceipt, onDeleteReceipt]);

  return (
    <div className="relative pb-24 animate-fade-in">
      {/* Search & Filter Header Bar */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜尋店家、地址或購買細項..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full w-4 h-4 flex items-center justify-center"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex bg-white border border-gray-200 rounded-2xl p-1 shrink-0 shadow-sm">
            <button
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className={`flex items-center justify-center p-2.5 rounded-xl transition-all ${sortOrder === 'desc' ? 'text-emerald-700 bg-emerald-50' : 'text-gray-500 hover:bg-gray-50'}`}
              title="排序方式 (新到舊/舊到新)"
            >
              <ArrowDownUp className="w-4 h-4" />
            </button>
            <div className="w-px bg-gray-200 mx-1"></div>
            <button
              onClick={() => setGroupByDate(prev => !prev)}
              className={`flex items-center justify-center p-2.5 rounded-xl transition-all ${groupByDate ? 'text-emerald-700 bg-emerald-50' : 'text-gray-500 hover:bg-gray-50'}`}
              title="切換按日期分群"
            >
              {groupByDate ? <Layers className="w-4 h-4" /> : <List className="w-4 h-4" />}
            </button>
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold border transition-all shrink-0 ${
              showFilters || selectedCategory !== '全部'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>過濾器</span>
          </button>

          {/* Top Add Button (新增到最頂部，方便點擊不需下滑) */}
          <button
            onClick={onOpenUploadModal}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white px-3.5 py-2.5 rounded-2xl text-xs font-extrabold shadow-md transition-all shrink-0"
            title="新增發票或無發票手動記帳"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">新增記帳</span>
            <span className="sm:hidden">新增</span>
          </button>
        </div>

        {/* Category Pills Bar */}
        {(showFilters || selectedCategory !== '全部') && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none animate-fade-in">
            <button
              onClick={() => setSelectedCategory('全部')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === '全部'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              全部 ({receipts.length})
            </button>
            {CATEGORIES.map((cat) => {
              const meta = CATEGORY_METAS[cat];
              const count = receipts.filter(r => r.category === cat).length;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1 border transition-all ${
                    isSelected
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                      : `${meta.badgeBg} ${meta.badgeText} ${meta.border} hover:opacity-80`
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-white/80 text-gray-600'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Day Selector Ribbon Bar (匡起來的天數切換列) */}
        {chronologicalDayGroups.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none animate-fade-in border-t border-gray-200/60 pt-3 mt-1">
            {/* 最左邊：總覽 */}
            <button
              onClick={() => setSelectedDayKey('ALL')}
              className={`px-4 py-2 rounded-2xl text-xs font-extrabold whitespace-nowrap transition-all border shrink-0 ${
                selectedDayKey === 'ALL'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-md ring-2 ring-emerald-700/20'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              總覽 ({chronologicalDayGroups.length}天)
            </button>

            {/* 接下來：第一天 (M/D)、第二天 (M/D)... */}
            {chronologicalDayGroups.map((group, index) => {
              const isSelected = selectedDayKey === group.dateKey;
              const dayLabel = getDayLabel(index);
              const mmdd = group.dateKey.replace(/^\d{4}年/, '').replace(/日$/, '').replace('月', '/');

              return (
                <button
                  key={group.dateKey}
                  onClick={() => setSelectedDayKey(group.dateKey)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all border shrink-0 ${
                    isSelected
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-md ring-2 ring-emerald-700/20'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span>{dayLabel}</span>
                  <span className={`text-[11px] font-semibold ${isSelected ? 'text-emerald-100' : 'text-gray-400'}`}>
                    ({mmdd})
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {filteredReceipts.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-gray-200 my-6 shadow-sm">
          <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-700 mb-1">找不到相關收據明細</h3>
          <p className="text-xs text-gray-400 max-w-xs mx-auto mb-4">
            尚無此分類或關鍵字的發票記錄。您可以試著上傳新收據或重置範例。
          </p>
          <button
            onClick={onOpenUploadModal}
            className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>匯入第一張收據</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupByDate ? (
            displayedGroups.map(group => (
              <div key={group.dateKey} className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between sticky top-14 z-10 bg-[#f4f5f8]/95 backdrop-blur-md py-2.5 px-3 rounded-2xl border border-gray-200/60 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-4 bg-emerald-600 rounded-full"></div>
                    <h2 className="text-sm font-extrabold text-gray-900 tracking-tight">{group.displayTitle}</h2>
                    <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100/80 px-2 py-0.5 rounded-full">
                      {group.receipts.length} 筆
                    </span>
                  </div>
                  <div className="text-right flex items-center gap-2.5">
                    <span className="text-xs font-black text-emerald-800">{formatJPY(group.totalJpy, true)}</span>
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80">
                      ≈ {formatTWD(group.totalTwd)}
                    </span>
                  </div>
                </div>
                <div className="space-y-3.5">
                  {group.receipts.map(renderReceiptCard)}
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-3.5">
              {sortedReceipts.map(renderReceiptCard)}
            </div>
          )}
        </div>
      )}

      {/* Floating Action Add Button */}
      <button
        onClick={onOpenUploadModal}
        className="floating-btn fixed bottom-6 right-6 sm:bottom-8 sm:right-8 w-14 h-14 rounded-full text-white flex items-center justify-center transition-all z-20"
        title="匯入 / 新增收據"
      >
        <Plus className="w-7 h-7 stroke-[2.5]" />
      </button>
    </div>
  );
};
