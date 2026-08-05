import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Intercepts the Android hardware back button while this screen is focused.
 * The handler should return true to prevent the default stack pop.
 */
export function useAndroidBackHandler(handler: () => boolean) {
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', handler);
      return () => subscription.remove();
    }, [handler]),
  );
}
