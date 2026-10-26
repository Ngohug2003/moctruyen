import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable as NativePressable,
  type PressableProps,
  type ViewProps,
} from 'react-native';

const ReducedMotion = createContext(true);
const AnimatedPressable = Animated.createAnimatedComponent(NativePressable);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    // Listen first so a settings change cannot be lost during the initial query.
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      changed = true;
      if (active) setReduced(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active && !changed) setReduced(value);
      })
      .catch(() => {});
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return <ReducedMotion.Provider value={reduced}>{children}</ReducedMotion.Provider>;
}

export function useReducedMotion() {
  return useContext(ReducedMotion);
}

/** Animate a screen or panel once; never animate individual chapter paragraphs. */
export function Entrance({ children, style, ...props }: ViewProps) {
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const transition = Animated.timing(progress, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    });
    transition.start();
    return () => transition.stop();
  }, [progress, reduced]);
  return (
    <Animated.View
      {...props}
      style={[
        style,
        !reduced && {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function MotionPressable({
  style,
  onPressIn,
  onPressOut,
  feedback = true,
  accessibilityRole = 'button',
  ...props
}: PressableProps & { feedback?: boolean }) {
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    scale.stopAnimation();
    scale.setValue(1);
    return () => scale.stopAnimation();
  }, [feedback, reduced, scale]);
  function animatePress(active: boolean) {
    if (!feedback || reduced) return;
    Animated.timing(scale, {
      toValue: active ? 0.98 : 1,
      duration: active ? 90 : 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    }).start();
  }
  return (
    <AnimatedPressable
      {...props}
      accessibilityRole={accessibilityRole}
      onPressIn={(event) => {
        setPressed(true);
        animatePress(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        animatePress(false);
        onPressOut?.(event);
      }}
      style={[
        typeof style === 'function' ? style({ pressed }) : style,
        feedback && !reduced ? { transform: [{ scale }] } : undefined,
      ]}
    />
  );
}
