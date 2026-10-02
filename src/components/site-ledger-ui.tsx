import { useEffect, useState, type ReactNode } from 'react';
import {
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Fonts, Motion, Palette, Radius } from '@/constants/theme';

type LedgerPressableProps = Omit<PressableProps, 'style'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  depth?: number;
  shadowColor?: string;
  pressedScale?: number;
};

/** A cross-platform physical press with a separate, reliable depth layer. */
export function LedgerPressable({
  children,
  style,
  containerStyle,
  depth = 3,
  shadowColor = Palette.line,
  pressedScale = 0.995,
  disabled,
  onPressIn,
  onPressOut,
  ...props
}: LedgerPressableProps) {
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(
    () => ({
      transform: [
        { translateY: pressed.value * depth },
        { scale: 1 - pressed.value * (1 - pressedScale) },
      ],
    }),
    [depth, pressedScale],
  );

  return (
    <View style={[styles.pressContainer, { marginBottom: depth }, containerStyle]}>
      <View
        pointerEvents="none"
        style={[styles.pressShadow, { backgroundColor: shadowColor, top: depth }]}
      />
      <Animated.View style={animatedStyle}>
        <Pressable
          {...props}
          disabled={disabled}
          onPressIn={(event) => {
            pressed.value = withTiming(1, {
              duration: Motion.pressIn,
              reduceMotion: ReduceMotion.System,
            });
            onPressIn?.(event);
          }}
          onPressOut={(event) => {
            pressed.value = withTiming(0, {
              duration: Motion.pressOut,
              reduceMotion: ReduceMotion.System,
            });
            onPressOut?.(event);
          }}
          style={[style, disabled && styles.disabled]}>
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}

type StatusTone = 'neutral' | 'positive' | 'negative' | 'warning';

export function StatusStamp({
  children,
  tone = 'neutral',
  animate = false,
  style,
}: {
  children: ReactNode;
  tone?: StatusTone;
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(animate ? 0.72 : 1);

  useEffect(() => {
    if (!animate) return;
    scale.value = withSequence(
      withTiming(1.1, { duration: 80, reduceMotion: ReduceMotion.System }),
      withSpring(1, {
        damping: 14,
        stiffness: 280,
        mass: 0.35,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [animate, scale]);

  const animatedStyle = useAnimatedStyle(
    () => ({ transform: [{ scale: scale.value }] }),
    [scale],
  );

  return (
    <Animated.View style={[styles.stamp, stampToneStyles[tone], animatedStyle, style]}>
      <Text style={[styles.stampText, stampTextToneStyles[tone]]}>{children}</Text>
    </Animated.View>
  );
}

export function CheckmarkDraw({
  active = true,
  animate = false,
}: {
  active?: boolean;
  animate?: boolean;
}) {
  const shortWidth = useSharedValue(active && !animate ? 7 : 0);
  const longWidth = useSharedValue(active && !animate ? 14 : 0);

  useEffect(() => {
    if (!active) {
      shortWidth.value = 0;
      longWidth.value = 0;
      return;
    }
    if (animate) {
      shortWidth.value = withTiming(7, {
        duration: 80,
        reduceMotion: ReduceMotion.System,
      });
      longWidth.value = withDelay(
        60,
        withTiming(14, { duration: 110, reduceMotion: ReduceMotion.System }),
      );
    } else {
      shortWidth.value = 7;
      longWidth.value = 14;
    }
  }, [active, animate, longWidth, shortWidth]);

  const shortStyle = useAnimatedStyle(() => ({ width: shortWidth.value }), [shortWidth]);
  const longStyle = useAnimatedStyle(() => ({ width: longWidth.value }), [longWidth]);

  return (
    <View accessibilityLabel="Completed" style={styles.checkmark}>
      <Animated.View style={[styles.checkStroke, styles.checkShort, shortStyle]} />
      <Animated.View style={[styles.checkStroke, styles.checkLong, longStyle]} />
    </View>
  );
}

type ToggleOption<T extends string> = { label: string; value: T };

export function FolderToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly ToggleOption<T>[];
  onChange: (value: T) => void;
}) {
  const [width, setWidth] = useState(0);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const position = useSharedValue(selectedIndex);

  useEffect(() => {
    position.value = withTiming(selectedIndex, {
      duration: Motion.toggle,
      reduceMotion: ReduceMotion.System,
    });
  }, [position, selectedIndex]);

  const itemWidth = width / options.length;
  const indicatorStyle = useAnimatedStyle(
    () => ({
      width: itemWidth,
      transform: [{ translateX: position.value * itemWidth }],
    }),
    [itemWidth, position],
  );

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={styles.toggle}>
      {width > 0 ? <Animated.View style={[styles.toggleIndicator, indicatorStyle]} /> : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={styles.toggleButton}>
            <Text style={[styles.toggleText, selected && styles.toggleTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const ledgerText = StyleSheet.create({
  body: { color: Palette.ink, fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22 },
  label: { color: Palette.steel, fontFamily: Fonts.sansMedium, fontSize: 13, lineHeight: 18 },
  heading: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 28, lineHeight: 34 },
  section: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 19, lineHeight: 25 },
  mono: { color: Palette.ink, fontFamily: Fonts.mono, fontSize: 14, lineHeight: 20 },
  monoStrong: {
    color: Palette.ink,
    fontFamily: Fonts.monoSemiBold,
    fontSize: 14,
    lineHeight: 20,
  },
});

export const ledgerControls = StyleSheet.create({
  primary: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.safety,
    borderColor: Palette.ink,
    borderRadius: Radius.control,
    borderWidth: 1,
    paddingHorizontal: 20,
  },
  primaryText: {
    color: Palette.ink,
    fontFamily: Fonts.sansBold,
    fontSize: 15,
  },
  secondary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.surface,
    borderColor: Palette.ink,
    borderRadius: Radius.control,
    borderWidth: 1,
    paddingHorizontal: 18,
  },
  secondaryText: {
    color: Palette.ink,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
  },
  input: {
    minHeight: 50,
    backgroundColor: Palette.surface,
    borderColor: Palette.steel,
    borderRadius: Radius.control,
    borderWidth: 1,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 16,
    paddingHorizontal: 14,
  },
});

const stampToneStyles: Record<StatusTone, ViewStyle> = {
  neutral: { backgroundColor: Palette.steel },
  positive: { backgroundColor: Palette.onSite },
  negative: { backgroundColor: Palette.alert },
  warning: { backgroundColor: Palette.safety },
};

const stampTextToneStyles: Record<StatusTone, TextStyle> = {
  neutral: { color: Palette.surface },
  positive: { color: Palette.surface },
  negative: { color: Palette.surface },
  warning: { color: Palette.ink },
};

const styles = StyleSheet.create({
  pressContainer: { position: 'relative' },
  pressShadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Radius.control,
  },
  disabled: { opacity: 0.55 },
  stamp: {
    alignSelf: 'flex-start',
    borderRadius: Radius.stamp,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stampText: {
    fontFamily: Fonts.monoSemiBold,
    fontSize: 10,
    letterSpacing: 0.25,
  },
  checkmark: { width: 21, height: 18, position: 'relative' },
  checkStroke: {
    position: 'absolute',
    height: 3,
    borderRadius: 1,
    backgroundColor: Palette.onSite,
  },
  checkShort: { left: 1, top: 9, transform: [{ rotate: '42deg' }] },
  checkLong: { left: 6, top: 8, transform: [{ rotate: '-48deg' }] },
  toggle: {
    minHeight: 45,
    flexDirection: 'row',
    position: 'relative',
    borderBottomColor: Palette.line,
    borderBottomWidth: 1,
    marginTop: 20,
  },
  toggleIndicator: {
    position: 'absolute',
    top: 0,
    bottom: -1,
    left: 0,
    backgroundColor: Palette.surface,
    borderColor: Palette.line,
    borderTopLeftRadius: Radius.control,
    borderTopRightRadius: Radius.control,
    borderWidth: 1,
    borderBottomColor: Palette.safety,
    borderBottomWidth: 3,
  },
  toggleButton: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  toggleText: {
    color: Palette.steel,
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
  },
  toggleTextActive: { color: Palette.ink, fontFamily: Fonts.sansSemiBold },
});

export type LedgerTextStyle = StyleProp<TextStyle>;
