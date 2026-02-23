import { useState, useRef, useEffect, useCallback } from 'react';

// Video files in /public/videos/
const VIDEOS = [
  '/videos/mrs-crypto-1.mp4',
  '/videos/mrs-crypto-2.mp4',
  '/videos/mrs-crypto-3.mp4',
  '/videos/mrs-crypto-4.mp4',
  '/videos/mrs-crypto-5.mp4',
];

// $MCT token on Base chain (CAIP-19 format)
const MCT_TOKEN = 'eip155:8453/erc20:0x04D388DA70C32FC5876981097c536c51c8d3D236';
const BASE_ETH = 'eip155:8453/native';
const MCT_UNISWAP_URL = 'https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=0x04D388DA70C32FC5876981097c536c51c8d3D236&chain=base';

// TTS settings
const TTS_RATE = 0.9;
const TTS_PITCH = 0.8;

// Safe check for speechSynthesis availability
function hasTTS(): boolean {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && !!window.speechSynthesis;
  } catch {
    return false;
  }
}

interface VideoResultProps {
  result: string;
  mode: 'read' | 'listen';
  onStartOver: () => void;
}

/**
 * Split text into sentence-sized chunks for TTS.
 * Fixes Chrome bug where long utterances get cut off after ~15s.
 */
function splitIntoChunks(text: string): string[] {
  const raw = text.match(/[^.!?]+[.!?]+[\s]*/g);
  if (!raw) return [text];

  // Merge very short chunks with the previous one
  const merged: string[] = [];
  for (const chunk of raw) {
    if (merged.length > 0 && merged[merged.length - 1].length < 40) {
      merged[merged.length - 1] += chunk;
    } else {
      merged.push(chunk);
    }
  }
  return merged.length > 0 ? merged : [text];
}

/**
 * Pick best TTS voice available.
 * Priority: our 2 preferred Android voices → iOS Ava Enhanced → iOS Ava → US English female voices only
 */
function pickVoice(): SpeechSynthesisVoice | null {
  if (!hasTTS()) return null;
  try {
    const voices = speechSynthesis.getVoices();

    // Priority 1: Preferred Android/Chromebook voices
    const pref1 = voices.find(v => v.name.includes('en-us-x-tpf-network'));
    if (pref1) return pref1;
    const pref2 = voices.find(v => v.name.includes('en-us-x-iob-network'));
    if (pref2) return pref2;

    // Priority 2: iOS Ava Enhanced/Premium (downloaded high-quality version)
    const avaEnhanced = voices.find(v => v.name.includes('Ava') && 
      (v.name.includes('Enhanced') || v.name.includes('Premium')));
    if (avaEnhanced) return avaEnhanced;

    // Priority 3: iOS Ava — prefer the non-compact version
    // If multiple Ava voices exist, pick the one with the longest name/voiceURI
    // (Enhanced versions have longer identifiers like "com.apple.voice...premium")
    const avaVoices = voices.filter(v => v.name.includes('Ava'));
    if (avaVoices.length > 0) {
      // Sort by voiceURI length descending — enhanced voices have longer URIs
      avaVoices.sort((a, b) => (b.voiceURI?.length || 0) - (a.voiceURI?.length || 0));
      return avaVoices[0];
    }

    // Priority 4: Any iOS Enhanced/Premium US English female voice
    const femaleNames = ['samantha', 'victoria', 'allison', 'susan', 'karen',
      'kathy', 'princess', 'vicki', 'zira', 'jenny', 'aria',
      'sara', 'nicky', 'joana', 'fiona', 'female'];
    
    // First try Enhanced/Premium variants
    const enhancedFemale = voices.find(v => {
      const isUS = v.lang === 'en-US' || v.lang === 'en_US';
      const nameLower = v.name.toLowerCase();
      const isEnhanced = nameLower.includes('enhanced') || nameLower.includes('premium');
      return isUS && isEnhanced && femaleNames.some(f => nameLower.includes(f));
    });
    if (enhancedFemale) return enhancedFemale;

    // Then any US female voice
    const usFemale = voices.find(v => {
      const isUS = v.lang === 'en-US' || v.lang === 'en_US';
      const nameLower = v.name.toLowerCase();
      return isUS && femaleNames.some(f => nameLower.includes(f));
    });
    if (usFemale) return usFemale;

    // Priority 5 (last resort): Any English voice at all
    const anyEnglish = voices.find(v => v.lang.startsWith('en'));
    if (anyEnglish) return anyEnglish;

    // No suitable voice
    return null;
  } catch {
    return null;
  }
}

