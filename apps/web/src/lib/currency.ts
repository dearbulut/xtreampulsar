export interface CurrencyDef {
  code: string;
  symbol: string;
  label: string;
  /** true → sembol tutardan sonra (ör. 10 ₺ değil, çoğu için önce). */
  suffix?: boolean;
}

// IPTV bayileri için yaygın para birimleri.
export const CURRENCIES: CurrencyDef[] = [
  { code: 'TRY', symbol: '₺', label: 'Türk Lirası' },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'RUB', symbol: '₽', label: 'Russian Ruble' },
  { code: 'UAH', symbol: '₴', label: 'Ukrainian Hryvnia' },
  { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham', suffix: true },
  { code: 'SAR', symbol: '﷼', label: 'Saudi Riyal', suffix: true },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { code: 'PKR', symbol: '₨', label: 'Pakistani Rupee' },
  { code: 'BRL', symbol: 'R$', label: 'Brazilian Real' },
  { code: 'AZN', symbol: '₼', label: 'Azerbaijani Manat' },
  { code: 'EGP', symbol: 'E£', label: 'Egyptian Pound' },
  { code: 'MAD', symbol: 'DH', label: 'Moroccan Dirham', suffix: true },
];

const BY_CODE: Record<string, CurrencyDef> = Object.fromEntries(CURRENCIES.map((c) => [c.code, c]));

export function currencyDef(code?: string | null): CurrencyDef {
  return (code && BY_CODE[code]) || BY_CODE.TRY;
}

export function currencySymbol(code?: string | null): string {
  return currencyDef(code).symbol;
}

/** Tutarı seçili para birimiyle biçimlendirir: "₺49.90" / "49.90 د.إ". */
export function formatMoney(amount: number, code?: string | null): string {
  const c = currencyDef(code);
  const n = amount.toFixed(2);
  return c.suffix ? `${n} ${c.symbol}` : `${c.symbol}${n}`;
}
