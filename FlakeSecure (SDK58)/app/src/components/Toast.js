import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Pressable,
  Modal,
  PanResponder,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { AppIcon } from './CategoryIcons';

let Haptics = null;
try {
  Haptics = require('expo-haptics');
} catch {
  Haptics = null;
}

const SEVERITY_CONFIG = {
  error: {
    accent: '#ef4444',
    bgTintDark: 'rgba(239, 68, 68, 0.14)',
    bgTintLight: 'rgba(239, 68, 68, 0.10)',
    borderTint: 'rgba(239, 68, 68, 0.42)',
    icon: 'x-circle',
    defaultDuration: 6000,
    haptic: () => {
      try {
        Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Error);
      } catch {}
    },
  },
  warn: {
    accent: '#f59e0b',
    bgTintDark: 'rgba(245, 158, 11, 0.14)',
    bgTintLight: 'rgba(245, 158, 11, 0.10)',
    borderTint: 'rgba(245, 158, 11, 0.42)',
    icon: 'alert',
    defaultDuration: 4500,
    haptic: () => {
      try {
        Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Warning);
      } catch {}
    },
  },
  warning: {
    accent: '#f59e0b',
    bgTintDark: 'rgba(245, 158, 11, 0.14)',
    bgTintLight: 'rgba(245, 158, 11, 0.10)',
    borderTint: 'rgba(245, 158, 11, 0.42)',
    icon: 'alert',
    defaultDuration: 4500,
    haptic: () => {
      try {
        Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Warning);
      } catch {}
    },
  },
  success: {
    accent: '#10b981',
    bgTintDark: 'rgba(16, 185, 129, 0.14)',
    bgTintLight: 'rgba(16, 185, 129, 0.10)',
    borderTint: 'rgba(16, 185, 129, 0.42)',
    icon: 'check-circle',
    defaultDuration: 3200,
    haptic: () => {
      try {
        Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
      } catch {}
    },
  },
  info: {
    accent: '#3b82f6',
    bgTintDark: 'rgba(59, 130, 246, 0.14)',
    bgTintLight: 'rgba(59, 130, 246, 0.10)',
    borderTint: 'rgba(59, 130, 246, 0.42)',
    icon: 'info',
    defaultDuration: 3500,
    haptic: () => {
      try {
        Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    },
  },
};

const ToastContext = createContext(null);

let imperativeHandler = null;

function normalizeToastArgs(type, titleOrOptions, messageArg, optionsArg) {
  if (typeof titleOrOptions === 'object' && titleOrOptions !== null) {
    return {
      type: titleOrOptions.type || type || 'info',
      title: titleOrOptions.title || '',
      message: titleOrOptions.message || '',
      duration: titleOrOptions.duration,
      action: titleOrOptions.action || null,
    };
  }
  if (messageArg === undefined || messageArg === null) {
    return {
      type: type || 'info',
      title: '',
      message: String(titleOrOptions || ''),
      duration: optionsArg?.duration,
      action: optionsArg?.action || null,
    };
  }
  if (typeof messageArg === 'object' && messageArg !== null) {
    return {
      type: type || 'info',
      title: String(titleOrOptions || ''),
      message: String(messageArg.message || ''),
      duration: messageArg.duration,
      action: messageArg.action || null,
    };
  }
  return {
    type: type || 'info',
    title: String(titleOrOptions || ''),
    message: String(messageArg || ''),
    duration: optionsArg?.duration,
    action: optionsArg?.action || null,
  };
}

export const toast = {
  show: (optionsOrTitle, message, opts) => {
    const payload = normalizeToastArgs(
      typeof optionsOrTitle === 'object' ? optionsOrTitle?.type || 'info' : 'info',
      optionsOrTitle,
      message,
      opts
    );
    return imperativeHandler?.show?.(payload);
  },
  error: (titleOrMessage, message, opts) => {
    const payload = normalizeToastArgs('error', titleOrMessage, message, opts);
    return imperativeHandler?.show?.(payload);
  },
  warn: (titleOrMessage, message, opts) => {
    const payload = normalizeToastArgs('warn', titleOrMessage, message, opts);
    return imperativeHandler?.show?.(payload);
  },
  warning: (titleOrMessage, message, opts) => {
    const payload = normalizeToastArgs('warn', titleOrMessage, message, opts);
    return imperativeHandler?.show?.(payload);
  },
  success: (titleOrMessage, message, opts) => {
    const payload = normalizeToastArgs('success', titleOrMessage, message, opts);
    return imperativeHandler?.show?.(payload);
  },
  info: (titleOrMessage, message, opts) => {
    const payload = normalizeToastArgs('info', titleOrMessage, message, opts);
    return imperativeHandler?.show?.(payload);
  },
  confirm: (options) => {
    if (imperativeHandler?.confirm) {
      return imperativeHandler.confirm(options);
    }
    return Promise.resolve(false);
  },
};

