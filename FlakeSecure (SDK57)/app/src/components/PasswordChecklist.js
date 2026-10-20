/**
 * ============================================================================
 * FlakeSecure Mobile App - Live Password Policy Checklist & Strength Meter
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { AppIcon } from './CategoryIcons';
import {
  DEFAULT_PASSWORD_POLICY,
  loadPasswordPolicy,
  evaluatePasswordPolicy,
  checkPasswordPwned,
} from '../utils/passwordPolicy';

export function usePasswordValidation(password, username = '', email = '') {
  const [policy, setPolicy] = useState(DEFAULT_PASSWORD_POLICY);
  const [pwnedState, setPwnedState] = useState({
    checking: false,
    pwned: false,
    count: 0,
  });

  useEffect(() => {
    let mounted = true;
    loadPasswordPolicy().then((p) => {
      if (mounted && p) setPolicy(p);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const evaluation = evaluatePasswordPolicy(password, { username, email, policy });

  useEffect(() => {
    if (!password || !evaluation.isValid) {
      setPwnedState({ checking: false, pwned: false, count: 0 });
      return;
    }

    let cancelled = false;
    setPwnedState((prev) => ({ ...prev, checking: true }));

    const timer = setTimeout(async () => {
      const res = await checkPasswordPwned(password);
      if (!cancelled) {
        setPwnedState({
          checking: false,
          pwned: !!res.pwned,
          count: res.count || 0,
        });
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [password, evaluation.isValid]);

  const isPasswordReady = evaluation.isValid && !pwnedState.checking && !pwnedState.pwned;

  return {
    policy,
    evaluation,
    pwnedState,
    isPasswordReady,
  };
}

export default function PasswordChecklist({ password = '', evaluation, pwnedState }) {
  const { colors } = useTheme();
  const { t } = useLanguage();

  if (!evaluation) return null;

  const hasTyped = password.length > 0;
  const effectiveLevel = pwnedState?.pwned ? 1 : evaluation.strengthLevel;

  const getStrengthMeta = () => {
    if (!hasTyped) return { level: 0, label: '', color: colors.border };
    if (pwnedState?.pwned || effectiveLevel === 1) {
      return { level: 1, label: t('onboarding.account.weak'), color: colors.danger };
    }
    if (effectiveLevel === 2) {
      return { level: 2, label: t('onboarding.account.fair'), color: '#f59e0b' };
    }
    if (effectiveLevel === 3) {
      return { level: 3, label: t('onboarding.account.good'), color: colors.gold };
    }
    return { level: 4, label: t('onboarding.account.strong'), color: colors.success };
  };

  const strength = getStrengthMeta();

  const rules = [
    {
      key: 'minLength',
      passed: evaluation.hasMinLength,
      label: t('passwordPolicy.ruleMinLength', { min: evaluation.minLength }),
    },
    {
      key: 'complexity',
      passed: evaluation.hasComplexity,
      label: t('passwordPolicy.ruleComplexity', {
        classes: evaluation.minClasses,
        passphrase: evaluation.passphraseLength,
      }),
    },
    {
      key: 'noWhitespace',
      passed: evaluation.hasNoWhitespace,
      label: t('passwordPolicy.ruleNoWhitespace'),
    },
    {
      key: 'noPersonal',
      passed: evaluation.hasNoPersonal,
      label: t('passwordPolicy.ruleNoPersonal'),
    },
    {
      key: 'noSequence',
      passed: evaluation.hasNoSequence,
      label: t('passwordPolicy.ruleNoSequence'),
    },
  ];

  return (
    <View style={styles.container}>
      {hasTyped && (
        <View style={styles.strengthBar}>
          <View style={styles.strengthTrack}>
            {[1, 2, 3, 4].map((lvl) => (
              <View
                key={lvl}
                style={[
                  styles.strengthSegment,
                  { backgroundColor: lvl <= strength.level ? strength.color : colors.border },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
        </View>
      )}

      <View
        style={[
          styles.checklistBox,
          { backgroundColor: colors.inputBg, borderColor: colors.borderSubtle || colors.border },
        ]}
      >
        {rules.map((r) => {
          const iconColor = r.passed
            ? colors.success
            : hasTyped
            ? colors.danger
            : colors.textMuted;
          const textColor = r.passed
            ? colors.textMain || colors.text
            : hasTyped
            ? colors.textSecondary || colors.textSub
            : colors.textMuted;

          return (
            <View key={r.key} style={styles.ruleRow}>
              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor: r.passed
                      ? colors.successBg
                      : hasTyped
                      ? colors.dangerBg
                      : colors.cardBg,
                  },
                ]}
              >
                <AppIcon name={r.passed ? 'check' : 'close'} size={10} color={iconColor} />
              </View>
              <Text style={[styles.ruleText, { color: textColor }]}>{r.label}</Text>
            </View>
          );
        })}
      </View>

      {pwnedState?.checking && (
        <View style={styles.checkingRow}>
          <ActivityIndicator size="small" color={colors.gold} />
          <Text style={[styles.checkingText, { color: colors.textMuted }]}>
            {t('passwordPolicy.checkingBreaches')}
          </Text>
        </View>
      )}

      {pwnedState?.pwned && (
        <View
          style={[
            styles.pwnedBanner,
            { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
          ]}
        >
          <AppIcon name="alert" size={16} color={colors.danger} />
          <Text style={[styles.pwnedText, { color: colors.danger }]}>
            {t('passwordPolicy.pwnedWarning', { count: pwnedState.count })}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    gap: 8,
  },
  strengthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  strengthTrack: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: '700',
    minWidth: 55,
    textAlign: 'right',
  },
  checklistBox: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 5,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleText: {
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
  },
  checkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  checkingText: {
    fontSize: 11,
  },
  pwnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pwnedText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    flex: 1,
  },
});
