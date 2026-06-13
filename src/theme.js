// Design direction: a quiet "ledger book" feel — warm paper neutrals,
// a confident slab/mono pairing for money, deep green as the single accent
// (the color of cash, and of being "in the black"). Red is reserved purely
// for outstanding balances, never decorative.

export const theme = {
  colors: {
    bg: '#F7F4ED',          // warm paper
    surface: '#FFFFFF',     // card surface
    surfaceAlt: '#EFEAE0',  // recessed / secondary surface
    line: '#E2DCCC',        // hairline borders
    ink: '#2B2A26',         // primary text
    inkSoft: '#6F6B61',     // secondary text
    inkFaint: '#A6A096',    // tertiary / hints
    accent: '#1F5E4E',      // deep ledger green
    accentSoft: '#E3ECE7',  // accent tint background
    owed: '#A33B2D',        // outstanding balance red (rust, not alarm red)
    owedSoft: '#F4E4DF',
    settled: '#5E7A53',     // muted sage for "paid" / settled
    settledSoft: '#E9EFE3',
  },
  fonts: {
    display: 'System',   // bold/600 system font stands in for a slab display
    body: 'System',
    mono: 'Menlo',        // tabular figures for amounts
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 16,
  },
  spacing: (n) => n * 4,
};

export const fmtCurrency = (cents, currency = '₱') => {
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
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
