/**
 * Fixed study header. Row 1 is Exit Study and Home. Row 2 is the direction
 * slider and, for a one-list session, the deck-options icon. A caption line
 * under that row stays reserved so the card does not move when it appears.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Animated,
  Platform,
  PixelRatio,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { HomeFonts } from '@/constants/homeFonts';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { DirectionMode } from '@/src/types/state';
import type { Language } from '@/src/types/vocab';

const MODES: DirectionMode[] = ['target_to_native', 'native_to_target', 'mixed'];
const TRACK_WIDTH = 194;
const SEGMENT = TRACK_WIDTH / MODES.length;
const TRACK_HEIGHT = 29;
const KNOB_INSET = 2;
/** A press that moves less than this is a tap on the segment under the finger. */
const TAP_MOVE = 8;

/** Text is shorter than 44. hitSlop brings the tap target up to 44 points. */
const LABEL_HIT_SLOP = { top: 12, bottom: 12, left: 8, right: 8 };
/** The glyph is 20 points. 12 points of hitSlop on each side makes the target 44. */
const ICON_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
/** The track is 29 points. 8 points of hitSlop on each side makes the target 45. */
const SLIDER_HIT_SLOP = { top: 8, bottom: 8, left: 0, right: 0 };

const androidFont = Platform.OS === 'android' ? { includeFontPadding: false as const } : null;

function languageCode(language: Language): string {
  if (language === 'fr') return 'Fr';
  if (language === 'es') return 'Sp';
  return 'Ge';
}

function segmentLabel(mode: DirectionMode, code: string): string {
  if (mode === 'native_to_target') return `En → ${code}`;
  if (mode === 'mixed') return 'Mixed';
  return `${code} → En`;
}

function nearestIndex(value: number): number {
  return Math.min(MODES.length - 1, Math.max(0, Math.round(value)));
}

interface Props {
  language: Language;
  direction: DirectionMode;
  onSelectDirection: (mode: DirectionMode) => void;
  onExit: () => void;
  onHome: () => void;
  showDeckOptions: boolean;
  onOpenDeckOptions: () => void;
  headerNotice?: string | null;
}

