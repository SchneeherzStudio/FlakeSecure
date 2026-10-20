/**
 * ============================================================================
 * FlakeSecure Server - Privacy-Preserving Favicon Proxy (/api/favicon)
 * ============================================================================
 *
 * Fetches and caches website favicons server-side so client devices never
 * leak vault domains directly to third-party icon providers.
 *
 * - Endpoint: GET /api/favicon/:domain?sz=64|128
 * - SSRF Protection: Strict hostname validation, blocks private/loopback/internal
 *   hosts and verifies DNS resolution before direct origin fetches.
 * - Resolution Chain:
 *   1. Google S2 (exact host)
 *   2. Google S2 (root domain)
 *   3. icon.horse
 *   4. https://<domain>/favicon.ico
 * - Disk Cache: server/cache/favicons/<sha1(domain+sz)>.(png|ico) + .json
 *   - Hit TTL: 30 days (2,592,000s)
 *   - Miss TTL: 7 days
 * ============================================================================
 */

const express = require('express');
const crypto = require('crypto');
const dns = require('dns');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { faviconLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// Store favicon cache outside the server project tree by default so PM2 --watch / nodemon
// never restarts the server when caching domain icons or metadata JSON files.
const CACHE_DIR = process.env.FAVICON_CACHE_DIR || path.join(os.tmpdir(), 'flakesecure-runtime', 'favicons');
const HIT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const FETCH_TIMEOUT_MS = 4000; // 4 seconds
const MAX_IMAGE_BYTES = 512 * 1024; // 512 KB

try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch (_) {}

const BLOCKED_TLDS = new Set([
  'localhost',
  'local',
  'internal',
  'intranet',
  'corp',
  'home',
  'lan',
  'arpa',
  'test',
  'example',
  'invalid',
  'onion'
]);

const MULTI_PART_TLDS = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk',
  'com.au', 'net.au', 'org.au',
  'co.jp', 'ne.jp', 'or.jp',
  'com.br', 'org.br',
  'co.nz', 'org.nz',
  'co.za', 'org.za',
  'com.mx', 'com.sg', 'com.hk', 'com.tr', 'co.kr', 'co.in', 'co.il'
]);

// Known SHA-1 hashes of Google's generic default globe icons
const KNOWN_GLOBE_SHA1 = new Set([
  'd86226692d721f0ebeb7a7230d5886c976b74211',
  'b0be8c2f879c6f89f18db2c6be21e5b4e8f75101',
  '78c87039d7dc617a14d0c7e8d8eb4db77dc20ef9'
]);

function isValidPublicDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;
  if (domain.length < 3 || domain.length > 253) return false;
  if (net.isIP(domain) !== 0) return false;
  if (domain.includes(':') || domain.includes('/')) return false;

  const hostnameRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9]{2,59})$/;
  if (!hostnameRegex.test(domain)) return false;

  const labels = domain.split('.');
  const tld = labels[labels.length - 1];
  if (BLOCKED_TLDS.has(tld) || BLOCKED_TLDS.has(domain)) return false;

  return true;
}

function isPrivateOrReservedIp(ip) {
  if (!ip || typeof ip !== 'string') return true;
  let cleanIp = ip.trim().toLowerCase();
  if (cleanIp.startsWith('::ffff:')) {
    cleanIp = cleanIp.substring(7);
  }

  const version = net.isIP(cleanIp);
  if (version === 4) {
    const parts = cleanIp.split('.').map(n => parseInt(n, 10));
    if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b, c] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a === 198 && b === 51 && c === 100) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    if (a >= 224) return true; // Multicast & reserved
    return false;
  }

  if (version === 6) {
    if (cleanIp === '::1' || cleanIp === '::' || cleanIp === '0:0:0:0:0:0:0:1' || cleanIp === '0:0:0:0:0:0:0:0') return true;
    if (cleanIp.startsWith('fc') || cleanIp.startsWith('fd')) return true; // Unique local
    if (cleanIp.startsWith('fe8') || cleanIp.startsWith('fe9') || cleanIp.startsWith('fea') || cleanIp.startsWith('feb')) return true; // Link-local
    if (cleanIp.startsWith('ff')) return true; // Multicast
    if (cleanIp.startsWith('2001:db8:')) return true; // Documentation
    return false;
  }

  return true;
}

