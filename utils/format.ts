export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '₹0';
  const isNeg = amount < 0;
  const abs = Math.abs(Math.round(amount));
  const str = abs.toString();
  if (str.length <= 3) return `${isNeg ? '-' : ''}₹${str}`;
  const last3 = str.slice(-3);
  const rest = str.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${isNeg ? '-' : ''}₹${rest},${last3}`;
}

export function formatNumber(n: number): string {
  const str = Math.round(n).toString();
  if (str.length <= 3) return str;
  const last3 = str.slice(-3);
  const rest = str.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate().toString().padStart(2,'0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

export function formatRelativeDate(dateStr: string): string {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return dateStr;
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(dateStr);
}

export function formatPhone(phone: string): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 10) return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  if (clean.length === 12 && clean.startsWith('91')) return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
  return phone;
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${(Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)).toFixed(decimals)}%`;
}
