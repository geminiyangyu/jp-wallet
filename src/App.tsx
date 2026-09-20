import React, { useState, useEffect } from 'react';
import type { Receipt, Trip } from './types/receipt';
import { DEFAULT_EXCHANGE_RATE } from './utils/currency';
import { loadTrips, saveTrips } from './utils/dbStorage';
import { HeaderNav } from './components/HeaderNav';
import { ReceiptList } from './components/ReceiptList';
import { ReceiptDetailModal } from './components/ReceiptDetailModal';
import { ReceiptUploadModal } from './components/ReceiptUploadModal';
import { AnalyticsView } from './components/AnalyticsView';
import { CategoryView } from './components/CategoryView';

const STORAGE_KEY_TRIPS = 'jp_wallet_trips_v2';
const STORAGE_KEY_ACTIVE_TRIP = 'jp_wallet_active_trip_v2';
const STORAGE_KEY_RATE = 'jp_wallet_rate_v1';

export function App() {
  const [activeTab, setActiveTab] = useState<'receipts' | 'categories' | 'analytics'>('receipts');
  const [exchangeRate, setExchangeRate] = useState<number>(DEFAULT_EXCHANGE_RATE);
  
  // Trip management state
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTripId, setActiveTripId] = useState<string>('');

  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  // 待確認刪除的發票 id（改用 App 內建確認視窗，不用 window.confirm）
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Load state from IndexedDB (or LocalStorage fallback) on mount
  useEffect(() => {
    let isMounted = true;

    async function initStorage() {
      try {
        const savedRate = localStorage.getItem(STORAGE_KEY_RATE);
        if (savedRate) {
          const rate = parseFloat(savedRate);
          if (!isNaN(rate) && rate > 0) setExchangeRate(rate);
        }

        const { trips: loadedTrips, activeTripId: savedActiveId } = await loadTrips();

        if (!isMounted) return;

        let finalTrips = loadedTrips;
        if (!finalTrips || finalTrips.length === 0) {
          const defaultTrip: Trip = {
            id: `trip-${Date.now()}`,
            name: '我的日本之旅',
            createdAt: Date.now(),
            receipts: []
          };
          finalTrips = [defaultTrip];
        }

        setTrips(finalTrips);

        if (savedActiveId && finalTrips.some(t => t.id === savedActiveId)) {
          setActiveTripId(savedActiveId);
        } else {
          setActiveTripId(finalTrips[0].id);
        }
      } catch (e) {
        console.warn('Failed to load storage:', e);
      }
    }

    initStorage();

    return () => {
      isMounted = false;
    };
  }, []);

  // Save trips to IndexedDB and LocalStorage (safely wrapped against quota crashes)
  useEffect(() => {
    if (trips.length > 0 && activeTripId) {
      saveTrips(trips, activeTripId);
    }
  }, [trips, activeTripId]);

  const handleSetExchangeRate = (rate: number) => {
    setExchangeRate(rate);
    try {
      localStorage.setItem(STORAGE_KEY_RATE, rate.toString());
    } catch (e) {
      console.warn('Failed to save rate:', e);
    }
  };

  const handleResetData = () => {
    if (window.confirm('確定要清除所有資料並重新開始嗎？這個動作無法復原！')) {
      const defaultTrip: Trip = {
        id: `trip-${Date.now()}`,
        name: '我的日本之旅',
        createdAt: Date.now(),
        receipts: []
      };
      setTrips([defaultTrip]);
      setActiveTripId(defaultTrip.id);
      setExchangeRate(DEFAULT_EXCHANGE_RATE);
      try {
        localStorage.removeItem(STORAGE_KEY_TRIPS);
        localStorage.removeItem(STORAGE_KEY_RATE);
        localStorage.removeItem(STORAGE_KEY_ACTIVE_TRIP);
      } catch (e) {}
      saveTrips([defaultTrip], defaultTrip.id);
    }
  };

  const activeTrip = trips.find(t => t.id === activeTripId) || trips[0];
  const receipts = activeTrip?.receipts || [];

  const updateActiveTripReceipts = (newReceipts: Receipt[]) => {
    setTrips(prev => prev.map(t => t.id === activeTripId ? { ...t, receipts: newReceipts } : t));
  };

  const handleUpdateTripName = (newName: string) => {
    if (!newName.trim()) return;
    setTrips(prev => prev.map(t => t.id === activeTripId ? { ...t, name: newName } : t));
  };

  const handleCreateNewTrip = () => {
    const newTrip: Trip = {
      id: `trip-${Date.now()}`,
      name: `新旅程 ${new Date().toLocaleDateString()}`,
      createdAt: Date.now(),
      receipts: []
    };
    setTrips(prev => [...prev, newTrip]);
    setActiveTripId(newTrip.id);
  };

  const handleDeleteTrip = (tripId: string) => {
    if (trips.length <= 1) return;
    if (!window.confirm('確定要刪除這個旅程嗎？所有收據資料將一併刪除，且無法復原！')) return;
    const remaining = trips.filter(t => t.id !== tripId);
    setTrips(remaining);
    if (activeTripId === tripId) {
      setActiveTripId(remaining[0].id);
    }
  };

  const handleSwitchTrip = (tripId: string) => {
    setActiveTripId(tripId);
    setActiveTab('receipts');
  };

  const handleAddReceipt = (newRcpt: Receipt | Receipt[]) => {
    const arr = Array.isArray(newRcpt) ? newRcpt : [newRcpt];
    updateActiveTripReceipts([...arr, ...receipts]);
  };

  const handleUpdateReceipt = (updatedRcpt: Receipt) => {
    updateActiveTripReceipts(receipts.map(r => r.id === updatedRcpt.id ? updatedRcpt : r));
    setSelectedReceipt(updatedRcpt);
  };

  /**
   * 刪除發票。
   *
   * 【為什麼不用 window.confirm】瀏覽器只要出現過「防止此頁面建立其他對話方塊」
   * 的勾選（連續跳幾次對話框後就會出現），之後 window.confirm() 會直接回傳 false，
   * 使用者按了刪除卻毫無反應。iOS 的獨立 PWA 模式也有類似狀況。
   * 改用 App 自己的確認視窗，行為不受瀏覽器設定影響。
   */
  const handleDeleteReceipt = (receiptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDeleteId(receiptId);
  };

  const confirmDeleteReceipt = () => {
    if (!pendingDeleteId) return;
    updateActiveTripReceipts(receipts.filter(r => r.id !== pendingDeleteId));
    if (selectedReceipt?.id === pendingDeleteId) {
      setSelectedReceipt(null);
    }
    setPendingDeleteId(null);
  };

  if (!activeTrip) return null;

  return (
    <div className="min-h-screen bg-[#f4f5f8] text-gray-800 flex flex-col font-sans">
      <HeaderNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        exchangeRate={exchangeRate}
        setExchangeRate={handleSetExchangeRate}
        onResetData={handleResetData}
        trips={trips}
        activeTrip={activeTrip}
        onSwitchTrip={handleSwitchTrip}
        onCreateTrip={handleCreateNewTrip}
        onUpdateTripName={handleUpdateTripName}
        onDeleteTrip={handleDeleteTrip}
      />

      <main className="max-w-4xl w-full mx-auto px-4 py-4 flex-1">
        {activeTab === 'receipts' && (
          <ReceiptList
            receipts={receipts}
            exchangeRate={exchangeRate}
            onSelectReceipt={(rcpt) => setSelectedReceipt(rcpt)}
            onDeleteReceipt={handleDeleteReceipt}
            onOpenUploadModal={() => setIsUploadOpen(true)}
          />
        )}
        
        {activeTab === 'categories' && (
          <CategoryView
            receipts={receipts}
            exchangeRate={exchangeRate}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView receipts={receipts} exchangeRate={exchangeRate} />
        )}
      </main>

      {selectedReceipt && (
        <ReceiptDetailModal
          receipt={selectedReceipt}
          exchangeRate={exchangeRate}
          onClose={() => setSelectedReceipt(null)}
          onUpdateReceipt={handleUpdateReceipt}
        />
      )}

      {pendingDeleteId && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-6 animate-fadeIn"
          onClick={() => setPendingDeleteId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900">刪除這張發票？</h3>
            <p className="mt-2 text-sm text-gray-500">刪除後無法復原。</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 active:scale-[0.98] transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDeleteReceipt}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 active:scale-[0.98] transition"
              >
                確定刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {isUploadOpen && (
        <ReceiptUploadModal
          exchangeRate={exchangeRate}
          onClose={() => setIsUploadOpen(false)}
          onAddReceipt={handleAddReceipt}
        />
      )}
    </div>
  );
}

export default App;
