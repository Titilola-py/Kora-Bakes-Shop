/** Shared visual tokens, matching the Kora Bakes website palette. */
export const colors = {
  background: '#FDF8F2',
  surface: '#FFFFFF',
  ink: '#17243B',
  inkMuted: '#5B6B84',
  inkSoft: '#8A98AE',
  line: '#E7DFD4',
  cobalt: '#2457D6',
  cobaltSoft: '#EDF2FE',
  caramel: '#C98A3E',
  success: '#1F7A4D',
  danger: '#B3261E',
  dangerSoft: '#FCEDEA',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

/** Kobo -> naira, formatted the same way as the website (NGN, en-NG). */
const money = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 2,
});

export function formatMoney(kobo: number): string {
  return money.format(kobo / 100);
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}