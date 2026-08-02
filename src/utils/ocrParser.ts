import type { Receipt, CategoryType } from '../types/receipt';

// Dictionary for Japanese items to Traditional Chinese translation & category mapping
export interface DictionaryEntry {
  zh: string;
  category: CategoryType;
}

export const JAPANESE_DICTIONARY: Record<string, DictionaryEntry> = {
  // 藥品 (Medicine & Health)
  'アリナミンEXプラス': { zh: '合利他命 EX Plus 270錠', category: '藥品' },
  'ロイヒツボ膏': { zh: 'ROIHI-TSUBOKO 穴位貼布', category: '藥品' },
  'サロンパス': { zh: '撒隆巴斯鎮痛貼布 140枚', category: '藥品' },
  'EVE QUICK': { zh: 'EVE QUICK 止痛藥 40錠', category: '藥品' },
  'キャベジンコーワα': { zh: '興和高雅胃藥 300錠', category: '藥品' },
  '太田胃散': { zh: '太田胃散 罐裝 210g', category: '藥品' },
  'サンテFX ネオ': { zh: '參天 FX Neo 涼感眼藥水', category: '藥品' },
  '龍角散ダイレクト': { zh: '龍角散清潤顆粒 (水蜜桃)', category: '藥品' },

  // 零食 (Snacks & Sweets)
  '辻利抹茶いちごサンド': { zh: '辻利抹茶草莓三明治', category: '零食' },
  '白い恋人': { zh: '白色戀人夾心餅乾 12枚入', category: '零食' },
  '東京ばな奈': { zh: '東京香蕉經典蛋糕 8入', category: '零食' },
  'ポテトファーム じゃがポックル': { zh: 'Potato Farm 薯條三兄弟', category: '零食' },
  'ポッキー 濃い抹茶': { zh: 'Pocky 濃郁抹茶棒', category: '零食' },
  'キットカット 宇治抹茶': { zh: 'KitKat 宇治抹茶巧克力 12枚', category: '零食' },
  'カルビー ポテトチップス': { zh: 'Calbee 九州醬油洋洋片', category: '零食' },
  'アルフォート ミニチョコレート': { zh: 'Alfort 帆船巧克力餅乾', category: '零食' },

  // 生活用品 (Daily Necessities & Cosmetics)
  '資生堂 パーフェクトホイップ': { zh: '洗顏專科超微米潔顏乳', category: '生活用品' },
  'スキンアクア UVエッセンス': { zh: 'Skin Aqua 防曬飾底乳', category: '生活用品' },
  'めぐりズム 蒸気でアイマスク': { zh: '花王美舒律蒸氣眼罩 12枚', category: '生活用品' },
  'キャンメイク アイシャドウ': { zh: 'Canmake 完美霧面眼影盤', category: '生活用品' },
  '超快適マスク': { zh: '超快適透氣口罩 30枚入', category: '生活用品' },
  '無印良品 化粧水': { zh: 'MUJI 敏感肌化粧水 (高保濕)', category: '生活用品' },

  // 吃飯 (Dining / Food)
  '海鮮丼セット': { zh: '特上生魚片海鮮丼套餐', category: '吃飯' },
  'ウニ・イクラ丼': { zh: '海膽鮭魚卵雙拼丼', category: '吃飯' },
  '生ビール (中)': { zh: 'SUNTORY 頂級生啤酒 (中)', category: '吃飯' },
  '豚骨ラーメン': { zh: '濃郁豚骨拉麵 (加半熟卵)', category: '吃飯' },
  '天ぷら定食': { zh: '炸蝦天婦羅定食', category: '吃飯' },
  'アイスカフェラテ': { zh: '冰拿鐵咖啡 (L)', category: '吃飯' },

  // 交通 (Transport)
  'フェリー乗車券 (大人)': { zh: 'Heartland Ferry 渡輪單程票', category: '交通' },
  '新幹線指定席券': { zh: 'JR 新幹線指定席車票 (東京-京都)', category: '交通' },
  '成田エクスプレス': { zh: 'N\'EX 成田特快車票', category: '交通' },
  'SUICA チャージ': { zh: 'Suica 西瓜卡加值', category: '交通' },
  '特急はるか 自由席': { zh: 'JR 關空特急 HARUKA 車票', category: '交通' },

  // 御守 (Amulets / Shrine)
  '開運厄除御守': { zh: '明治神宮 開運厄除御守', category: '御守' },
  '勝運御守': { zh: '勝運祈願金箔御守', category: '御守' },
  '縁結び絵馬': { zh: '結緣木製繪馬', category: '御守' },
  '学業成就守': { zh: '錦天滿宮 學業成就御守', category: '御守' },
  '交通安全お守り': { zh: '交通安全金屬掛飾御守', category: '御守' },

  // 紀念品 (Souvenirs / Merchandise)
  'ANA オリジナルキーホルダー': { zh: 'ANA 飛行機金屬鑰匙圈', category: '紀念品' },
  '木彫りクマ 置物': { zh: '北海道傳統木雕熊擺飾', category: '紀念品' },
  '富士山マグカップ': { zh: '富士山立體陶瓷馬克杯', category: '紀念品' },
  '京都傳統扇子': { zh: '西陣織絲綢手工扇子', category: '紀念品' },
  'キャラクター手ぬぐい': { zh: '限定版日式手拭巾', category: '紀念品' }
};

