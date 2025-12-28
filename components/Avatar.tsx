import React, { useEffect, useMemo, useState } from 'react';
import { dicebearIdenticonPng, normalizeAvatarUrl } from '@/lib/media';

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

export default function Avatar({ url, seed, size, className, alt }: AvatarProps) {
  const [primaryErrored, setPrimaryErrored] = useState(false);
  const [fallbackErrored, setFallbackErrored] = useState(false);

  const primarySrc = useMemo(() => normalizeAvatarUrl(url), [url]);
  const fallbackSrc = useMemo(() => dicebearIdenticonPng(seed, Math.max(48, size * 2)), [seed, size]);
  const letter = useMemo(() => (seed || 'U').trim().slice(0, 1).toUpperCase() || 'U', [seed]);
  const hue = useMemo(() => hashToHue(seed), [seed]);

  // If URL changes, retry primary first.
  useEffect(() => {
    setPrimaryErrored(false);
    setFallbackErrored(false);
  }, [primarySrc]);

  // 1) Try primary URL (pfpUrl, ipfs, arweave, etc.)
  if (primarySrc && !primaryErrored) {
    return (
      <img
        src={primarySrc}
        alt={alt || 'avatar'}
        className={className}
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setPrimaryErrored(true)}
      />
    );
  }

  // 2) Fallback: always-https identicon (works in strict WebViews better than data: URLs)
  if (!fallbackErrored) {
    return (
      <img
        src={fallbackSrc}
        alt={alt || 'avatar'}
        className={className}
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setFallbackErrored(true)}
      />
    );
  }

  // 3) Last resort: colored letter (no network)
  {
    return (
      <div
        aria-label={alt || 'avatar'}
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          background: `hsl(${hue}, 70%, 45%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.92)',
          fontWeight: 800,
          fontSize: Math.floor(size * 0.44),
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        {letter}
      </div>
    );
  }
}


