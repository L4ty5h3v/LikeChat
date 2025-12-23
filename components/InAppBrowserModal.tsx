import React, { useEffect } from 'react';

type InAppBrowserModalProps = {
  url: string;
  title?: string;
  onClose: () => void;
};

export default function InAppBrowserModal({ url, title = 'Read the post', onClose }: InAppBrowserModalProps) {
  const hasUrl = typeof url === 'string' && url.trim().startsWith('http');
  const safeUrl = hasUrl ? url.trim() : '';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!hasUrl) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-[min(980px,calc(100vw-24px))] h-[min(80vh,720px)] rounded-2xl shadow-2xl overflow-hidden border border-white/30">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
          <div className="font-black text-gray-900 truncate pr-3">{title}</div>
          <div className="flex items-center gap-2">
            <a
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 hover:bg-gray-50"
            >
              Open in new tab
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-black text-gray-800 hover:bg-gray-50"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="w-full h-[calc(100%-48px)] bg-white">
          <iframe
            title="post"
            src={safeUrl}
            className="w-full h-full"
            referrerPolicy="no-referrer"
            // Note: no sandbox here because base.app/content may require its own scripts.
            allow="clipboard-read; clipboard-write; fullscreen"
          />
        </div>
      </div>
    </div>
  );
}