// Initial realistic default sample receipts derived directly from reference pictures (IMG_8340.PNG & IMG_8341.PNG)
export const INITIAL_SAMPLE_RECEIPTS: Receipt[] = [
  {
    id: 'rcpt-1',
    storeNameJp: "ANA'S AIRPORT SHOP",
    storeNameZh: 'ANA機場商店',
    branchName: '稚内ロビー店',
    address: '北海道稚内市聲問村空港內',
    country: 'Japan',
    date: '2025年8月3日 下午2:28',
    category: '紀念品',
    discountJpy: 139.00,
    subtotalJpy: 2646.00,
    taxJpy: 140.00,
    totalJpy: 2647.00,
    itemCount: 6,
    imageUrl: 'https://images.unsplash.com/photo-1542296332-2e4473faf563?w=600&auto=format&fit=crop&q=80',
    createdAt: Date.now() - 86400000 * 30,
    items: [
      {
        id: 'item-101',
        nameJp: '白い恋人 12枚入',
        nameZh: '白色戀人夾心餅乾 12枚入',
        category: '零食',
        quantity: 2,
        unitPriceJpy: 950.00,
        totalJpy: 1900.00
      },
      {
        id: 'item-102',
        nameJp: 'ANA オリジナルキーホルダー',
        nameZh: 'ANA 飛行機金屬鑰匙圈',
        category: '紀念品',
        quantity: 1,
        unitPriceJpy: 880.00,
        totalJpy: 886.00
      }
    ]
  },
  {
    id: 'rcpt-2',
    storeNameJp: '樺太食堂',
    storeNameZh: '樺太食堂',
    branchName: '稚内市ノシャップ2丁目2-6',
    address: '北海道稚内市ノシャップ2丁目2-6',
    country: 'Japan',
    date: '2025年8月3日 上午11:39',
    category: '吃飯',
    discountJpy: 0,
    subtotalJpy: 5236.00,
    taxJpy: 524.00,
    totalJpy: 5760.00,
    itemCount: 2,
    imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=80',
    createdAt: Date.now() - 86400000 * 30 + 3600000,
    items: [
      {
        id: 'item-201',
        nameJp: 'ウニ・イクラ丼',
        nameZh: '海膽鮭魚卵雙拼丼',
        category: '吃飯',
        quantity: 1,
        unitPriceJpy: 4500.00,
        totalJpy: 4500.00
      },
      {
        id: 'item-202',
        nameJp: '生ビール (中)',
        nameZh: 'SUNTORY 頂級生啤酒 (中)',
        category: '吃飯',
        quantity: 1,
        unitPriceJpy: 736.00,
        totalJpy: 736.00
      }
    ]
  },
  {
    id: 'rcpt-3',
    storeNameJp: 'ハートランドフェリー株式会社',
    storeNameZh: '哈特蘭渡輪股份有限公司',
    branchName: '稚内フェリーターミナル',
    address: '北海道稚内市開運1丁目2-2',
    country: 'Japan',
    date: '2025年7月30日 上午10:14',
    category: '交通',
    discountJpy: 0,
    subtotalJpy: 3263.00,
    taxJpy: 327.00,
    totalJpy: 3590.00,
    itemCount: 1,
    imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80',
    createdAt: Date.now() - 86400000 * 34,
    items: [
      {
        id: 'item-301',
        nameJp: 'フェリー乗車券 (大人)',
        nameZh: 'Heartland Ferry 渡輪單程票',
        category: '交通',
        quantity: 1,
        unitPriceJpy: 3590.00,
        totalJpy: 3590.00
      }
    ]
  },
  {
    id: 'rcpt-4',
    storeNameJp: 'マツモトキヨシ (Matsumoto Kiyoshi)',
    storeNameZh: '松本清藥妝',
    branchName: '新宿東口店',
    address: '東京都新宿区新宿3-22-6',
    country: 'Japan',
    date: '2025年4月7日 下午1:55',
    category: '藥品',
    discountJpy: 300.00,
    subtotalJpy: 5800.00,
    taxJpy: 480.00,
    totalJpy: 5980.00,
    itemCount: 3,
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
    createdAt: Date.now() - 86400000 * 100,
    items: [
      {
        id: 'item-401',
        nameJp: 'アリナミンEXプラス',
        nameZh: '合利他命 EX Plus 270錠',
        category: '藥品',
        quantity: 1,
        unitPriceJpy: 4980.00,
        totalJpy: 4980.00
      },
      {
        id: 'item-402',
        nameJp: 'サンテFX ネオ',
        nameZh: '參天 FX Neo 涼感眼藥水',
        category: '藥品',
        quantity: 2,
        unitPriceJpy: 500.00,
        totalJpy: 1000.00
      }
    ]
  },
  {
    id: 'rcpt-5',
    storeNameJp: 'FamilyMart',
    storeNameZh: '全家便利商店',
    branchName: '川越元町店',
    address: '埼玉県川越市元町2丁目4番13',
    country: 'Japan',
    date: '2025年4月6日 下午2:37',
    category: '零食',
    discountJpy: 0,
    subtotalJpy: 230.00,
    taxJpy: 18.00,
    totalJpy: 248.00,
    itemCount: 1,
    imageUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=600&auto=format&fit=crop&q=80',
    createdAt: Date.now() - 86400000 * 101,
    items: [
      {
        id: 'item-501',
        nameJp: '辻利抹茶いちごサンド',
        nameZh: '辻利抹茶草莓三明治',
        category: '零食',
        quantity: 1,
        unitPriceJpy: 248.00,
        totalJpy: 248.00
      }
    ]
  },
  {
    id: 'rcpt-6',
    storeNameJp: '明治神宮 授与所',
    storeNameZh: '明治神宮 御守授與所',
    branchName: '原宿本殿',
    address: '東京都渋谷区代々木神園町1-1',
    country: 'Japan',
    date: '2025年4月5日 上午10:30',
    category: '御守',
    discountJpy: 0,
    subtotalJpy: 2000.00,
    taxJpy: 0,
    totalJpy: 2000.00,
    itemCount: 2,
    imageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=600&auto=format&fit=crop&q=80',
    createdAt: Date.now() - 86400000 * 102,
    items: [
      {
        id: 'item-601',
        nameJp: '開運厄除御守',
        nameZh: '明治神宮 開運厄除御守',
        category: '御守',
        quantity: 1,
        unitPriceJpy: 1000.00,
        totalJpy: 1000.00
      },
      {
        id: 'item-602',
        nameJp: '交通安全お守り',
        nameZh: '交通安全金屬掛飾御守',
        category: '御守',
        quantity: 1,
        unitPriceJpy: 1000.00,
        totalJpy: 1000.00
      }
    ]
  }
];

