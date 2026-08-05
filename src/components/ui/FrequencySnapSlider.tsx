import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useColorScheme,
  LayoutChangeEvent,
} from 'react-native';
import { Colors } from '@/constants/theme';
import {
  FREQUENCY_ORDER,
  FREQUENCY_LABELS,
  FREQUENCY_INDICATOR_COLORS,
  type WordFrequencySetting,
} from '@/src/types/state';

const TRACK_HEIGHT = 9;
const THUMB_SIZE = 28;
const POSITION_COUNT = FREQUENCY_ORDER.length;

interface FrequencySnapSliderProps {
  value: WordFrequencySetting;
  onChange: (value: WordFrequencySetting) => void;
  compact?: boolean;
}

function FrequencySnapSlider({
  value,
  onChange,
  compact = false,
}: FrequencySnapSliderProps) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const activeIndex = FREQUENCY_ORDER.indexOf(value);
  const [trackWidth, setTrackWidth] = useState(0);

  const onTrackLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  const thumbLeft =
    trackWidth > 0
      ? (activeIndex / (POSITION_COUNT - 1)) * Math.max(0, trackWidth - THUMB_SIZE)
      : 0;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={[styles.label, { color: palette.text }]}>
        {FREQUENCY_LABELS[value]}
      </Text>

      <View style={styles.touchArea}>
        <View
          style={[styles.track, { backgroundColor: palette.border }]}
          onLayout={onTrackLayout}
        >
          {FREQUENCY_ORDER.map((setting, index) => (
            <Pressable
              key={setting}
              style={styles.zone}
              onPress={() => onChange(setting)}
              accessibilityRole="button"
              accessibilityLabel={`Set frequency to ${FREQUENCY_LABELS[setting]}`}
              accessibilityState={{ selected: index === activeIndex }}
            />
          ))}

          {trackWidth > 0 && (
            <View
              pointerEvents="none"
              style={[
                styles.thumb,
                {
                  backgroundColor: FREQUENCY_INDICATOR_COLORS[value],
                  left: thumbLeft,
                },
              ]}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 132, alignItems: 'center', gap: 8 },
  wrapCompact: { width: 112 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  touchArea: {
    width: '100%',
    minHeight: 44,
    justifyContent: 'center',
  },
  track: {
    width: '100%',
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  zone: {
    flex: 1,
    height: 44,
    marginVertical: -(44 - TRACK_HEIGHT) / 2,
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    top: (TRACK_HEIGHT - THUMB_SIZE) / 2,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default React.memo(FrequencySnapSlider);
