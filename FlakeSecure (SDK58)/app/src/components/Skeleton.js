export default {}; // Satisfies Expo Router

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

export function SkeletonItem({ width, height, borderRadius = 8, style }) {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        styles.skeletonBase,
        {
          width: width !== undefined ? width : '100%',
          height: height !== undefined ? height : 16,
          borderRadius,
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
}

export function CredentialCardSkeleton() {
  return (
    <View style={styles.cardSkeleton}>
      <View style={styles.cardHeader}>
        <SkeletonItem width={40} height={40} borderRadius={20} />
        <View style={styles.cardTextCol}>
          <SkeletonItem width="60%" height={16} borderRadius={6} style={{ marginBottom: 6 }} />
          <SkeletonItem width="40%" height={12} borderRadius={4} />
        </View>
        <SkeletonItem width={24} height={24} borderRadius={12} />
      </View>
    </View>
  );
}

export function LogRowSkeleton() {
  return (
    <View style={styles.logSkeleton}>
      <SkeletonItem width={36} height={36} borderRadius={10} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <SkeletonItem width="50%" height={14} borderRadius={4} style={{ marginBottom: 6 }} />
        <SkeletonItem width="75%" height={11} borderRadius={4} />
      </View>
      <SkeletonItem width={50} height={12} borderRadius={4} />
    </View>
  );
}

export function SessionCardSkeleton() {
  return (
    <View style={styles.cardSkeleton}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <SkeletonItem width="55%" height={14} borderRadius={4} style={{ marginBottom: 6 }} />
          <SkeletonItem width="35%" height={11} borderRadius={4} />
        </View>
        <SkeletonItem width={60} height={28} borderRadius={8} />
      </View>
    </View>
  );
}

export function DetailFieldSkeleton() {
  return (
    <View style={{ marginBottom: 18 }}>
      <SkeletonItem width={80} height={12} borderRadius={4} style={{ marginBottom: 8 }} />
      <SkeletonItem width="100%" height={48} borderRadius={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonBase: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  cardSkeleton: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTextCol: {
    flex: 1,
    marginLeft: 12,
  },
  logSkeleton: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
