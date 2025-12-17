import React, { useMemo, useState } from 'react';
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

export default function Avatar({ url, seed, size, className, alt }: AvatarProps) {
  const [errored, setErrored] = useState(false);

  const src = useMemo(() => normalizeAvatarUrl(url), [url]);
  const letter = useMemo(() => (seed || 'U').trim().slice(0, 1).toUpperCase() || 'U', [seed]);
  const hue = useMemo(() => hashToHue(seed), [seed]);

  if (!src || errored) {
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

  return (
    <img
      src={src}
      alt={alt || 'avatar'}
      className={className}
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
    />
  );
}


