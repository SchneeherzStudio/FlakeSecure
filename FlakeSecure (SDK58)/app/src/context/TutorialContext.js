/**
 * ============================================================================
 * FlakeSecure - Coach-Mark Tutorial Context & Controller
 * ============================================================================
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { TOURS, TOUR_STORAGE_KEYS } from '../tutorial/tours';
import { YUKI } from '../components/yuki/yukiPoses';
import SpotlightOverlay from '../components/tutorial/SpotlightOverlay';

const TutorialContext = createContext(null);

const DONE_KEY_MAP = {
  home: TOUR_STORAGE_KEYS.homeDone,
  authenticator: TOUR_STORAGE_KEYS.authenticatorDone,
  credentials: TOUR_STORAGE_KEYS.credentialsDone,
};

function measureViewInWindow(ref) {
  return new Promise((resolve) => {
    const node = ref?.current;
    if (!node || typeof node.measureInWindow !== 'function') {
      resolve(null);
      return;
    }
    try {
      node.measureInWindow((x, y, width, height) => {
        if (
          typeof x === 'number' &&
          typeof y === 'number' &&
          typeof width === 'number' &&
          typeof height === 'number' &&
          width > 0 &&
          height > 0
        ) {
          resolve({ x, y, width, height });
        } else {
          resolve(null);
        }
      });
    } catch {
      resolve(null);
    }
  });
}

export function TutorialProvider({ children }) {
  const targetsRef = useRef({});
  const helpersRef = useRef({});

  const [activeTourId, setActiveTourId] = useState(null);
  const [resolvedSteps, setResolvedSteps] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Prefetch Yuki pose assets lightly once
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled) => setReduceMotion(!!enabled))
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      (enabled) => setReduceMotion(!!enabled)
    );

    try {
      if (typeof Image.prefetch === 'function') {
        Object.values(YUKI).forEach((asset) => {
          if (typeof asset === 'string') Image.prefetch(asset);
        });
      }
    } catch {}

    return () => {
      sub?.remove?.();
    };
  }, []);

  const registerTarget = useCallback((id, ref) => {
    if (!id) return;
    targetsRef.current[id] = ref;
  }, []);

  const unregisterTarget = useCallback((id, ref) => {
    if (!id) return;
    if (targetsRef.current[id] === ref) {
      delete targetsRef.current[id];
    }
  }, []);

  const registerHelpers = useCallback((tourHelpers) => {
    helpersRef.current = { ...helpersRef.current, ...(tourHelpers || {}) };
  }, []);

  const resolveStepTargetRect = useCallback(async (step) => {
    if (!step) return null;
    if (typeof step.prepare === 'function') {
      try {
        step.prepare(helpersRef.current);
      } catch {}
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r))
      );
    }

    if (!step.target) {
      return null;
    }

    const candidates = Array.isArray(step.target) ? step.target : [step.target];

    for (const candidateId of candidates) {
      const ref = targetsRef.current[candidateId];
      if (!ref) continue;
      const rect = await measureViewInWindow(ref);
      if (rect) {
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
      }
    }
    return undefined; // signals target not currently mounted
  }, []);

  const showStepAt = useCallback(
    async (tourId, stepsList, idx, direction = 1) => {
      let cursor = idx;
      while (cursor >= 0 && cursor < stepsList.length) {
        const candidate = stepsList[cursor];
        const rect = await resolveStepTargetRect(candidate);
        if (candidate.target && rect === undefined) {
          cursor += direction;
          continue;
        }
        setStepIndex(cursor);
        setTargetRect(rect || null);
        try {
          Haptics.selectionAsync();
        } catch {}
        return;
      }
      // Ran out of valid steps -> finish cleanly
      const doneKey = DONE_KEY_MAP[tourId];
      if (doneKey) {
        AsyncStorage.setItem(doneKey, 'true').catch(() => {});
      }
      if (tourId === 'home') {
        AsyncStorage.removeItem(TOUR_STORAGE_KEYS.homePending).catch(() => {});
      }
      setActiveTourId(null);
      setResolvedSteps([]);
      setTargetRect(null);
      setStepIndex(0);
    },
    [resolveStepTargetRect]
  );

  const startTour = useCallback(
    async (tourId, { force = false } = {}) => {
      const stepsDef = TOURS[tourId];
      if (!stepsDef || stepsDef.length === 0) return false;

      if (!force) {
        const doneKey = DONE_KEY_MAP[tourId];
        if (doneKey) {
          const alreadyDone = await AsyncStorage.getItem(doneKey);
          if (alreadyDone === 'true') {
            if (tourId === 'home') {
              await AsyncStorage.removeItem(TOUR_STORAGE_KEYS.homePending);
            }
            return false;
          }
        }
      }

      // Build contiguous list filtering out optional steps whose targets aren't currently present
      const validSteps = [];
      for (const s of stepsDef) {
        if (!s.target || !s.optional) {
          validSteps.push(s);
          continue;
        }
        const candidates = Array.isArray(s.target) ? s.target : [s.target];
        let anyMounted = false;
        for (const cid of candidates) {
          const rect = await measureViewInWindow(targetsRef.current[cid]);
          if (rect) {
            anyMounted = true;
            break;
          }
        }
        if (anyMounted) {
          validSteps.push(s);
        }
      }

      if (validSteps.length === 0) return false;

      setResolvedSteps(validSteps);
      setActiveTourId(tourId);
      await showStepAt(tourId, validSteps, 0, 1);
      return true;
    },
    [showStepAt]
  );

  const finishTour = useCallback(async () => {
    const tourId = activeTourId;
    setActiveTourId(null);
    setResolvedSteps([]);
    setTargetRect(null);
    setStepIndex(0);

    if (tourId) {
      const doneKey = DONE_KEY_MAP[tourId];
      if (doneKey) {
        await AsyncStorage.setItem(doneKey, 'true').catch(() => {});
      }
      if (tourId === 'home') {
        await AsyncStorage.removeItem(TOUR_STORAGE_KEYS.homePending).catch(() => {});
      }
    }
  }, [activeTourId]);

  const dismissActiveTour = useCallback(() => {
    setActiveTourId(null);
    setResolvedSteps([]);
    setTargetRect(null);
    setStepIndex(0);
  }, []);

  const next = useCallback(() => {
    if (!activeTourId || resolvedSteps.length === 0) return;
    if (stepIndex >= resolvedSteps.length - 1) {
      finishTour();
    } else {
      showStepAt(activeTourId, resolvedSteps, stepIndex + 1, 1);
    }
  }, [activeTourId, resolvedSteps, stepIndex, finishTour, showStepAt]);

  const back = useCallback(() => {
    if (!activeTourId || resolvedSteps.length === 0 || stepIndex <= 0) return;
    showStepAt(activeTourId, resolvedSteps, stepIndex - 1, -1);
  }, [activeTourId, resolvedSteps, stepIndex, showStepAt]);

  const skip = useCallback(() => {
    finishTour();
  }, [finishTour]);

  const resetAllTours = useCallback(async () => {
    await AsyncStorage.multiRemove([
      TOUR_STORAGE_KEYS.homeDone,
      TOUR_STORAGE_KEYS.authenticatorDone,
      TOUR_STORAGE_KEYS.credentialsDone,
    ]).catch(() => {});
    await AsyncStorage.setItem(TOUR_STORAGE_KEYS.homePending, 'true').catch(
      () => {}
    );
  }, []);

  // Re-measure active target if screen dimensions change
  useEffect(() => {
    if (!activeTourId) return;
    const sub = Dimensions.addEventListener?.('change', () => {
      const current = resolvedSteps[stepIndex];
      if (current) {
        resolveStepTargetRect(current).then((rect) => {
          if (rect !== undefined) setTargetRect(rect);
        });
      }
    });
    return () => sub?.remove?.();
  }, [activeTourId, resolvedSteps, stepIndex, resolveStepTargetRect]);

  const currentStep =
    activeTourId && resolvedSteps[stepIndex] ? resolvedSteps[stepIndex] : null;

  return (
    <TutorialContext.Provider
      value={{
        activeTourId,
        isTourActive: !!activeTourId,
        registerTarget,
        unregisterTarget,
        registerHelpers,
        startTour,
        next,
        back,
        skip,
        dismissActiveTour,
        resetAllTours,
      }}
    >
      {children}
      <SpotlightOverlay
        visible={!!activeTourId && !!currentStep}
        step={currentStep}
        stepIndex={stepIndex}
        totalSteps={resolvedSteps.length}
        targetRect={targetRect}
        reduceMotion={reduceMotion}
        onNext={next}
        onBack={back}
        onSkip={skip}
      />
    </TutorialContext.Provider>
  );
}

export const useTutorial = () => {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    return {
      activeTourId: null,
      isTourActive: false,
      registerTarget: () => {},
      unregisterTarget: () => {},
      registerHelpers: () => {},
      startTour: async () => false,
      next: () => {},
      back: () => {},
      skip: () => {},
      dismissActiveTour: () => {},
      resetAllTours: async () => {},
    };
  }
  return ctx;
};
