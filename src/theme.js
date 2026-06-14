import { StyleSheet } from 'react-native';
import { parseLocalDate } from './date';

const lightColors = {
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
};
let activeColors = lightColors;
const dynamicColors = new Proxy(lightColors, {
  get(_, property) {
    return activeColors[property];
  },
});

export const theme = {
  colors: dynamicColors,
  fonts: { display: 'System', body: 'System', mono: 'Menlo' },
  radius: { sm: 6, md: 10, lg: 16 },
  spacing: (n) => n * 4,
};

export const palettes = {
  light: lightColors,
  night: {
    ...lightColors,
    bg: '#E9E4D9',
    surface: '#F4EFE5',
    surfaceAlt: '#DED7C9',
    line: '#CFC5B5',
    ink: '#25241F',
    inkSoft: '#625E54',
    inkFaint: '#8B8478',
    accent: '#174C40',
    accentSoft: '#D5E1DA',
    goldSoft: '#E8DDC4',
  },
  dark: {
    bg: '#08050D',
    surface: '#110A19',
    surfaceAlt: '#1A1025',
    line: '#392447',
    ink: '#FBF7FD',
    inkSoft: '#C9B8D2',
    inkFaint: '#897493',
    accent: '#B07BDD',
    accentSoft: '#251331',
    owed: '#F08A83',
    owedSoft: '#30151E',
    settled: '#9ED394',
    settledSoft: '#14261A',
    gold: '#E7BD70',
    goldSoft: '#291D18',
  },
};

let paletteVersion = 0;
const semanticColorKeys = new Map(
  Object.values(palettes).flatMap((palette) => Object.entries(palette).map(([key, value]) => [value, key]))
);
const translateStyle = (value) => {
  if (Array.isArray(value)) return value.map(translateStyle);
  if (!value || typeof value !== 'object') {
    const key = semanticColorKeys.get(value);
    return key ? activeColors[key] : value;
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, translateStyle(item)]));
};

// Keep every existing StyleSheet palette-aware, including screens loaded before a mode change.
StyleSheet.create = (definitions) => {
  let cachedVersion = -1;
  let translated = {};
  return new Proxy(definitions, {
    get(target, property) {
      if (cachedVersion !== paletteVersion) {
        translated = {};
        cachedVersion = paletteVersion;
      }
      if (!Object.prototype.hasOwnProperty.call(translated, property)) {
        translated[property] = translateStyle(target[property]);
      }
      return translated[property];
    },
  });
};

export const getTheme = (mode = 'light') => {
  const nextColors = palettes[mode] ?? palettes.light;
  if (activeColors !== nextColors) {
    activeColors = nextColors;
    paletteVersion += 1;
  }
  return { ...theme, colors: activeColors };
};

export const fmtCurrency = (cents, currency = '\u20B1') => {
  const value = (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency}${value}`;
};

export const fmtDate = (iso) => {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso ?? '') ? parseLocalDate(iso) : new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