async function verifyDomainResolvesToPublicIp(domain) {
  try {
    const records = await dns.promises.lookup(domain, { all: true });
    if (!Array.isArray(records) || records.length === 0) return false;
    return records.every(r => r && r.address && !isPrivateOrReservedIp(r.address));
  } catch (_) {
    return false;
  }
}

function getRootDomain(domain) {
  const parts = domain.split('.');
  if (parts.length <= 2) return null;
  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_PART_TLDS.has(lastTwo)) {
    if (parts.length <= 3) return null;
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}

function detectImageFormat(buf, contentTypeHeader) {
  if (!Buffer.isBuffer(buf) || buf.length < 16) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4E &&
    buf[3] === 0x47
  ) {
    return { ext: 'png', contentType: 'image/png' };
  }

  // ICO: 00 00 01 00
  if (
    buf[0] === 0x00 &&
    buf[1] === 0x00 &&
    buf[2] === 0x01 &&
    buf[3] === 0x00
  ) {
    return { ext: 'ico', contentType: 'image/x-icon' };
  }

  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    return { ext: 'png', contentType: 'image/jpeg' };
  }

  // GIF: GIF87a or GIF89a
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38
  ) {
    return { ext: 'png', contentType: 'image/gif' };
  }

  // WEBP: RIFF....WEBP
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return { ext: 'png', contentType: 'image/webp' };
  }

  const ct = String(contentTypeHeader || '').toLowerCase();
  if (ct.includes('image/png')) return { ext: 'png', contentType: 'image/png' };
  if (ct.includes('image/x-icon') || ct.includes('image/vnd.microsoft.icon')) {
    return { ext: 'ico', contentType: 'image/x-icon' };
  }

  return null;
}

function isGoogleDefaultGlobe(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 200) return true;
  const sha1 = crypto.createHash('sha1').update(buf).digest('hex');
  if (KNOWN_GLOBE_SHA1.has(sha1)) return true;

  // Check PNG IHDR dimensions: when requesting sz=64 or sz=128, Google's generic fallback
  // globe is a tiny 16x16 PNG (< 800 bytes)
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 && buf.length >= 24) {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    if (width === 16 && height === 16 && buf.length < 800) {
      return true;
    }
  }
  return false;
}

async function fetchImageBuffer(url, { isGoogle = false, redirectMode = 'follow' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: redirectMode,
      headers: {
        'User-Agent': 'FlakeSecure-FaviconProxy/2.0',
        'Accept': 'image/png,image/x-icon,image/webp,image/*;q=0.8'
      },
      signal: controller.signal
    });

    if (!res.ok) return null;

    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_IMAGE_BYTES) return null;

    const reader = res.body && typeof res.body.getReader === 'function' ? res.body.getReader() : null;
    let buf;
    if (reader) {
      const chunks = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > MAX_IMAGE_BYTES) {
            await reader.cancel().catch(() => {});
            return null;
          }
          chunks.push(Buffer.from(value));
        }
      }
      buf = Buffer.concat(chunks);
    } else {
      const ab = await res.arrayBuffer();
      if (ab.byteLength > MAX_IMAGE_BYTES) return null;
      buf = Buffer.from(ab);
    }

    if (buf.length < 100) return null;
    if (isGoogle && isGoogleDefaultGlobe(buf)) return null;

    const format = detectImageFormat(buf, res.headers.get('content-type'));
    if (!format) return null;

    return {
      buffer: buf,
      ext: format.ext,
      contentType: format.contentType
    };
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

