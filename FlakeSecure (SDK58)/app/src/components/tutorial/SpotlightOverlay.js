/**
 * ============================================================================
 * FlakeSecure - Spotlight Coach-Mark Overlay (Modal + SVG Circular Cutout + Yuki)
 * ============================================================================
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import YukiGuide from '../yuki/YukiGuide';

function computeTargetCircle(rect, screenW, screenH) {
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return {
      cx: screenW / 2,
      cy: screenH / 2,
      r: 0,
    };
  }
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  // Compact targets get a tight circular spotlight; wide horizontal bars get a centered circular cutout.
  let r;
  if (rect.width <= 170) {
    r = Math.max(rect.width, rect.height) / 2 + 12;
  } else {
    r = Math.min(Math.max(rect.height / 2 + 30, 56), 92);
  }
  r = Math.min(r, screenW * 0.34);
  return { cx, cy, r };
}

function buildCutoutPath(width, height, cx, cy, r) {
  const w = Math.round(width);
  const h = Math.round(height);
  const outer = `M0,0 H${w} V${h} H0 Z`;
  if (!r || r <= 1) return outer;
  const x = Math.round(cx);
  const y = Math.round(cy);
  const rad = Math.round(r);
  const hole = `M${x - rad},${y} A${rad},${rad} 0 1,0 ${x + rad},${y} A${rad},${rad} 0 1,0 ${x - rad},${y} Z`;
  return `${outer} ${hole}`;
}

export default function SpotlightOverlay({
  visible,
  step,
  stepIndex,
  totalSteps,
  targetRect,
  reduceMotion,
  onNext,
  onBack,
  onSkip,
}) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [viewport, setViewport] = useState(() => Dimensions.get('window'));
  const screenW = viewport.width;
  const screenH = viewport.height;

  const desiredCircle = useMemo(
    () => computeTargetCircle(targetRect, screenW, screenH),
    [targetRect, screenW, screenH]
  );

  const [animCircle, setAnimCircle] = useState(desiredCircle);
  const currentCircleRef = useRef(desiredCircle);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (reduceMotion) {
      currentCircleRef.current = desiredCircle;
      setAnimCircle(desiredCircle);
      return;
    }

    const from =
      currentCircleRef.current.r === 0 && desiredCircle.r > 0
        ? {
            cx: desiredCircle.cx,
            cy: desiredCircle.cy,
            r: Math.max(10, desiredCircle.r * 0.45),
          }
        : currentCircleRef.current;
    const to = desiredCircle;
    const duration = 260;
    const startTs = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTs;
      const raw = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - raw, 3);
      const next = {
        cx: from.cx + (to.cx - from.cx) * eased,
        cy: from.cy + (to.cy - from.cy) * eased,
        r: from.r + (to.r - from.r) * eased,
      };
      currentCircleRef.current = next;
      setAnimCircle(next);
      if (raw < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [desiredCircle, visible, reduceMotion]);

  if (!visible || !step) {
    return null;
  }

  const { cx, cy, r } = animCircle;
  const hasSpotlight = r > 2;
  const isTargetInTopHalf = cy < screenH * 0.48;
  const bubblePlacement = !hasSpotlight
    ? 'center'
    : isTargetInTopHalf
      ? 'below'
      : 'above';

  // Place Yuki dynamically opposite/adjacent to the spotlight horizontally so Yuki never covers the target
  const yukiSide = cx < screenW * 0.5 ? 'right' : 'left';

  let bubbleStyle = {};
  if (bubblePlacement === 'center') {
    bubbleStyle = {
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      paddingTop: insets.top + 16,
      paddingBottom: insets.bottom + 24,
    };
  } else if (bubblePlacement === 'below') {
    const topPos = Math.max(
      insets.top + 12,
      Math.min(screenH - 290 - insets.bottom, cy + r + 8)
    );
    bubbleStyle = {
      top: topPos,
    };
  } else {
    const bottomSpace = Math.max(
      insets.bottom + 12,
      Math.min(screenH - 280 - insets.top, screenH - (cy - r) + 8)
    );
    bubbleStyle = {
      bottom: bottomSpace,
    };
  }

  const handleBackdropPress = (evt) => {
    if (!hasSpotlight) return;
    const { locationX, locationY } = evt.nativeEvent;
    const dx = locationX - cx;
    const dy = locationY - cy;
    // Tapping inside the spotlighted circle advances smoothly to the next tip
    if (Math.sqrt(dx * dx + dy * dy) <= r + 14) {
      onNext?.();
    }
  };

  const handleRequestClose = () => {
    if (stepIndex > 0) {
      onBack?.();
    } else {
      onSkip?.();
    }
  };

  const title = step.titleKey ? t(step.titleKey) : undefined;
  const text = step.textKey ? t(step.textKey) : '';
  const stepLabel = t('tutorial.stepOf', {
    current: stepIndex + 1,
    total: totalSteps,
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleRequestClose}
    >
      <View
        style={styles.overlayRoot}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0) {
            setViewport((prev) =>
              prev.width === width && prev.height === height
                ? prev
                : { width, height }
            );
          }
        }}
      >
        <TouchableWithoutFeedback onPress={handleBackdropPress}>
          <View style={StyleSheet.absoluteFill}>
            <Svg width={screenW} height={screenH} style={StyleSheet.absoluteFill}>
              <Path
                d={buildCutoutPath(screenW, screenH, cx, cy, r)}
                fill="#060913"
                fillOpacity={colors.isDark ? 0.84 : 0.78}
                fillRule="evenodd"
              />
              {hasSpotlight && (
                <>
                  <Circle
                    cx={Math.round(cx)}
                    cy={Math.round(cy)}
                    r={Math.round(r)}
                    stroke={colors.gold}
                    strokeWidth={2.5}
                    fill="none"
                  />
                  <Circle
                    cx={Math.round(cx)}
                    cy={Math.round(cy)}
                    r={Math.round(r) + 7}
                    stroke={colors.goldBorder}
                    strokeWidth={1.2}
                    strokeDasharray="6 4"
                    fill="none"
                  />
                </>
              )}
            </Svg>
          </View>
        </TouchableWithoutFeedback>

        <View
          pointerEvents="box-none"
          style={[styles.guideContainer, bubbleStyle]}
        >
          <YukiGuide
            mode="spotlight"
            pose={step.pose || 'sit'}
            title={title}
            text={text}
            stepIndex={stepIndex}
            totalSteps={totalSteps}
            stepLabel={stepLabel}
            onNext={onNext}
            onBack={onBack}
            onSkip={onSkip}
            nextLabel={t('tutorial.next')}
            backLabel={t('tutorial.back')}
            skipLabel={t('tutorial.skip')}
            doneLabel={t('tutorial.done')}
            isLastStep={stepIndex >= totalSteps - 1}
            yukiSide={yukiSide}
            bubblePlacement={bubblePlacement}
            targetCenterX={cx}
            reduceMotion={reduceMotion}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  guideContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
