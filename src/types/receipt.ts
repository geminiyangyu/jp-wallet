export type CategoryType = 
  | '藥品'
  | '零食'
  | '生活用品'
  | '吃飯'
  | '交通'
  | '御守'
  | '紀念品'
  | '其他';

export interface ReceiptItem {
  id: string;
  nameJp: string;
  nameZh: string;
  category: CategoryType;
  quantity: number;
  unitPriceJpy: number;
  totalJpy: number;
}

export interface Receipt {
  id: string;
  storeNameJp: string;
  storeNameZh: string;
  branchName?: string;
  address?: string;
  country?: string;
  date: string; // e.g., "2025年8月3日 下午2:28"
  category: CategoryType;
  items: ReceiptItem[];
  itemCount: number;
  subtotalJpy: number;
  taxJpy: number;
  discountJpy: number;
  totalJpy: number;
  imageUrl?: string;
  note?: string;
  createdAt: number;
}

export interface Trip {
  id: string;
  name: string;
  createdAt: number;
  receipts: Receipt[];
}

export interface CategoryMeta {
  name: CategoryType;
  iconName: string;
  badgeBg: string;
  badgeText: string;
  border: string;
  color: string;
}

export const CATEGORIES: CategoryType[] = [
  '藥品',
  '零食',
  '生活用品',
  '吃飯',
  '交通',
  '御守',
  '紀念品',
  '其他'
];

export const CATEGORY_METAS: Record<CategoryType, CategoryMeta> = {
  藥品: { name: '藥品', iconName: 'Pill', badgeBg: 'bg-rose-50', badgeText: 'text-rose-700', border: 'border-rose-200', color: '#e11d48' },
  零食: { name: '零食', iconName: 'Cookie', badgeBg: 'bg-amber-50', badgeText: 'text-amber-700', border: 'border-amber-200', color: '#d97706' },
  生活用品: { name: '生活用品', iconName: 'ShoppingBag', badgeBg: 'bg-sky-50', badgeText: 'text-sky-700', border: 'border-sky-200', color: '#0284c7' },
  吃飯: { name: '吃飯', iconName: 'Utensils', badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-700', border: 'border-emerald-200', color: '#059669' },
  交通: { name: '交通', iconName: 'Train', badgeBg: 'bg-indigo-50', badgeText: 'text-indigo-700', border: 'border-indigo-200', color: '#4f46e5' },
  御守: { name: '御守', iconName: 'Sparkles', badgeBg: 'bg-yellow-50', badgeText: 'text-yellow-800', border: 'border-yellow-300', color: '#ca8a04' },
  紀念品: { name: '紀念品', iconName: 'Gift', badgeBg: 'bg-purple-50', badgeText: 'text-purple-700', border: 'border-purple-200', color: '#9333ea' },
  其他: { name: '其他', iconName: 'MoreHorizontal', badgeBg: 'bg-gray-100', badgeText: 'text-gray-700', border: 'border-gray-200', color: '#4b5563' }
};
