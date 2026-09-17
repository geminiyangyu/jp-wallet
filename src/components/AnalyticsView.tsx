import React from 'react';
import type { Receipt } from '../types/receipt';
import { CATEGORIES, CATEGORY_METAS } from '../types/receipt';
import { calcTWD, formatJPY, formatTWD } from '../utils/currency';
import { PieChart, DollarSign, ShoppingBag, Award, BarChart3, Calendar } from 'lucide-react';

interface AnalyticsViewProps {
  receipts: Receipt[];
  exchangeRate: number;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ receipts, exchangeRate }) => {
  const totalJpy = receipts.reduce((sum, r) => sum + r.totalJpy, 0);
  const totalTwd = calcTWD(totalJpy, exchangeRate);
  const totalItemsCount = receipts.reduce((sum, r) => sum + (r.itemCount || r.items.length), 0);

  // Group expenses by category
  const categoryBreakdown = CATEGORIES.map((cat) => {
    const catReceipts = receipts.filter((r) => r.category === cat);
    const catJpy = catReceipts.reduce((sum, r) => sum + r.totalJpy, 0);

    // Also scan items inside receipts that belong to this category even if main receipt category differs
    let subItemJpy = 0;
    receipts.forEach((r) => {
      r.items.forEach((it) => {
        if (it.category === cat) {
          subItemJpy += it.totalJpy;
        }
      });
    });

    const displayJpy = Math.max(catJpy, subItemJpy);
    const catTwd = calcTWD(displayJpy, exchangeRate);
    const percentage = totalJpy > 0 ? (displayJpy / totalJpy) * 100 : 0;
    const meta = CATEGORY_METAS[cat];

    return {
      category: cat,
      jpy: displayJpy,
      twd: catTwd,
      percentage,
      count: catReceipts.length,
      meta,
    };
  }).sort((a, b) => b.jpy - a.jpy);

  // Find top store by expenditure
  const storeMap: Record<string, number> = {};
  receipts.forEach((r) => {
    storeMap[r.storeNameZh || r.storeNameJp] = (storeMap[r.storeNameZh || r.storeNameJp] || 0) + r.totalJpy;
  });
  const topStore = Object.entries(storeMap).sort((a, b) => b[1] - a[1])[0];

  // Daily spending trend (chronological)
  const dailyMap = new Map<string, { dateKey: string; displayLabel: string; totalJpy: number }>();
  receipts.forEach((r) => {
    const match = r.date?.match(/(\d{4})[年/.\-](\d{1,2})[月/.\-](\d{1,2})/);
    let dateKey: string;
    let displayLabel: string;
    if (match) {
      const m = String(parseInt(match[2], 10));
      const d = String(parseInt(match[3], 10));
      dateKey = `${match[1]}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      displayLabel = `${m}/${d}`;
    } else {
      const fallback = new Date(r.createdAt || Date.now());
      dateKey = fallback.toISOString().slice(0, 10);
      displayLabel = `${fallback.getMonth() + 1}/${fallback.getDate()}`;
    }
    const existing = dailyMap.get(dateKey);
    if (existing) {
      existing.totalJpy += r.totalJpy;
    } else {
      dailyMap.set(dateKey, { dateKey, displayLabel, totalJpy: r.totalJpy });
    }
  });
  const dailySpending = Array.from(dailyMap.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const maxDailyJpy = Math.max(...dailySpending.map(d => d.totalJpy), 1);

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Expense TWD */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-800 text-white rounded-2xl p-4 shadow-md shadow-emerald-700/20">
          <div className="flex items-center justify-between opacity-80 mb-1">
            <span className="text-xs font-semibold">總消費 (進位台幣)</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="text-2xl font-extrabold tracking-tight">
            {formatTWD(totalTwd)}
          </div>
          <div className="text-[11px] opacity-75 mt-1 font-medium">
            共 {formatJPY(totalJpy, false)} (匯率 {exchangeRate})
          </div>
        </div>

        {/* Total Items */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-xs font-semibold">總收據 / 戰利品</span>
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-gray-900 tracking-tight">
            {receipts.length} <span className="text-sm font-normal text-gray-500">張收據</span>
          </div>
          <div className="text-xs text-gray-400 mt-1 font-medium">
            累計購買 <span className="font-bold text-emerald-600">{totalItemsCount}</span> 個細項物品
          </div>
        </div>

        {/* Top Spend Location */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-xs font-semibold">消費最高店家</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-base font-extrabold text-gray-900 truncate tracking-tight">
            {topStore ? topStore[0] : '無數據'}
          </div>
          <div className="text-xs text-amber-600 font-bold mt-1">
            {topStore ? `${formatJPY(topStore[1], false)} (≈ ${formatTWD(calcTWD(topStore[1], exchangeRate))})` : ''}
          </div>
        </div>
      </div>

      {/* Daily Spending Trend Bar Chart */}
      {dailySpending.length > 1 && (
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-bold text-gray-900">每日消費趨勢</h3>
            </div>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              共 {dailySpending.length} 天
            </span>
          </div>

          <div className="flex items-end gap-1.5 h-40 pt-2">
            {dailySpending.map((day) => {
              const heightPct = Math.max((day.totalJpy / maxDailyJpy) * 100, 4);
              const twdDay = calcTWD(day.totalJpy, exchangeRate);
              return (
                <div
                  key={day.dateKey}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative"
                >
                  {/* Tooltip on hover */}
                  <div className="absolute -top-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap z-10 pointer-events-none shadow-lg">
                    {formatJPY(day.totalJpy, false)}
                    <span className="text-amber-300 ml-1">≈ {formatTWD(twdDay)}</span>
                  </div>
                  {/* Bar */}
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-emerald-600 to-emerald-400 group-hover:from-emerald-500 group-hover:to-emerald-300 transition-all duration-300 min-h-[4px] cursor-pointer"
                    style={{ height: `${heightPct}%` }}
                  />
                  {/* Label */}
                  <span className="text-[10px] text-gray-400 font-semibold mt-1.5 leading-none">
                    {day.displayLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Breakdown Progress List */}
      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-gray-900">分類支出統計 (自動歸類)</h3>
          </div>
          <span className="text-xs text-gray-400">依金額佔比排序</span>
        </div>

        <div className="space-y-3">
          {categoryBreakdown.map((cat) => (
            <div key={cat.category} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md font-bold border text-[11px] ${cat.meta.badgeBg} ${cat.meta.badgeText} ${cat.meta.border}`}>
                    {cat.category}
                  </span>
                  <span className="text-gray-400 font-medium">{cat.count} 張筆記</span>
                </div>
                <div className="text-right font-bold">
                  <span className="text-gray-900">{formatTWD(cat.twd)}</span>
                  <span className="text-[11px] text-gray-400 ml-1 font-normal">
                    ({cat.percentage.toFixed(1)}%)
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${cat.percentage}%`,
                    backgroundColor: cat.meta.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
