import { Platform } from 'react-native';

// ── Gender colour system (spec-defined, immutable) ────────────────────────────
export const GenderColors = {
  masculine: '#4da3ff',
  feminine: '#d66aa6',
  neuter: '#A4922D',
} as const;

// ── App palette ───────────────────────────────────────────────────────────────
// Light values are the designer's Home palette. Gender colours stay in
// GenderColors and are not reused here.
// Dark brand colours are the same purple/teal, lightened only where the old
// dark theme used a lighter tint for text on a dark background.
export const Colors = {
  light: {
    text: '#25262B',
    subtext: '#636265',
    background: '#F7F5FD',
    card: '#FEFEFE',
    border: '#E0E0E0',
    tint: '#5E51A4',
    buttonPrimary: '#5E51A4',
    buttonPrimaryText: '#FFFFFF',
    buttonSecondary: '#EFEFEF',
    buttonSecondaryText: '#333333',
    correct: '#38A19A',
    incorrect: '#E74C3C',
    feedback: '#F9F9F9',
    icon: '#636265',
    primary: '#5E51A4',
    teal: '#38A19A',
    amberFill: '#FDE6B9',
    amberText: '#603808',
    progressCard: '#F8F9FF',
    badgeFill: '#E0DCF0',
    iconCircle: '#F0EDFC',
    listCardBorder: '#DAECDF',
    destructive: '#F74856',
    listIconOrange: '#FEA835',
    listIconBlue: '#5DB0FA',
    listIconFood: '#D04598',
    listIconNature: '#709E1E',
  },
  // Kept for a later dark-mode pass. V0 does not read this object.
  dark: {
    text: '#ECEDEE',
    subtext: '#9BA1A6',
    background: '#151718',
    card: '#1E2122',
    border: '#2A2F31',
    tint: '#A89BE0',
    buttonPrimary: '#5E51A4',
    buttonPrimaryText: '#FFFFFF',
    buttonSecondary: '#2A2F31',
    buttonSecondaryText: '#ECEDEE',
    correct: '#38A19A',
    incorrect: '#C0392B',
    feedback: '#1A1F20',
    icon: '#9BA1A6',
    primary: '#5E51A4',
    teal: '#38A19A',
    amberFill: '#FDE6B9',
    amberText: '#603808',
    progressCard: '#22242C',
    badgeFill: '#3A3654',
    iconCircle: '#2C2A40',
    listCardBorder: '#DAECDF',
    destructive: '#F74856',
    listIconOrange: '#FEA835',
    listIconBlue: '#5DB0FA',
    listIconFood: '#D04598',
    listIconNature: '#709E1E',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
