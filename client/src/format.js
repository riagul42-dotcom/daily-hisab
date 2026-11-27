const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export const BN_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
];
export const BN_MONTHS_SHORT = [
  'জানু', 'ফেব', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্ট', 'অক্টো', 'নভে', 'ডিসে',
];

export function bnDigits(value) {
  return String(value).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

const numFmt = new Intl.NumberFormat('bn-BD', { maximumFractionDigits: 0 });
const numFmt2 = new Intl.NumberFormat('bn-BD', { maximumFractionDigits: 2 });

export function fmtNum(n) {
  return numFmt.format(Number(n) || 0);
}

export function fmtTK(n) {
  return `৳ ${numFmt2.format(Math.round((Number(n) || 0) * 100) / 100)}`;
}

export function fmtQty(n) {
  return numFmt2.format(Number(n) || 0);
}

export function toISO(date) {
  const d = new Date(date);
  const p = (v) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function todayISO() {
  return toISO(new Date());
}

export function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return `${bnDigits(d)} ${BN_MONTHS[m - 1] || ''} ${bnDigits(y)}`;
}

export function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const date = fmtDate(toISO(d));
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${date}, ${bnDigits(hh)}:${bnDigits(mm)}`;
}

export function monthLabel(ym) {
  const [y, m] = String(ym).split('-').map(Number);
  return `${BN_MONTHS[m - 1] || ''} ${bnDigits(y)}`;
}

export function monthShort(ym) {
  const [y, m] = String(ym).split('-').map(Number);
  return `${BN_MONTHS_SHORT[m - 1] || ''} ${bnDigits(String(y).slice(2))}`;
}

export function firstOfMonthISO(offsetMonths = 0) {
  const d = new Date();
  return toISO(new Date(d.getFullYear(), d.getMonth() + offsetMonths, 1));
}

export function startOfYearISO() {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}
