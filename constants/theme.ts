import { Platform } from 'react-native';

// ── Gender colour system (spec-defined, immutable) ────────────────────────────
export const GenderColors = {
  masculine: '#4da3ff',
  feminine: '#d66aa6',
  neuter: '#A4922D',
} as const;

// ── App palette ───────────────────────────────────────────────────────────────
export const Colors = {
  light: {
    text: '#11181C',
    subtext: '#687076',
    background: '#F5F5F7',
    card: '#FFFFFF',
    border: '#E0E0E0',
    tint: '#2C6BED',
    buttonPrimary: '#2C6BED',
    buttonPrimaryText: '#FFFFFF',
    buttonSecondary: '#EFEFEF',
    buttonSecondaryText: '#333333',
    correct: '#2ECC71',
    incorrect: '#E74C3C',
    feedback: '#F9F9F9',
    icon: '#687076',
  },
  dark: {
    text: '#ECEDEE',
    subtext: '#9BA1A6',
    background: '#151718',
    card: '#1E2122',
    border: '#2A2F31',
    tint: '#5B8EF0',
    buttonPrimary: '#5B8EF0',
    buttonPrimaryText: '#FFFFFF',
    buttonSecondary: '#2A2F31',
    buttonSecondaryText: '#ECEDEE',
    correct: '#27AE60',
    incorrect: '#C0392B',
    feedback: '#1A1F20',
    icon: '#9BA1A6',
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
