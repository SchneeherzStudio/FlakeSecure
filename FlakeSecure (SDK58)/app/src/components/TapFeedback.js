export default {}; // Satisfies Expo Router

import React, { useRef } from 'react';
import { Pressable, Animated, StyleSheet } from 'react-native';

export function TapFeedback({
  children,
  onPress,
  onLongPress,
  disabled = false,
  style,
  containerStyle,
  scaleTo = 0.96,
  hitSlop,
  ...props
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: scaleTo,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const flatStyle = StyleSheet.flatten(style) || {};
  const pressableStyle = [
    flatStyle.flex !== undefined ? { flex: flatStyle.flex } : null,
    containerStyle,
  ];

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      style={pressableStyle}
      {...props}
    >
      <Animated.View style={[{ transform: [{ scale: scaleAnim }], width: flatStyle.flex !== undefined ? '100%' : undefined }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
