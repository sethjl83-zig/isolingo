/**
 * V0 is light-only. This does not read the phone's appearance setting.
 * Dark palette values stay in constants/theme.ts for a later dark-mode pass.
 */
export function useColorScheme(): 'light' {
  return 'light';
}
