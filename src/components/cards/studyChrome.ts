import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { HomeFonts } from '@/constants/homeFonts';

/** Shared study-card header and Flip / Submit bar. Figma px values. */
export const studyChrome = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  exit: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 17.5,
    color: '#5E51A4',
  },
  home: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 18,
    color: '#5E51A4',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 10,
  },
});

export const actionButtonStyle: ViewStyle = {
  flex: 1,
  height: 48,
  minWidth: 0,
  paddingVertical: 0,
  paddingHorizontal: 12,
  borderRadius: 12,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.05,
  elevation: 2,
};

export const flipButtonStyle: ViewStyle = {
  ...actionButtonStyle,
  borderWidth: 1,
  shadowRadius: 12,
};

export const submitButtonStyle: ViewStyle = {
  ...actionButtonStyle,
  shadowRadius: 6,
};

export const actionLabelStyle: TextStyle = {
  fontFamily: HomeFonts.interSemiBold,
  fontWeight: 'normal',
  fontSize: 16,
  lineHeight: 24,
};
