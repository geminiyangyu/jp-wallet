import React, { useState } from 'react';
import { Wallet, PieChart, ReceiptText, Settings, Grid, Edit2, Check, Trash2 } from 'lucide-react';
import type { Trip } from '../types/receipt';

interface HeaderNavProps {
  activeTab: 'receipts' | 'categories' | 'analytics';
  setActiveTab: (tab: 'receipts' | 'categories' | 'analytics') => void;
  exchangeRate: number;
  setExchangeRate: (rate: number) => void;
  onResetData: () => void;
  trips: Trip[];
  activeTrip: Trip;
  onSwitchTrip: (id: string) => void;
  onCreateTrip: () => void;
  onUpdateTripName: (name: string) => void;
  onDeleteTrip: (tripId: string) => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  activeTab,
  setActiveTab,
  exchangeRate,
  setExchangeRate,
  onResetData,
  trips,
  activeTrip,
  onSwitchTrip,
  onCreateTrip,
  onUpdateTripName,
  onDeleteTrip
}) => {
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState(exchangeRate.toString());
  
  const [isEditingTripName, setIsEditingTripName] = useState(false);
  const [tempTripName, setTempTripName] = useState('');

  const handleSaveRate = () => {
    const parsed = parseFloat(tempRate);
    if (!isNaN(parsed) && parsed > 0) {
      setExchangeRate(parsed);
    } else {
      setTempRate(exchangeRate.toString());
    }
    setIsEditingRate(false);
  };

  const handleSaveTripName = () => {
    onUpdateTripName(tempTripName);
    setIsEditingTripName(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm transition-all">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Brand Logo & Trip Selector */}
          <div className="flex items-center gap-3 flex-1 min-w-0 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/30 shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {isEditingTripName ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      className="text-lg font-bold text-gray-900 border-b-2 border-emerald-500 focus:outline-none bg-transparent w-40"
                      value={tempTripName}
                      onChange={(e) => setTempTripName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveTripName()}
                      autoFocus
                    />
                    <button onClick={handleSaveTripName} className="text-emerald-700 bg-emerald-50 p-1 rounded">
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { setTempTripName(activeTrip.name); setIsEditingTripName(true); }}>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight truncate max-w-[200px]">
                      {activeTrip.name}
                    </h1>
                    <Edit2 className="w-3.5 h-3.5 text-gray-300 group-hover:text-emerald-600 transition-colors" />
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2 mt-0.5">
                <select
                  value={activeTrip.id}
                  onChange={(e) => {
                    if (e.target.value === 'NEW_TRIP') {
                      onCreateTrip();
                    } else {
                      onSwitchTrip(e.target.value);
                    }
                  }}
                  className="text-xs text-emerald-700 bg-emerald-50/50 border border-emerald-100 rounded px-1.5 py-0.5 font-semibold focus:outline-none"
                >
                  {trips.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                  <option value="NEW_TRIP" className="font-bold text-emerald-800">＋ 新增旅程...</option>
                </select>
                {trips.length > 1 && (
                  <button
                    onClick={() => onDeleteTrip(activeTrip.id)}
                    className="p-1 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all"
                    title="刪除此旅程"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Rate Settings Summary */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="bg-gray-50 border border-gray-200/80 rounded-xl px-3 py-1.5 flex items-center gap-2">
              <div className="text-right">
                <span className="text-[10px] text-gray-400 font-medium uppercase block leading-none">匯率 (JPY➜TWD)</span>
                {isEditingRate ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <input
                      type="number"
                      step="0.001"
                      className="w-16 text-xs font-bold text-gray-800 bg-white border border-emerald-400 rounded px-1 text-right focus:outline-none"
                      value={tempRate}
                      onChange={(e) => setTempRate(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveRate()}
                      autoFocus
                    />
                    <button
                      onClick={handleSaveRate}
                      className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-medium"
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      setTempRate(exchangeRate.toString());
                      setIsEditingRate(true);
                    }}
                    className="text-xs font-bold text-emerald-700 cursor-pointer hover:underline flex items-center justify-end gap-1 mt-0.5"
                  >
                    <span>1 = {exchangeRate}</span>
                    <Settings className="w-3 h-3 text-gray-400" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setActiveTab('receipts')}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'receipts' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ReceiptText className="w-4 h-4" />
              <span>明細</span>
            </button>
            
            <button
              onClick={() => setActiveTab('categories')}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'categories' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid className="w-4 h-4" />
              <span>分類</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'analytics' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <PieChart className="w-4 h-4" />
              <span>分析</span>
            </button>
          </div>

          <button
            onClick={onResetData}
            className="text-[10px] text-rose-500 hover:text-white border border-rose-200 hover:bg-rose-500 px-2 py-1 rounded transition-colors shrink-0 ml-4"
          >
            清空所有資料
          </button>
        </div>
      </div>
    </header>
  );
};