function ToastItem({ item, onDismiss, colors, isDark, index }) {
  const cfg = SEVERITY_CONFIG[item.type] || SEVERITY_CONFIG.info;
  const translateY = useRef(new Animated.Value(-90)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(1)).current;

  const duration = item.duration || cfg.defaultDuration;
  const remainingRef = useRef(duration);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef(null);
  const progressAnimRef = useRef(null);
  const dismissedRef = useRef(false);

  const triggerDismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressAnimRef.current) progressAnimRef.current.stop();
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -90,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(item.id);
    });
  }, [item.id, onDismiss, opacity, translateY]);

  const startCountdown = useCallback(
    (ms) => {
      if (dismissedRef.current) return;
      startTimeRef.current = Date.now();
      remainingRef.current = ms;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        triggerDismiss();
      }, ms);

      progressAnimRef.current = Animated.timing(progress, {
        toValue: 0,
        duration: ms,
        useNativeDriver: false,
      });
      progressAnimRef.current.start();
    },
    [progress, triggerDismiss]
  );

  const pauseCountdown = useCallback(() => {
    if (dismissedRef.current) return;
    const elapsed = Date.now() - startTimeRef.current;
    remainingRef.current = Math.max(400, remainingRef.current - elapsed);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressAnimRef.current) progressAnimRef.current.stop();
  }, []);

  const resumeCountdown = useCallback(() => {
    if (dismissedRef.current) return;
    startCountdown(remainingRef.current);
  }, [startCountdown]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 75,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    startCountdown(duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressAnimRef.current) progressAnimRef.current.stop();
    };
  }, [duration, opacity, startCountdown, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8 && gesture.dy < -4,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy < 0) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -22 || gesture.vy < -0.5) {
          triggerDismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const widthInterpolated = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.toastCard,
        {
          backgroundColor: isDark ? '#131726' : '#ffffff',
          borderColor: cfg.borderTint,
          marginTop: index === 0 ? 0 : 8,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Pressable
        onPressIn={pauseCountdown}
        onPressOut={resumeCountdown}
        style={[
          styles.toastInner,
          {
            backgroundColor: isDark ? cfg.bgTintDark : cfg.bgTintLight,
          },
        ]}
      >
        <View style={[styles.accentStripe, { backgroundColor: cfg.accent }]} />
        <View style={[styles.iconBadge, { backgroundColor: cfg.accent + '22' }]}>
          <AppIcon name={cfg.icon} size={18} color={cfg.accent} />
        </View>
        <View style={styles.textWrap}>
          {!!item.title && (
            <Text style={[styles.toastTitle, { color: colors.text }]} numberOfLines={2}>
              {item.title}
            </Text>
          )}
          {!!item.message && (
            <Text
              style={[
                styles.toastMessage,
                { color: item.title ? colors.textSecondary : colors.text },
              ]}
              numberOfLines={4}
            >
              {item.message}
            </Text>
          )}
          {item.action?.label && (
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: cfg.accent + '66' }]}
              onPress={() => {
                try {
                  item.action.onPress?.();
                } finally {
                  triggerDismiss();
                }
              }}
            >
              <Text style={[styles.actionBtnText, { color: cfg.accent }]}>
                {item.action.label}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          onPress={triggerDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.closeBtn}
        >
          <AppIcon name="close" size={15} color={colors.textMuted} />
        </TouchableOpacity>
      </Pressable>
      <View style={[styles.progressTrack, { backgroundColor: cfg.accent + '20' }]}>
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: widthInterpolated,
              backgroundColor: cfg.accent,
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

export function ToastProvider({ children }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const recentMapRef = useRef(new Map());

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (rawOptions) => {
      const payload =
        typeof rawOptions === 'string'
          ? { type: 'info', title: '', message: rawOptions }
          : {
              type: rawOptions?.type || 'info',
              title: rawOptions?.title || '',
              message: rawOptions?.message || '',
              duration: rawOptions?.duration,
              action: rawOptions?.action || null,
            };

      const dedupeKey = `${payload.type}:${payload.title}:${payload.message}`;
      const now = Date.now();
      const lastShown = recentMapRef.current.get(dedupeKey);
      if (lastShown && now - lastShown < 1500) {
        return;
      }
      recentMapRef.current.set(dedupeKey, now);

      const cfg = SEVERITY_CONFIG[payload.type] || SEVERITY_CONFIG.info;
      cfg.haptic?.();

      const announceText = [payload.title, payload.message].filter(Boolean).join(': ');
      if (announceText) {
        try {
          AccessibilityInfo.announceForAccessibility(announceText);
        } catch {}
      }

      const newToast = {
        id: `${now}_${Math.random().toString(36).slice(2, 7)}`,
        ...payload,
      };

      setToasts((prev) => [newToast, ...prev].slice(0, 3));
    },
    []
  );

  const confirm = useCallback((options = {}) => {
    try {
      if (options.danger) {
        Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {}

    return new Promise((resolve) => {
      setConfirmState({
        title: options.title || '',
        message: options.message || '',
        confirmText: options.confirmText || t('common.ok') || 'OK',
        cancelText: options.cancelText || t('common.cancel') || 'Cancel',
        danger: !!options.danger,
        icon: options.icon || (options.danger ? 'trash' : 'alert'),
        onConfirm: options.onConfirm,
        onCancel: options.onCancel,
        resolve,
      });
    });
  }, [t]);

  const handleConfirmDecision = useCallback(
    async (accepted) => {
      const current = confirmState;
      setConfirmState(null);
      if (!current) return;
      try {
        if (accepted) {
          await current.onConfirm?.();
        } else {
          await current.onCancel?.();
        }
      } catch (err) {
        console.warn('Toast confirm callback error:', err);
      } finally {
        current.resolve?.(accepted);
      }
    },
    [confirmState]
  );

  const contextValue = React.useMemo(
    () => ({
      show,
      error: (titleOrMsg, msg, opts) =>
        show(normalizeToastArgs('error', titleOrMsg, msg, opts)),
      warn: (titleOrMsg, msg, opts) =>
        show(normalizeToastArgs('warn', titleOrMsg, msg, opts)),
      warning: (titleOrMsg, msg, opts) =>
        show(normalizeToastArgs('warn', titleOrMsg, msg, opts)),
      success: (titleOrMsg, msg, opts) =>
        show(normalizeToastArgs('success', titleOrMsg, msg, opts)),
      info: (titleOrMsg, msg, opts) =>
        show(normalizeToastArgs('info', titleOrMsg, msg, opts)),
      confirm,
    }),
    [show, confirm]
  );

  useEffect(() => {
    imperativeHandler = contextValue;
    return () => {
      if (imperativeHandler === contextValue) {
        imperativeHandler = null;
      }
    };
  }, [contextValue]);

  const topOffset = Math.max(insets.top + 8, Platform.OS === 'ios' ? 48 : 28);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {toasts.length > 0 && (
        <View
          pointerEvents="box-none"
          style={[styles.viewport, { top: topOffset }]}
        >
          {toasts.map((item, idx) => (
            <ToastItem
              key={item.id}
              item={item}
              index={idx}
              onDismiss={dismissToast}
              colors={colors}
              isDark={isDark}
            />
          ))}
        </View>
      )}

      <Modal
        visible={!!confirmState}
        transparent
        animationType="fade"
        onRequestClose={() => handleConfirmDecision(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => handleConfirmDecision(false)}
        >
          <Pressable
            style={[
              styles.confirmSheet,
              {
                backgroundColor: isDark ? '#121626' : '#ffffff',
                borderColor: confirmState?.danger
                  ? 'rgba(239, 68, 68, 0.35)'
                  : colors.border,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={[
                styles.confirmIconCircle,
                {
                  backgroundColor: confirmState?.danger
                    ? 'rgba(239, 68, 68, 0.14)'
                    : colors.accentBg || 'rgba(232, 176, 32, 0.14)',
                },
              ]}
            >
              <AppIcon
                name={confirmState?.icon || (confirmState?.danger ? 'trash' : 'alert')}
                size={24}
                color={confirmState?.danger ? '#ef4444' : colors.accent}
              />
            </View>

            {!!confirmState?.title && (
              <Text style={[styles.confirmTitle, { color: colors.text }]}>
                {confirmState.title}
              </Text>
            )}
            {!!confirmState?.message && (
              <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
                {confirmState.message}
              </Text>
            )}

            <View style={styles.confirmBtnRow}>
              <TouchableOpacity
                style={[
                  styles.confirmCancelBtn,
                  {
                    backgroundColor: colors.surfaceLight,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => handleConfirmDecision(false)}
              >
                <Text style={[styles.confirmCancelText, { color: colors.textSecondary }]}>
                  {confirmState?.cancelText}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmActionBtn,
                  {
                    backgroundColor: confirmState?.danger ? '#ef4444' : colors.accent,
                  },
                ]}
                onPress={() => handleConfirmDecision(true)}
              >
                <Text
                  style={[
                    styles.confirmActionText,
                    { color: confirmState?.danger ? '#ffffff' : '#090b14' },
                  ]}
                >
                  {confirmState?.confirmText}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return toast;
  }
  return ctx;
}

const styles = StyleSheet.create({
  viewport: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 99999,
    elevation: 99999,
  },
  toastCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 12,
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  accentStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginLeft: 2,
  },
  textWrap: {
    flex: 1,
    paddingRight: 8,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  toastMessage: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  actionBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
    alignSelf: 'flex-start',
  },
  progressTrack: {
    height: 3,
    width: '100%',
  },
  progressBar: {
    height: 3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 15, 0.72)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 28,
  },
  confirmSheet: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 20,
  },
  confirmIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 22,
  },
  confirmBtnRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  confirmActionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmActionText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