router.get('/:domain', faviconLimiter, async (req, res) => {
  const cleanDomain = String(req.params.domain || '').trim().toLowerCase();
  const rawSz = req.query.sz ? String(req.query.sz).trim() : '64';

  if (rawSz !== '64' && rawSz !== '128') {
    return res.status(400).json({
      error: 'Invalid size parameter. Allowed values: 64, 128.',
      code: 'INVALID_SIZE'
    });
  }
  const sz = parseInt(rawSz, 10);

  if (!isValidPublicDomain(cleanDomain)) {
    return res.status(400).json({
      error: 'Invalid or disallowed domain name',
      code: 'INVALID_DOMAIN'
    });
  }

  const cacheKey = crypto.createHash('sha1').update(`${cleanDomain}${sz}`).digest('hex');
  const metaPath = path.join(CACHE_DIR, `${cacheKey}.json`);

  // 1. Check disk cache
  try {
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const ageMs = Date.now() - (meta.fetchedAt || 0);

      if (meta.status === 'miss' && ageMs < MISS_TTL_MS) {
        return res.status(404).json({
          error: 'Favicon not found',
          code: 'FAVICON_NOT_FOUND'
        });
      }

      if (meta.status === 'hit' && ageMs < HIT_TTL_MS && meta.ext) {
        const imgPath = path.join(CACHE_DIR, `${cacheKey}.${meta.ext}`);
        if (fs.existsSync(imgPath)) {
          const etag = meta.etag || `"${cacheKey}"`;
          if (req.headers['if-none-match'] === etag) {
            return res.status(304).end();
          }
          const imgBuf = fs.readFileSync(imgPath);
          res.setHeader('Content-Type', meta.contentType || (meta.ext === 'ico' ? 'image/x-icon' : 'image/png'));
          res.setHeader('Cache-Control', 'public, max-age=2592000');
          res.setHeader('ETag', etag);
          return res.send(imgBuf);
        }
      }
    }
  } catch (_) {}

  // 2. Resolution chain:
  // (a) Google S2 exact host
  let result = await fetchImageBuffer(
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanDomain)}&sz=${sz}`,
    { isGoogle: true }
  );

  // (b) Google S2 root domain
  if (!result) {
    const rootDomain = getRootDomain(cleanDomain);
    if (rootDomain) {
      result = await fetchImageBuffer(
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(rootDomain)}&sz=${sz}`,
        { isGoogle: true }
      );
    }
  }

  // (c) icon.horse
  if (!result) {
    result = await fetchImageBuffer(
      `https://icon.horse/icon/${encodeURIComponent(cleanDomain)}?fallback=404`,
      { isGoogle: false }
    );
  }

  // (d) Direct https://<domain>/favicon.ico (with DNS SSRF verification)
  if (!result) {
    const isSafeDns = await verifyDomainResolvesToPublicIp(cleanDomain);
    if (isSafeDns) {
      result = await fetchImageBuffer(
        `https://${cleanDomain}/favicon.ico`,
        { isGoogle: false, redirectMode: 'manual' }
      );
    }
  }

  // 3. Persist cache & respond
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }

    if (result) {
      const imgSha1 = crypto.createHash('sha1').update(result.buffer).digest('hex');
      const etag = `"${imgSha1}"`;
      const imgPath = path.join(CACHE_DIR, `${cacheKey}.${result.ext}`);
      const meta = {
        domain: cleanDomain,
        sz,
        status: 'hit',
        ext: result.ext,
        contentType: result.contentType,
        etag,
        fetchedAt: Date.now()
      };
      fs.writeFileSync(imgPath, result.buffer);
      fs.writeFileSync(metaPath, JSON.stringify(meta), 'utf8');

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Cache-Control', 'public, max-age=2592000');
      res.setHeader('ETag', etag);
      return res.send(result.buffer);
    } else {
      const meta = {
        domain: cleanDomain,
        sz,
        status: 'miss',
        fetchedAt: Date.now()
      };
      fs.writeFileSync(metaPath, JSON.stringify(meta), 'utf8');
    }
  } catch (_) {}

  return res.status(404).json({
    error: 'Favicon not found',
    code: 'FAVICON_NOT_FOUND'
  });
});

module.exports = router;
