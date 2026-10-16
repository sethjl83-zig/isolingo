import { Colors } from '@/constants/theme';

/**
 * V0 always resolves the light palette. `dark` overrides are accepted so
 * existing call sites keep type-checking, and they are not applied.
 */
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light,
) {
  return props.light ?? Colors.light[colorName];
}
