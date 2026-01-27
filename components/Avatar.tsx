import React, { useEffect, useMemo, useState } from 'react';
import { normalizeAvatarUrl } from '@/lib/media';

type AvatarProps = {
  url?: string | null;
  seed: string;
  size: number;
  className?: string;
  alt?: string;
};

function hashToHue(seed: string): number {
  const s = (seed || 'user').toString();
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

function proxyUrl(src: string): string {
  const s = (src || '').trim();
  if (!s) return '';
  if (s.startsWith('/')) return s;
  if (s.startsWith('http://') || s.startsWith('https://')) {
    return `/api/avatar-proxy?url=${encodeURIComponent(s)}`;
  }
  return s;
}

export default function Avatar({ url, seed, size, className, alt }: AvatarProps) {
  const [primaryErrored, setPrimaryErrored] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const primarySrcRaw = useMemo(() => normalizeAvatarUrl(url), [url]);
  const primarySrc = useMemo(() => (primarySrcRaw ? proxyUrl(primarySrcRaw) : ''), [primarySrcRaw]);
  const hue = useMemo(() => hashToHue(seed), [seed]);

  // If URL changes, retry primary first.
  useEffect(() => {
    setPrimaryErrored(false);
    setImgLoaded(false);
  }, [primarySrcRaw]);

  // Always render IMAGE (no letters). Local placeholder stays visible if remote avatar can't load.
  const placeholderSrc = '/images/mrs-crypto.jpg';
  const showPrimary = !!primarySrc && !primaryErrored;

  return (
    <div
      aria-label={alt || 'avatar'}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: `hsl(${hue}, 30%, 92%)`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <img
        src={placeholderSrc}
        alt="avatar placeholder"
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: showPrimary && imgLoaded ? 0 : 1,
          transition: 'opacity 120ms ease',
        }}
      />

      {showPrimary ? (
        <img
          src={primarySrc}
          alt={alt || 'avatar'}
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          onLoad={() => setImgLoaded(true)}
          onError={() => setPrimaryErrored(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: imgLoaded ? 1 : 0,
            transition: 'opacity 120ms ease',
          }}
        />
      ) : null}
    </div>
  );
}


