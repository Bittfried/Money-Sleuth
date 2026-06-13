export const theme = {
  colors: {
    bg: '#F7F4ED',
    surface: '#FFFFFF',
    surfaceAlt: '#EFEAE0',
    line: '#E2DCCC',
    ink: '#2B2A26',
    inkSoft: '#6F6B61',
    inkFaint: '#A6A096',
    accent: '#1F5E4E',
    accentSoft: '#E3ECE7',
    owed: '#A33B2D',
    owedSoft: '#F4E4DF',
    settled: '#5E7A53',
    settledSoft: '#E9EFE3',
    gold: '#B7832F',
    goldSoft: '#F5ECD8',
  },
  fonts: { display: 'System', body: 'System', mono: 'Menlo' },
  radius: { sm: 6, md: 10, lg: 16 },
  spacing: (n) => n * 4,
};

export const fmtCurrency = (cents, currency = '\u20B1') => {
  const value = (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency}${value}`;
};

export const fmtDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
