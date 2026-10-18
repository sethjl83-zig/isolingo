/**
 * CorrectText — animated "Correct!" label shown on a right answer.
 *
 * Mount it conditionally when the answer is correct.
 * It runs a scale-pop animation once on mount and then stays visible.
 */
import React, { useEffect } from 'react';
import { StyleProp, TextStyle } from 'react-native';
import { HomeFonts } from '@/constants/homeFonts';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

interface Props {
  color: string;
  /** Optional outer wrapper style (use for marginTop, alignment, etc.) */
  style?: StyleProp<TextStyle>;
}

export default function CorrectText({ color, style }: Props) {
  const scale = useSharedValue(0.05);

  useEffect(() => {
    // Quick pop: shoot past 1 then snap back, total ~340 ms
    scale.value = withSequence(
      withTiming(1.22, { duration: 210, easing: Easing.out(Easing.quad) }),
      withTiming(1.0,  { duration: 130, easing: Easing.inOut(Easing.quad) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.Text
      style={[
        {
          fontFamily: HomeFonts.jakartaSemiBold,
          fontWeight: 'normal',
          fontSize: 14.5,
          lineHeight: 20,
          textAlign: 'center',
          color,
        },
        style,
        animStyle,
      ]}
    >
      Correct!
    </Animated.Text>
  );
}
