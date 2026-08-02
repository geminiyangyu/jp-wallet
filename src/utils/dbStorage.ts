import type { Trip } from '../types/receipt';

const DB_NAME = 'jp_wallet_db_v1';
const DB_VERSION = 1;
const STORE_TRIPS = 'trips';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_TRIPS)) {
        db.createObjectStore(STORE_TRIPS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves all trips to IndexedDB (handles gigabytes of data).
 * Also attempts to mirror lightweight data to LocalStorage as fallback.
 */
export async function saveTrips(trips: Trip[], activeTripId: string): Promise<void> {
  if (!trips || trips.length === 0) return;

  // 1. Primary storage: IndexedDB (Unlimited quota)
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_TRIPS, 'readwrite');
    const store = tx.objectStore(STORE_TRIPS);

    // Clear old records
    await new Promise<void>((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => resolve();
      clearReq.onerror = () => reject(clearReq.error);
    });

    // Write all trips
    for (const trip of trips) {
      store.put(trip);
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB save warning:', err);
  }

  // 2. Secondary fallback: LocalStorage with safety try-catch
  try {
    localStorage.setItem('jp_wallet_trips_v2', JSON.stringify(trips));
    localStorage.setItem('jp_wallet_active_trip_v2', activeTripId);
  } catch (e) {
    console.warn('LocalStorage quota exceeded. Stripping large images for fallback storage...');
    // If LocalStorage fails due to 5MB quota limit, strip large base64 images for LocalStorage backup only
    try {
      const lightTrips = trips.map(t => ({
        ...t,
        receipts: t.receipts.map(r => ({
          ...r,
          // Retain base64 only if short, otherwise omit to prevent LocalStorage crash
          imageUrl: r.imageUrl && r.imageUrl.length < 30000 ? r.imageUrl : ''
        }))
      }));
      localStorage.setItem('jp_wallet_trips_v2', JSON.stringify(lightTrips));
      localStorage.setItem('jp_wallet_active_trip_v2', activeTripId);
    } catch (innerErr) {
      console.warn('LocalStorage secondary backup failed safely without crashing:', innerErr);
    }
  }
}

/**
 * Loads trips from IndexedDB first, then falls back to LocalStorage.
 */
export async function loadTrips(): Promise<{ trips: Trip[]; activeTripId: string }> {
  let loadedTrips: Trip[] = [];
  let activeTripId = '';

  // 1. Try IndexedDB first
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_TRIPS, 'readonly');
    const store = tx.objectStore(STORE_TRIPS);
    const request = store.getAll();

    loadedTrips = await new Promise<Trip[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('IndexedDB load warning, attempting LocalStorage fallback:', err);
  }

  // 2. Fallback to LocalStorage if IndexedDB returned nothing
  if (!loadedTrips || loadedTrips.length === 0) {
    try {
      const savedTrips = localStorage.getItem('jp_wallet_trips_v2');
      if (savedTrips) {
        loadedTrips = JSON.parse(savedTrips);
      }
    } catch (e) {
      console.warn('LocalStorage read error:', e);
    }
  }

  try {
    activeTripId = localStorage.getItem('jp_wallet_active_trip_v2') || '';
  } catch (e) {
    activeTripId = '';
  }

  return { trips: loadedTrips, activeTripId };
}
