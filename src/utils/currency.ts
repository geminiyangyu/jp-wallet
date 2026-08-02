/**
 * Currency Utility Module
 * Default exchange rate JPY to TWD: 0.215
 */

export const DEFAULT_EXCHANGE_RATE = 0.215;

/**
 * Calculates TWD amount from JPY using Math.ceil (無條件進位) as requested
 */
export function calcTWD(jpy: number, rate: number = DEFAULT_EXCHANGE_RATE): number {
  if (!jpy || isNaN(jpy) || jpy <= 0) return 0;
  return Math.ceil(jpy * rate);
}

/**
 * Formats JPY with commas and 2 decimals or integer based on context
 */
export function formatJPY(amount: number, showDecimals: boolean = true): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(amount || 0);
  return `${formatted} JPY`;
}

/**
 * Formats TWD currency
 */
export function formatTWD(amount: number): string {
  const formatted = new Intl.NumberFormat('zh-TW', {
    maximumFractionDigits: 0,
  }).format(amount || 0);
  return `NT$ ${formatted}`;
}