export default function SessionHeader({
  language,
  direction,
  onSelectDirection,
  onExit,
  onHome,
  showDeckOptions,
  onOpenDeckOptions,
  headerNotice,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const code = languageCode(language);
  const fontScale = PixelRatio.getFontScale();
  const fontSize = 13 * fontScale;
  const lineHeight = fontSize * (18 / 13);
  const directionRef = useRef(direction);
  const onSelectRef = useRef(onSelectDirection);
  directionRef.current = direction;
  onSelectRef.current = onSelectDirection;

  const position = useRef(new Animated.Value(MODES.indexOf(direction))).current;
  const dragging = useRef(false);
  const dragOrigin = useRef(MODES.indexOf(direction));
  const captionOpacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [knobIndex, setKnobIndex] = useState(MODES.indexOf(direction));
  const [captionVisible, setCaptionVisible] = useState(false);
  const captionLine = 16 * fontScale;
  const trackRef = useRef<View>(null);
  const trackPageX = useRef(0);

  const rememberTrackX = () => {
    trackRef.current?.measureInWindow(x => {
      trackPageX.current = x;
    });
  };

  useEffect(() => {
    setKnobIndex(MODES.indexOf(direction));
    if (dragging.current) return;
    Animated.timing(position, {
      toValue: MODES.indexOf(direction),
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [direction, position]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const showCaption = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCaptionVisible(true);
    Animated.timing(captionOpacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
    timerRef.current = setTimeout(() => {
      Animated.timing(captionOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setCaptionVisible(false));
    }, 2000);
  };

  const commit = (index: number) => {
    const next = MODES[index];
    if (next === directionRef.current) return;
    onSelectRef.current(next);
    showCaption();
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragging.current = true;
        dragOrigin.current = MODES.indexOf(directionRef.current);
        rememberTrackX();
        position.stopAnimation(value => {
          dragOrigin.current = value;
        });
      },
      onPanResponderMove: (_, gesture) => {
        if (Math.hypot(gesture.dx, gesture.dy) < TAP_MOVE) return;
        const next = Math.min(
          MODES.length - 1,
          Math.max(0, dragOrigin.current + gesture.dx / SEGMENT),
        );
        position.setValue(next);
        const landed = nearestIndex(next);
        setKnobIndex(prev => (prev === landed ? prev : landed));
      },
      onPanResponderRelease: (event, gesture) => {
        dragging.current = false;
        const tapped = Math.hypot(gesture.dx, gesture.dy) < TAP_MOVE;
        const touchedX = event.nativeEvent.locationX;
        const localX = touchedX >= 0 && touchedX <= TRACK_WIDTH
          ? touchedX
          : gesture.x0 - trackPageX.current;
        const index = tapped
          ? Math.min(MODES.length - 1, Math.max(0, Math.floor(localX / SEGMENT)))
          : nearestIndex(dragOrigin.current + gesture.dx / SEGMENT);
        setKnobIndex(index);
        Animated.timing(position, {
          toValue: index,
          duration: 180,
          useNativeDriver: true,
        }).start();
        if (MODES[index] === directionRef.current) return;
        commit(index);
      },
      onPanResponderTerminate: () => {
        dragging.current = false;
        const index = MODES.indexOf(directionRef.current);
        setKnobIndex(index);
        Animated.timing(position, {
          toValue: index,
          duration: 180,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  const knobShift = position.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [KNOB_INSET, SEGMENT + KNOB_INSET, SEGMENT * 2 + KNOB_INSET],
  });
  const labelStyle = [
    styles.segmentText,
    { fontSize, lineHeight, color: palette.primary },
  ];
  const selectedLabelStyle = [
    styles.segmentText,
    styles.selectedText,
    { fontSize, lineHeight, color: palette.buttonPrimaryText },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TouchableOpacity
          onPress={onExit}
          hitSlop={LABEL_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Exit Study"
        >
          <Text style={styles.exit}>Exit Study</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onHome}
          hitSlop={LABEL_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Home"
        >
          <Text style={styles.home}>Home</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sliderRow}>
        <View
          ref={trackRef}
          onLayout={rememberTrackX}
          style={[styles.track, { backgroundColor: palette.badgeFill }]}
          hitSlop={SLIDER_HIT_SLOP}
          accessibilityRole="adjustable"
          accessibilityLabel="Study direction"
          accessibilityValue={{ text: segmentLabel(direction, code) }}
          {...pan.panHandlers}
        >
          {MODES.map(mode => (
            <Text
              key={mode}
              style={labelStyle}
              numberOfLines={1}
              allowFontScaling={false}
              pointerEvents="none"
            >
              {segmentLabel(mode, code)}
            </Text>
          ))}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.knob,
              { backgroundColor: palette.primary, transform: [{ translateX: knobShift }] },
            ]}
          >
            <Text
              style={selectedLabelStyle}
              numberOfLines={1}
              allowFontScaling={false}
            >
              {segmentLabel(MODES[knobIndex], code)}
            </Text>
          </Animated.View>
        </View>
        {showDeckOptions ? (
          <TouchableOpacity
            onPress={onOpenDeckOptions}
            hitSlop={ICON_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Deck options"
            style={styles.optionsButton}
          >
            <MaterialCommunityIcons
              name="tune-variant"
              size={20}
              color={palette.primary}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      <Animated.Text
        style={[
          styles.caption,
          androidFont,
          {
            color: palette.subtext,
            opacity: headerNotice ? 1 : captionOpacity,
            height: captionLine,
            fontSize: 13 * fontScale,
            lineHeight: captionLine,
          },
        ]}
        numberOfLines={1}
        pointerEvents="none"
        allowFontScaling={false}
        accessibilityElementsHidden={!headerNotice && !captionVisible}
        importantForAccessibility={headerNotice || captionVisible ? 'yes' : 'no-hide-descendants'}
      >
        {headerNotice ?? 'Applies from the next card'}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 6,
    paddingHorizontal: 16,
    zIndex: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exit: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 17.5,
    lineHeight: 22,
    color: '#5E51A4',
  },
  home: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 18,
    lineHeight: 22,
    color: '#5E51A4',
  },
  optionsButton: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  knob: {
    position: 'absolute',
    left: 0,
    top: KNOB_INSET,
    width: SEGMENT - KNOB_INSET * 2,
    height: TRACK_HEIGHT - KNOB_INSET * 2,
    borderRadius: (TRACK_HEIGHT - KNOB_INSET * 2) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    includeFontPadding: false,
  },
  selectedText: {
    fontFamily: HomeFonts.interSemiBold,
  },
  caption: {
    marginTop: 2,
    textAlign: 'center',
    fontFamily: HomeFonts.interRegular,
    fontWeight: 'normal',
  },
});
