import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';

import {
  FREQUENCY_ORDER,
  FREQUENCY_LABELS,
  FREQUENCY_INDICATOR_COLORS,
  FREQUENCY_TRACK_COLORS,
  type WordFrequencySetting,
} from '@/src/types/state';

const TRACK_HEIGHT = 9;
const THUMB_SIZE = 27;
const POSITION_COUNT = FREQUENCY_ORDER.length;

interface FrequencySnapSliderProps {
  value: WordFrequencySetting;
  onChange: (value: WordFrequencySetting) => void;
  compact?: boolean;
  /** Vocab-bank rows put the value label beside the track. */
  hideLabel?: boolean;
}

function FrequencySnapSlider({
  value,
  onChange,
  compact = false,
  hideLabel = false,
}: FrequencySnapSliderProps) {
  const activeIndex = FREQUENCY_ORDER.indexOf(value);
  const [trackWidth, setTrackWidth] = useState(0);

  const onTrackLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  const indicatorColor = FREQUENCY_INDICATOR_COLORS[value];
  const thumbLeft =
    trackWidth > 0
      ? (activeIndex / (POSITION_COUNT - 1)) * Math.max(0, trackWidth - THUMB_SIZE)
      : 0;
  const fillWidth = trackWidth > 0 ? thumbLeft + THUMB_SIZE / 2 : 0;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact, hideLabel && styles.wrapInline]}>
      {!hideLabel && (
        <Text style={[styles.label, { color: indicatorColor }]}>
          {FREQUENCY_LABELS[value]}
        </Text>
      )}

      <View style={[styles.touchArea, hideLabel && styles.touchAreaInline]}>
        <View
          style={[styles.track, { backgroundColor: FREQUENCY_TRACK_COLORS[value] }]}
          onLayout={onTrackLayout}
        >
          {trackWidth > 0 && (
            <View pointerEvents="none" style={styles.trackClip}>
              <View
                style={[
                  styles.trackFill,
                  { width: fillWidth, backgroundColor: indicatorColor },
                ]}
              />
            </View>
          )}

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
                  backgroundColor: indicatorColor,
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
  wrapInline: { width: 159, gap: 0 },
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
  touchAreaInline: { minHeight: 27 },
  track: {
    width: '100%',
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  trackClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: TRACK_HEIGHT / 2,
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
  },
});

export default React.memo(FrequencySnapSlider);