export default function VideoResult({ result, mode, onStartOver }: VideoResultProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<'playing' | 'typing' | 'speaking' | 'done'>('playing');
  const [displayedText, setDisplayedText] = useState('');
  const [videoSrc] = useState(() => VIDEOS[Math.floor(Math.random() * VIDEOS.length)]);
  const [ttsError, setTtsError] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const ttsStartedRef = useRef(false);
  const videoStartedRef = useRef(false);
  const phaseAdvancedRef = useRef(false);

  // Advance from video phase (only once)
  const advanceFromVideo = useCallback(() => {
    if (phaseAdvancedRef.current) return;
    phaseAdvancedRef.current = true;
    // Mute and pause the video so audio doesn't overlap with TTS or distract during text
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      try { video.pause(); } catch (_) {}
    }
    setPhase(mode === 'listen' ? 'speaking' : 'typing');
  }, [mode]);

  const handleTipBack = useCallback(async () => {
    if (hasTTS()) {
      try { speechSynthesis.cancel(); } catch (_) {}
    }

    try {
      const { sdk, isInMiniApp } = await import('@farcaster/miniapp-sdk');
      const isMiniApp = typeof isInMiniApp === 'function' ? isInMiniApp() : false;
      if (isMiniApp && sdk?.actions?.swapToken) {
        await sdk.actions.swapToken({
          sellToken: BASE_ETH,
          buyToken: MCT_TOKEN,
        });
        onStartOver();
        return;
      }
    } catch (e) {
      console.log('Farcaster SDK swap not available, falling back to Uniswap:', e);
    }

    window.open(MCT_UNISWAP_URL, '_blank');
    const handleReturn = () => {
      onStartOver();
      window.removeEventListener('focus', handleReturn);
    };
    window.addEventListener('focus', handleReturn);
  }, [onStartOver]);

  // ── Video playback with fallback timeout ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video || phase !== 'playing') return;

    let fallbackTimer: ReturnType<typeof setTimeout>;

    const onTimeUpdate = () => {
      videoStartedRef.current = true;
      if (video.duration && video.currentTime >= video.duration - 1) {
        advanceFromVideo();
      }
    };

    const onEnded = () => advanceFromVideo();
    const onError = () => {
      console.warn('Video error, skipping to result');
      advanceFromVideo();
    };

    // BUG #4 FIX: If video doesn't start within 6s, or doesn't end within 25s, skip it
    fallbackTimer = setTimeout(() => {
      if (phase === 'playing') {
        console.warn('Video timeout, advancing');
        advanceFromVideo();
      }
    }, videoStartedRef.current ? 25000 : 6000);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);

    // Start muted (always works), then try to unmute
    video.muted = true;
    video.play().then(() => {
      // Try unmuting after play started
      video.muted = false;
    }).catch(() => {
      console.warn('Autoplay failed even muted, skipping video');
      advanceFromVideo();
    });

    return () => {
      clearTimeout(fallbackTimer);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
    };
  }, [phase, advanceFromVideo]);

  // ── Typewriter effect (read mode) ──
  useEffect(() => {
    if (phase !== 'typing') return;

    let index = 0;
    const interval = setInterval(() => {
      if (index < result.length) {
        setDisplayedText(result.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
        setPhase('done');
      }
    }, 30);

    return () => clearInterval(interval);
  }, [phase, result]);

  // ── Speech synthesis (listen mode) with chunking + Chrome keepalive ──
  useEffect(() => {
    if (phase !== 'speaking') return;

    // BUG #3 FIX: If no TTS API (e.g. Farcaster Android webview), fall back to text
    if (!hasTTS()) {
      console.warn('No speechSynthesis, falling back to text');
      setTtsError(true);
      setPhase('typing');
      return;
    }

    let cancelled = false;
    ttsStartedRef.current = false;
    setCountdown(10);

    const speak = () => {
      if (cancelled) return;

      try { speechSynthesis.cancel(); } catch (_) {}

      const voice = pickVoice();
      const chunks = splitIntoChunks(result);
      let currentChunk = 0;

      // Safety timeout: if TTS doesn't finish within 60s, go to done
      const safetyTimeout = setTimeout(() => {
        if (!cancelled) {
          console.warn('TTS safety timeout');
          try { speechSynthesis.cancel(); } catch (_) {}
          setPhase('done');
        }
      }, 60000);

      const speakNext = () => {
        if (cancelled || currentChunk >= chunks.length) {
          clearTimeout(safetyTimeout);
          if (!cancelled) setPhase('done');
          return;
        }

        const utterance = new SpeechSynthesisUtterance(chunks[currentChunk]);
        utterance.rate = TTS_RATE;
        utterance.pitch = TTS_PITCH;
        if (voice) utterance.voice = voice;

        utterance.onstart = () => {
          ttsStartedRef.current = true;
          setCountdown(null);
        };

        utterance.onend = () => {
          currentChunk++;
          speakNext();
        };

        utterance.onerror = (e) => {
          console.warn('TTS chunk error:', e);
          if (currentChunk === 0) {
            clearTimeout(safetyTimeout);
            if (!cancelled) {
              setTtsError(true);
              setCountdown(null);
              setPhase('typing');
            }
            return;
          }
          currentChunk++;
          speakNext();
        };

        speechSynthesis.speak(utterance);

        // BUG #1 FIX: Chrome pauses long TTS. Periodically resume.
        const keepAlive = setInterval(() => {
          if (cancelled) { clearInterval(keepAlive); return; }
          try {
            if (speechSynthesis.paused) speechSynthesis.resume();
          } catch (_) {}
          if (!speechSynthesis.speaking) clearInterval(keepAlive);
        }, 3000);

        const origOnEnd = utterance.onend;
        utterance.onend = (ev) => {
          clearInterval(keepAlive);
          if (origOnEnd) (origOnEnd as any).call(utterance, ev);
        };
        const origOnError = utterance.onerror;
        utterance.onerror = (ev) => {
          clearInterval(keepAlive);
          if (origOnError) (origOnError as any).call(utterance, ev);
        };
      };

      speakNext();
    };

    // BUG #2 FIX: iOS may not have voices loaded yet. Wait for them with timeout.
    try {
      const voices = speechSynthesis.getVoices();
      if (voices.length === 0) {
        const voiceTimeout = setTimeout(() => speak(), 2000);
        const onVoicesChanged = () => {
          clearTimeout(voiceTimeout);
          speechSynthesis.onvoiceschanged = null;
          speak();
        };
        speechSynthesis.onvoiceschanged = onVoicesChanged;

        return () => {
          cancelled = true;
          clearTimeout(voiceTimeout);
          try {
            speechSynthesis.onvoiceschanged = null;
            speechSynthesis.cancel();
          } catch (_) {}
        };
      } else {
        speak();
        return () => {
          cancelled = true;
          try { speechSynthesis.cancel(); } catch (_) {}
        };
      }
    } catch (e) {
      console.warn('TTS init error:', e);
      setTtsError(true);
      setPhase('typing');
      return;
    }
  }, [phase, result]);

  // ── Countdown timer: 10→0, falls back to text if voice doesn't start ──
  useEffect(() => {
    if (countdown === null || phase !== 'speaking') return;

    if (countdown <= 0) {
      // Time's up — fall back to text
      console.warn('Countdown reached 0, falling back to text');
      if (hasTTS()) {
        try { speechSynthesis.cancel(); } catch (_) {}
      }
      setTtsError(true);
      setCountdown(null);
      setPhase('typing');
      return;
    }

    const timer = setTimeout(() => {
      // Only tick down if TTS hasn't started yet
      if (!ttsStartedRef.current) {
        setCountdown(countdown - 1);
      } else {
        setCountdown(null);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, phase]);

  const isVideoBlurred = phase === 'typing' || phase === 'speaking' || phase === 'done';
  const showText = phase === 'typing' || (phase === 'done' && (mode === 'read' || ttsError));
  const showSpeakingRing = phase === 'speaking';
  const showDoneMessage = phase === 'done' && mode === 'listen' && !ttsError;

  let headerText = '✨ Hello! ✨';
  if (phase === 'typing' || phase === 'speaking' || phase === 'done') {
    headerText = '✨ Your Flirting Tip ✨';
  }

  return (
    <div className="text-center">
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-dark mb-3 sm:mb-6 font-display">
        {headerText}
      </h2>

      {/* Video container */}
      <div
        className="relative rounded-xl sm:rounded-2xl overflow-hidden mb-4 sm:mb-6"
        style={{ minHeight: '240px', maxHeight: '70vh' }}
      >
        <video
          ref={videoRef}
          src={videoSrc}
          playsInline
          webkit-playsinline="true"
          muted
          className={`w-full h-full object-cover transition-all duration-1000 ${
            isVideoBlurred ? 'blur-md scale-105 brightness-50' : ''
          }`}
          style={{ minHeight: '240px', maxHeight: '70vh' }}
        />

        {/* Text overlay */}
        {showText && (
          <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
            <div className="max-h-full overflow-y-auto scrollbar-hide">
              {ttsError && phase === 'typing' && displayedText === '' && (
                <p className="text-yellow-300 text-sm mb-3">
                  🔇 I think I lost my voice today, sorry!
                </p>
              )}
              <p
                className={`text-white text-base sm:text-xl leading-relaxed font-medium transition-opacity duration-500 ${
                  phase === 'done' ? 'opacity-100' : 'opacity-90'
                }`}
                style={{
                  textShadow: '0 1px 4px rgba(0,0,0,0.7), 0 0 12px rgba(0,0,0,0.4)',
                }}
              >
                {displayedText}
                {phase === 'typing' && (
                  <span className="inline-block w-0.5 h-4 sm:h-5 bg-white ml-0.5 animate-pulse" />
                )}
              </p>
            </div>
          </div>
        )}

        {/* Rotating ring while speaking */}
        {showSpeakingRing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <div
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white border-t-transparent"
                style={{ animation: 'spin 2s linear infinite' }}
              ></div>
              <div
                className="absolute inset-3 sm:inset-4 rounded-full border-2 border-white border-b-transparent"
                style={{ animation: 'spin 1.5s linear infinite reverse' }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center">
                {countdown !== null ? (
                  <span className="text-white text-2xl sm:text-3xl font-bold" style={{
                    textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                  }}>{countdown}</span>
                ) : (
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white animate-pulse"></div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Done message for listen mode */}
        {showDoneMessage && (
          <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
            <p
              className="text-white text-lg sm:text-2xl font-medium opacity-90"
              style={{
                textShadow: '0 1px 4px rgba(0,0,0,0.7), 0 0 12px rgba(0,0,0,0.4)',
              }}
            >
              💕 Hope that helped, darling!
            </p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {phase === 'done' && (
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center items-center sm:items-start">
          <div className="text-center">
            <button
              onClick={onStartOver}
              className="btn-gold-glow px-5 sm:px-8 py-3.5 sm:py-4 text-white font-bold text-sm sm:text-lg animate-scale-in active:scale-[0.98] transition-transform w-full"
            >
              💕 Thank you, Mrs. Crypto!
            </button>
            <p className="text-white text-opacity-60 text-xs mt-1.5">finish and restart the quiz</p>
          </div>
          <div className="text-center">
            <button
              onClick={handleTipBack}
              className="btn-gold-glow px-5 sm:px-8 py-3.5 sm:py-4 text-white font-bold text-sm sm:text-lg animate-scale-in active:scale-[0.98] transition-transform w-full"
              style={{ animationDelay: '0.1s' }}
            >
              🪙 Tip back
            </button>
            <p className="text-white text-opacity-60 text-xs mt-1.5">buy Mrs. Crypto's token $MCT</p>
          </div>
        </div>
      )}
    </div>
  );
}
