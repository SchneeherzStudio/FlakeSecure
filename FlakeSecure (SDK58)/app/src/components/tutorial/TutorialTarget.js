/**
 * ============================================================================
 * FlakeSecure - Tutorial Target Wrapper (measures window coordinates)
 * ============================================================================
 */

import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useTutorial } from '../../context/TutorialContext';

export default function TutorialTarget({ id, children, style }) {
  const viewRef = useRef(null);
  const { registerTarget, unregisterTarget } = useTutorial();

  useEffect(() => {
    if (!id) return;
    registerTarget(id, viewRef);
    return () => {
      unregisterTarget(id, viewRef);
    };
  }, [id, registerTarget, unregisterTarget]);

  return (
    <View ref={viewRef} collapsable={false} style={style}>
      {children}
    </View>
  );
}
