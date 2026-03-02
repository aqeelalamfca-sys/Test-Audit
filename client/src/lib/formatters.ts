export function formatAccounting(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return '-';
  const absValue = Math.abs(value);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(absValue);
  return value < 0 ? `(${formatted})` : formatted;
}

export function formatPKR(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return '-';
  const absValue = Math.abs(value);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(absValue);
  return value < 0 ? `(${formatted})` : formatted;
}

export function formatCurrency(value: number | null | undefined, decimals: number = 0): string {
  if (value === null || value === undefined || value === 0) return '-';
  const absValue = Math.abs(value);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(absValue);
  return value < 0 ? `(${formatted})` : formatted;
}

export function formatPercentage(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined) return '-';
  return `${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('en-US').format(value);
}
