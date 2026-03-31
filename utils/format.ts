/**
 * Indian number formatting utilities.
 * Uses the Indian comma system: last 3 digits, then groups of 2.
 * e.g. 1234567 → 12,34,567
 */

export function formatINR(amount: number): string {
  if (!isFinite(amount)) return '₹0';
  const abs = Math.abs(Math.round(amount));
  const str = String(abs);
  let formatted: string;
  if (str.length <= 3) {
    formatted = str;
  } else {
    const last3 = str.slice(-3);
    const rest = str.slice(0, -3);
    const groups: string[] = [];
    let i = rest.length;
    while (i > 0) {
      const start = Math.max(0, i - 2);
      groups.unshift(rest.slice(start, i));
      i = start;
    }
    formatted = groups.join(',') + ',' + last3;
  }
  return (amount < 0 ? '-₹' : '₹') + formatted;
}

export function formatNumber(n: number): string {
  if (!isFinite(n)) return '0';
  const abs = Math.abs(Math.round(n));
  const str = String(abs);
  let formatted: string;
  if (str.length <= 3) {
    formatted = str;
  } else {
    const last3 = str.slice(-3);
    const rest = str.slice(0, -3);
    const groups: string[] = [];
    let i = rest.length;
    while (i > 0) {
      const start = Math.max(0, i - 2);
      groups.unshift(rest.slice(start, i));
      i = start;
    }
    formatted = groups.join(',') + ',' + last3;
  }
  return (n < 0 ? '-' : '') + formatted;
}
