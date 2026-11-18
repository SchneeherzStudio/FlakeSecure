/**
 * ============================================================================
 * FlakeSecure Mobile App - Server Favicon Image Component (FaviconImage) v3.0
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. PRIVACY-PRESERVING BACKEND PROXY + DISK CACHE (Variant C):
 *    - Requests favicons exclusively from `${serverUrl}/api/favicon/${cleanDomain}?sz=128`.
 *    - No direct client requests to third-party CDNs (Google / icon.horse).
 *    - Uses `expo-image` with `cachePolicy="disk"` and `recyclingKey={cleanDomain}` for instant rendering.
 * 
 * 2. PERSISTENT MISS CACHE:
 *    - Records 404/error misses in AsyncStorage (`favicon_miss_<domain>`) with a 7-day TTL
 *      so known misses immediately render the initial badge without network round-trips.
 *    - Exports `clearFaviconCache()` to purge disk/memory image caches and reset miss entries.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getServerUrl, DEFAULT_SERVER } from '../utils/api';
import { useTheme } from '../context/ThemeContext';

const MISS_KEY_PREFIX = 'favicon_miss_';
const MISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// In-memory cache of resolved serverUrl and domain miss status
let cachedServerUrl = DEFAULT_SERVER;
let serverUrlLoaded = false;
const memoryMissMap = new Map(); // domain -> timestamp (or false if known not-miss)
const cacheListeners = new Set();

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

async function ensureServerUrl() {
  if (serverUrlLoaded) return cachedServerUrl;
  try {
    cachedServerUrl = await getServerUrl();
    serverUrlLoaded = true;
  } catch {}
  return cachedServerUrl;
}

async function isDomainMarkedMiss(cleanDomain) {
  if (!cleanDomain) return true;
  if (memoryMissMap.has(cleanDomain)) {
    const ts = memoryMissMap.get(cleanDomain);
    if (!ts) return false;
    if (Date.now() - ts < MISS_TTL_MS) return true;
    memoryMissMap.delete(cleanDomain);
  }
  try {
    const raw = await AsyncStorage.getItem(`${MISS_KEY_PREFIX}${cleanDomain}`);
    if (!raw) {
      memoryMissMap.set(cleanDomain, 0);
      return false;
    }
    const ts = Number(raw) || 0;
    if (Date.now() - ts < MISS_TTL_MS) {
      memoryMissMap.set(cleanDomain, ts);
      return true;
    }
    await AsyncStorage.removeItem(`${MISS_KEY_PREFIX}${cleanDomain}`);
    memoryMissMap.set(cleanDomain, 0);
    return false;
  } catch {
    return false;
  }
}

async function markDomainMiss(cleanDomain) {
  if (!cleanDomain) return;
  const now = Date.now();
  memoryMissMap.set(cleanDomain, now);
  try {
    await AsyncStorage.setItem(`${MISS_KEY_PREFIX}${cleanDomain}`, String(now));
  } catch {}
}

export async function clearFaviconCache() {
  memoryMissMap.clear();
  try {
    await Image.clearDiskCache();
  } catch {}
  try {
    await Image.clearMemoryCache();
  } catch {}
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const missKeys = allKeys.filter((k) => k.startsWith(MISS_KEY_PREFIX));
    if (missKeys.length > 0) {
      await AsyncStorage.multiRemove(missKeys);
    }
  } catch {}
  cacheListeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

export default function FaviconImage({
  domain = '',
  size = 36,
  style,
  fallbackIcon = null,
  fallbackBg,
  fallbackTextColor,
  borderRadius = 8,
}) {
  const { colors } = useTheme();
  const cleanDomain = extractHost(domain);
  const rootDomain = extractRootDomain(cleanDomain);

  const resolvedFallbackBg = fallbackBg || colors.goldBg || 'rgba(232, 176, 32, 0.15)';
  const resolvedFallbackText = fallbackTextColor || colors.gold || '#E8B020';

  const [serverBase, setServerBase] = useState(cachedServerUrl);
  const [failed, setFailed] = useState(() => {
    if (!cleanDomain) return true;
    const mem = memoryMissMap.get(cleanDomain);
    return !!(mem && Date.now() - mem < MISS_TTL_MS);
  });
  const [cacheVersion, setCacheVersion] = useState(0);

  useEffect(() => {
    let active = true;
    ensureServerUrl().then((url) => {
      if (active && url !== serverBase) setServerBase(url);
    });
    isDomainMarkedMiss(cleanDomain).then((miss) => {
      if (active) setFailed(miss);
    });

    const onClear = () => {
      if (active) {
        setFailed(false);
        setCacheVersion((v) => v + 1);
      }
    };
    cacheListeners.add(onClear);
    return () => {
      active = false;
      cacheListeners.delete(onClear);
    };
  }, [cleanDomain, serverBase]);

  const initial = (rootDomain || cleanDomain)
    ? (rootDomain || cleanDomain).charAt(0).toUpperCase()
    : '?';

  const iconSize = size >= 40 ? 128 : 64;
  const uri =
    cleanDomain && !failed
      ? `${serverBase}/api/favicon/${encodeURIComponent(cleanDomain)}?sz=${iconSize}`
      : null;

  if (!cleanDomain || !uri || failed) {
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius,
            backgroundColor: resolvedFallbackBg,
            borderColor: colors.border || 'rgba(255, 255, 255, 0.08)',
          },
          style,
        ]}
      >
        {fallbackIcon ? (
          <Text style={{ fontSize: size * 0.48, color: resolvedFallbackText }}>{fallbackIcon}</Text>
        ) : (
          <Text
            style={[
              styles.initialText,
              { fontSize: Math.max(12, size * 0.45), color: resolvedFallbackText },
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
          borderRadius,
          backgroundColor: colors.inputBg || 'rgba(255, 255, 255, 0.08)',
          borderColor: colors.border || 'rgba(255, 255, 255, 0.08)',
        },
        style,
      ]}
    >
      <Image
        key={`${cleanDomain}-${cacheVersion}`}
        recyclingKey={cleanDomain}
        source={{ uri }}
        cachePolicy="disk"
        contentFit="contain"
        transition={120}
        style={{
          width: size * 0.68,
          height: size * 0.68,
          borderRadius: Math.max(4, borderRadius - 4),
        }}
        onError={() => {
          setFailed(true);
          markDomainMiss(cleanDomain);
        }}
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
  },
  initialText: {
    fontWeight: '800',
    textAlign: 'center',
  },
});
