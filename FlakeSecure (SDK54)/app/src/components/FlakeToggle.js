import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const TRACK_WIDTH = 50;
const TRACK_HEIGHT = 28;
const THUMB_SIZE = 22;
const PADDING = 3;
const TRAVEL_DISTANCE = TRACK_WIDTH - THUMB_SIZE - PADDING * 2;

export default function FlakeToggle({
  value = false,
  onValueChange,
  disabled = false,
  style,
}) {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0,
      damping: 18,
      stiffness: 220,
      mass: 0.8,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const activeColor = colors.gold || '#E8B020';
  const inactiveColor = colors.isDark ? '#475569' : '#94a3b8';

  const bgColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [inactiveColor, activeColor],
  });

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRAVEL_DISTANCE],
  });

  const handlePress = () => {
    if (disabled) return;
    if (typeof onValueChange === 'function') {
      onValueChange(!value);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="switch"
      accessibilityState={{ checked: !!value, disabled: !!disabled }}
      style={[disabled && { opacity: 0.5 }, style]}
    >
      <Animated.View
        style={[
          styles.track,
          {
            backgroundColor: bgColor,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumbWrapper,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          {/* Soft ambient shadow under the round thumb */}
          <View style={styles.thumbShadowOuter} />
          {/* Crisp contact shadow directly under the round thumb */}
          <View style={styles.thumbShadowInner} />
          {/* Unified-color round thumb */}
          <Animated.View
            style={[
              styles.thumb,
              {
                backgroundColor: bgColor,
              },
            ]}
          />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    padding: PADDING,
    justifyContent: 'center',
  },
  thumbWrapper: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbShadowOuter: {
    position: 'absolute',
    top: 2,
    bottom: -3,
    left: -2,
    right: -2,
    borderRadius: (THUMB_SIZE + 4) / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
  },
  thumbShadowInner: {
    position: 'absolute',
    top: 1,
    bottom: -1.5,
    left: -1,
    right: -1,
    borderRadius: (THUMB_SIZE + 2) / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 3.5,
    elevation: 6,
  },
});
