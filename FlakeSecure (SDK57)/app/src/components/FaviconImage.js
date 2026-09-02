/**
 * ============================================================================
 * FlakeSecure Mobile App - Server Favicon Image Component (FaviconImage) v2.1
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & MULTI-TIER FALLBACK:
 * 
 * 1. DOMAIN & SUBDOMAIN PARSING:
 *    - Extracts clean hostname from raw URL or domain strings.
 *    - Detects if domain is a subdomain (e.g. login.ionos.de -> root: ionos.de).
 * 
 * 2. MULTI-STAGE FAVICON RESOLUTION:
 *    - Stage 0: Subdomain on Google CDN (https://www.google.com/s2/favicons?domain=login.ionos.de&sz=128)
 *    - Stage 1: Root domain on Google CDN if subdomain fails (https://www.google.com/s2/favicons?domain=ionos.de&sz=128)
 *    - Stage 2: Secondary CDN fallback (icon.horse) for root domain
 *    - Stage 3: Graceful styled local fallback badge with initial or category icon.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

function extractHost(domain) {
  return (domain || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .split(':')[0]
    .toLowerCase();
}

function extractRootDomain(host) {
  if (!host) return '';
  const parts = host.split('.');
  if (parts.length <= 2) return host;

  const specialTlds = ['co.uk', 'com.de', 'org.uk', 'gov.uk', 'ac.uk', 'co.jp', 'com.au', 'com.br', 'co.nz'];
  const lastTwo = parts.slice(-2).join('.');
  if (specialTlds.includes(lastTwo) && parts.length > 3) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

export default function FaviconImage({
  domain = '',
  size = 36,
  style,
  fallbackIcon = null,
  fallbackBg = 'rgba(99, 145, 255, 0.15)',
  fallbackTextColor = '#6391ff',
  borderRadius = 10,
}) {
  const cleanDomain = extractHost(domain);
  const rootDomain = extractRootDomain(cleanDomain);
  const hasSubdomain = cleanDomain && rootDomain && cleanDomain !== rootDomain;

  // Stages: 0 = exact domain Google, 1 = root domain Google (if subdomain), 2 = IconHorse, 3 = failed
  const [stage, setStage] = useState(0);

  useEffect(() => {
    setStage(0);
  }, [domain]);

  const getSourceUri = () => {
    const iconSize = size >= 40 ? 128 : 64;
    if (stage === 0) {
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanDomain)}&sz=${iconSize}`;
    }
    if (stage === 1 && hasSubdomain) {
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(rootDomain)}&sz=${iconSize}`;
    }
    if (stage === 2) {
      return `https://icon.horse/icon/${encodeURIComponent(rootDomain || cleanDomain)}`;
    }
    return null;
  };

  const handleImageError = () => {
    if (stage === 0) {
      if (hasSubdomain) {
        setStage(1); // Try root domain
      } else {
        setStage(2); // Try secondary provider
      }
    } else if (stage === 1) {
      setStage(2); // Try secondary provider
    } else {
      setStage(3); // All stages failed -> render fallback
    }
  };

  const initial = (rootDomain || cleanDomain) ? (rootDomain || cleanDomain).charAt(0).toUpperCase() : '?';
  const uri = cleanDomain && stage < 3 ? getSourceUri() : null;

  if (!cleanDomain || !uri || stage >= 3) {
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: borderRadius,
            backgroundColor: fallbackBg,
          },
          style,
        ]}
      >
        {fallbackIcon ? (
          <Text style={{ fontSize: size * 0.48 }}>{fallbackIcon}</Text>
        ) : (
          <Text
            style={[
              styles.initialText,
              { fontSize: Math.max(12, size * 0.45), color: fallbackTextColor },
            ]}
          >
            {initial}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: borderRadius,
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
        },
        style,
      ]}
    >
      <Image
        key={`${cleanDomain}-${stage}`}
        source={{ uri }}
        style={{
          width: size * 0.68,
          height: size * 0.68,
          borderRadius: Math.max(4, borderRadius - 4),
        }}
        resizeMode="contain"
        onError={handleImageError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  initialText: {
    fontWeight: '800',
    textAlign: 'center',
  },
});
