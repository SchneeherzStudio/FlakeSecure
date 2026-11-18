/**
 * ============================================================================
 * FlakeSecure - Yuki Mascot Speech Bubble & Onboarding Guide Component
 * ============================================================================
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { getYukiPose } from './yukiPoses';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function YukiGuide({
  pose = 'sit',
  title,
  text,
  mode = 'onboarding', // 'onboarding' | 'onboardingCompact' | 'spotlight'
  stepIndex = 0,
  totalSteps = 1,
  onNext,
  onBack,
  onSkip,
  nextLabel = 'Next',
  backLabel = 'Back',
  skipLabel = 'Skip',
  doneLabel = 'Done!',
  stepLabel,
  isLastStep = false,
  yukiSide = 'left', // 'left' | 'right'
  bubblePlacement = 'below', // 'above' | 'below' | 'center'
  targetCenterX = SCREEN_WIDTH / 2,
  reduceMotion = false,
}) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) {
      scaleAnim.setValue(1);
      fadeAnim.setValue(1);
      return;
    }
    scaleAnim.setValue(0.9);
    fadeAnim.setValue(0.65);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 110,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [pose, text, reduceMotion]);

  const yukiSource = getYukiPose(pose);

  if (mode === 'onboardingCompact') {
    return (
      <Animated.View
        style={[
          styles.compactContainer,
          {
            backgroundColor: colors.goldBg,
            borderColor: colors.goldBorder,
            opacity: fadeAnim,
          },
        ]}
      >
        <View
          style={[
            styles.compactAvatar,
            { backgroundColor: colors.cardBg, borderColor: colors.goldBorder },
          ]}
        >
          <Image
            source={yukiSource}
            style={styles.compactImg}
            contentFit="contain"
          />
        </View>
        <Text style={[styles.compactText, { color: colors.textSub }]}>
          {text}
        </Text>
      </Animated.View>
    );
  }

  if (mode === 'onboarding') {
    return (
      <Animated.View
        style={[
          styles.onboardContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View
          style={[
            styles.onboardAvatarWrap,
            {
              backgroundColor: colors.goldBg,
              borderColor: colors.goldBorder,
            },
          ]}
        >
          <Image
            source={yukiSource}
            style={styles.onboardImg}
            contentFit="contain"
          />
        </View>

        <View style={styles.onboardBubbleWrap}>
          <Svg width={10} height={16} viewBox="0 0 10 16" style={styles.leftPointer}>
            <Polygon
              points="10,0 0,8 10,16"
              fill={colors.isDark ? '#121828' : '#ffffff'}
              stroke={colors.goldBorder}
              strokeWidth="1.2"
            />
          </Svg>
          <View
            style={[
              styles.onboardBubble,
              {
                backgroundColor: colors.isDark ? '#121828' : '#ffffff',
                borderColor: colors.goldBorder,
              },
            ]}
          >
            <View style={styles.yukiNameTagRow}>
              <View
                style={[
                  styles.yukiPill,
                  { backgroundColor: colors.goldBg, borderColor: colors.goldBorder },
                ]}
              >
                <Text style={[styles.yukiPillText, { color: colors.gold }]}>
                  YUKI
                </Text>
              </View>
            </View>
            <Text style={[styles.onboardBubbleText, { color: colors.textMain }]}>
              {text}
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  }

  // Spotlight coach-mark mode
  const bubbleBg = colors.isDark ? '#111827' : '#ffffff';
  const clampedPointerOffset = Math.max(
    18,
    Math.min(SCREEN_WIDTH - 32 - 38, targetCenterX - 16 - 10)
  );
  const mirrorYuki = yukiSide === 'right';
  const displayedStep = stepLabel || `${stepIndex + 1} / ${totalSteps}`;

  const renderPointer = (direction) => {
    if (bubblePlacement === 'center') return null;
    if (direction === 'up') {
      return (
        <View style={[styles.pointerRow, { paddingLeft: clampedPointerOffset }]}>
          <Svg width={20} height={11} viewBox="0 0 20 11">
            <Polygon
              points="0,11 10,0 20,11"
              fill={bubbleBg}
              stroke={colors.gold}
              strokeWidth="1.5"
            />
          </Svg>
        </View>
      );
    }
    return (
      <View style={[styles.pointerRow, { paddingLeft: clampedPointerOffset }]}>
        <Svg width={20} height={11} viewBox="0 0 20 11">
          <Polygon
            points="0,0 10,11 20,0"
            fill={bubbleBg}
            stroke={colors.gold}
            strokeWidth="1.5"
          />
        </Svg>
      </View>
    );
  };

  const yukiRow = (
    <Animated.View
      style={[
        styles.spotlightYukiRow,
        {
          justifyContent:
            bubblePlacement === 'center'
              ? 'center'
              : yukiSide === 'right'
                ? 'flex-end'
                : 'flex-start',
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View
        style={[
          bubblePlacement === 'center'
            ? styles.spotlightYukiGlowLarge
            : styles.spotlightYukiGlow,
          {
            backgroundColor: colors.isDark
              ? 'rgba(232, 176, 32, 0.14)'
              : 'rgba(217, 119, 6, 0.12)',
            borderColor: colors.goldBorder,
          },
        ]}
      >
        <Image
          source={yukiSource}
          style={[
            bubblePlacement === 'center'
              ? styles.spotlightYukiLargeImg
              : styles.spotlightYukiImg,
            mirrorYuki && bubblePlacement !== 'center'
              ? { transform: [{ scaleX: -1 }] }
              : null,
          ]}
          contentFit="contain"
        />
      </View>
    </Animated.View>
  );

  const bubbleCard = (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[
        styles.spotlightBubbleWrapper,
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
      ]}
    >
      {bubblePlacement === 'below' && renderPointer('up')}
      <View
        style={[
          styles.spotlightCard,
          {
            backgroundColor: bubbleBg,
            borderColor: colors.gold,
          },
        ]}
      >
        <View style={styles.spotlightHeader}>
          <View style={styles.spotlightHeaderLeft}>
            <View
              style={[
                styles.yukiPill,
                { backgroundColor: colors.goldBg, borderColor: colors.goldBorder },
              ]}
            >
              <Text style={[styles.yukiPillText, { color: colors.gold }]}>
                YUKI
              </Text>
            </View>
            <Text style={[styles.stepCounterText, { color: colors.textMuted }]}>
              {displayedStep}
            </Text>
          </View>

          {onSkip ? (
            <TouchableOpacity
              onPress={onSkip}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Text style={[styles.skipLinkText, { color: colors.textMuted }]}>
                {skipLabel}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {title ? (
          <Text style={[styles.spotlightTitle, { color: colors.textMain }]}>
            {title}
          </Text>
        ) : null}

        <ScrollView
          style={styles.spotlightBodyScroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Text style={[styles.spotlightText, { color: colors.textSub }]}>
            {text}
          </Text>
        </ScrollView>

        <View style={styles.spotlightActions}>
          {stepIndex > 0 && onBack ? (
            <TouchableOpacity
              onPress={onBack}
              style={[
                styles.backActionBtn,
                {
                  backgroundColor: colors.cardBg,
                  borderColor: colors.border,
                },
              ]}
              activeOpacity={0.75}
            >
              <Text style={[styles.backActionText, { color: colors.textSub }]}>
                {backLabel}
              </Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}

          <TouchableOpacity
            onPress={onNext}
            style={styles.nextActionWrap}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={colors.goldGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextActionGrad}
            >
              <Text style={styles.nextActionText}>
                {isLastStep ? doneLabel : nextLabel}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
      {bubblePlacement === 'above' && renderPointer('down')}
    </Animated.View>
  );

  return (
    <View style={styles.spotlightWrapper}>
      {bubblePlacement === 'below' ? (
        <>
          {bubbleCard}
          {yukiRow}
        </>
      ) : (
        <>
          {yukiRow}
          {bubbleCard}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Onboarding horizontal Yuki + speech bubble
  onboardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 14,
  },
  onboardAvatarWrap: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 4,
  },
  onboardImg: {
    width: 68,
    height: 68,
  },
  onboardBubbleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftPointer: {
    marginRight: -1.5,
    zIndex: 2,
  },
  onboardBubble: {
    flex: 1,
    borderWidth: 1.2,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  yukiNameTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  yukiPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  yukiPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  onboardBubbleText: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
  },

  // Compact onboarding strip for Account step
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 10,
    marginBottom: 14,
  },
  compactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  compactImg: {
    width: 40,
    height: 40,
  },
  compactText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16.5,
    fontWeight: '500',
  },

  // Spotlight Coach-Mark Mode
  spotlightWrapper: {
    width: '100%',
    paddingHorizontal: 16,
  },
  spotlightBubbleWrapper: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  pointerRow: {
    flexDirection: 'row',
    marginVertical: -1.5,
    zIndex: 3,
  },
  spotlightCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 14,
  },
  spotlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  spotlightHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepCounterText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  skipLinkText: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  spotlightTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  spotlightBodyScroll: {
    maxHeight: 145,
    marginBottom: 14,
  },
  spotlightText: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  spotlightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  backActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  nextActionWrap: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  nextActionGrad: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextActionText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800',
  },
  spotlightYukiRow: {
    flexDirection: 'row',
    marginVertical: 8,
    paddingHorizontal: 12,
  },
  spotlightYukiGlow: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  spotlightYukiImg: {
    width: 86,
    height: 86,
  },
  spotlightYukiGlowLarge: {
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  spotlightYukiLargeImg: {
    width: 112,
    height: 112,
  },
});
