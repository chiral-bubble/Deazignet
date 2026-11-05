/**
 * Formatting utilities for Dezignet
 * Standardizes USD currency, dates, and units across all client & designer screens
 */

import { formatUSD, formatDate, formatDateTimeWithZone, sqftToSqm } from '../services/usMarketService';

export { formatUSD, formatDate, formatDateTimeWithZone, sqftToSqm };

/**
 * Standard money formatter: formats amount as USD ($12,500.00)
 */
export function formatMoney(amount: number | string): string {
  return formatUSD(amount);
}

/**
 * Compact number formatting for large counters (e.g. 1.2M, 45k)
 */
export function formatCompactNumber(num: number): string {
  if (isNaN(num)) return '0';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}

/**
 * Formats area defaulting to square feet with square meters conversion
 */
export function formatArea(sqft: number | null | undefined, unit: 'sqft' | 'sqm' = 'sqft'): string {
  if (!sqft || sqft <= 0) return '—';
  if (unit === 'sqm') {
    const sqm = sqftToSqm(sqft);
    return `${sqm.toLocaleString('en-US')} sq m`;
  }
  return `${sqft.toLocaleString('en-US')} sq ft`;
}