/**
 * Intelligent Receipt Parser simulation for user uploaded photos
 */
export function parseUploadedReceipt(_imageName?: string): Partial<Receipt> {
  // Preset AI extracted profiles
  const profiles = [
    {
      storeNameJp: 'ドン・キホーテ (Don Quijote)',
      storeNameZh: '唐吉訶德 驚安殿堂',
      branchName: '道頓堀店',
      address: '大阪府大阪市中央区宗右衛門町7-13',
      category: '生活用品' as CategoryType,
      items: [
        { nameJp: 'ロイヒツボ膏', quantity: 2, unitPriceJpy: 680 },
        { nameJp: 'めぐりズム 蒸気でアイマスク', quantity: 1, unitPriceJpy: 1080 },
        { nameJp: 'キットカット 宇治抹茶', quantity: 3, unitPriceJpy: 398 }
      ]
    },
    {
      storeNameJp: 'ローソン (LAWSON)',
      storeNameZh: '羅森便利商店',
      branchName: '京都站前店',
      address: '京都府京都市下京区東塩小路町',
      category: '零食' as CategoryType,
      items: [
        { nameJp: 'アルフォート ミニチョコレート', quantity: 2, unitPriceJpy: 128 },
        { nameJp: 'アイスカフェラテ', quantity: 1, unitPriceJpy: 220 }
      ]
    },
    {
      storeNameJp: '一蘭拉麵',
      storeNameZh: '一蘭拉麵 橫濱西口店',
      branchName: '橫濱西口店',
      address: '神奈川県横浜市西区南幸2-15-4',
      category: '吃飯' as CategoryType,
      items: [
        { nameJp: '豚骨ラーメン', quantity: 2, unitPriceJpy: 980 },
        { nameJp: '生ビール (中)', quantity: 1, unitPriceJpy: 580 }
      ]
    }
  ];

  const selected = profiles[Math.floor(Math.random() * profiles.length)];
  const parsedItems = selected.items.map((item, idx) => {
    const dict = JAPANESE_DICTIONARY[item.nameJp] || { zh: item.nameJp, category: selected.category };
    const totalJpy = item.quantity * item.unitPriceJpy;
    return {
      id: `parsed-item-${Date.now()}-${idx}`,
      nameJp: item.nameJp,
      nameZh: dict.zh,
      category: dict.category,
      quantity: item.quantity,
      unitPriceJpy: item.unitPriceJpy,
      totalJpy
    };
  });

  const subtotalJpy = parsedItems.reduce((sum, item) => sum + item.totalJpy, 0);
  const taxJpy = Math.ceil(subtotalJpy * 0.08);
  const totalJpy = subtotalJpy + taxJpy;

  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours() > 12 ? '下午' : '上午'}${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`;

  return {
    id: `rcpt-${Date.now()}`,
    storeNameJp: selected.storeNameJp,
    storeNameZh: selected.storeNameZh,
    branchName: selected.branchName,
    address: selected.address,
    country: 'Japan',
    date: dateStr,
    category: selected.category,
    items: parsedItems,
    itemCount: parsedItems.reduce((acc, cur) => acc + cur.quantity, 0),
    subtotalJpy,
    taxJpy,
    discountJpy: 0,
    totalJpy,
    createdAt: Date.now()
  };
}
