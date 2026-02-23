import { useState, useEffect, useRef, useCallback } from "react";
import Layout from '@/components/Layout';
import VideoResult from '@/components/VideoResult';

const questions = [
  {
    id: 1,
    question: "Who do you want to flirt with?",
    options: ["friend", "coworker", "someone I know", "stranger"]
  },
  {
    id: 2,
    question: "In the magical world, which bird would be your crush's spirit animal?",
    options: ["swan", "falcon", "dove", "owl"]
  },
  {
    id: 3,
    question: "What's your first date style?",
    options: ["park walk", "coffee", "fancy dinner", "trip to Paris"]
  },
  {
    id: 4,
    question: "An ace up your sleeve?",
    options: ["handyman", "outdoorsy", "good cook", "nope"]
  },
  {
    id: 5,
    question: "How do people react when you tell a joke?",
    options: ["dead silence", "they roll their eyes", "some laugh", "they lose it"]
  }
];

const FINAL_MESSAGE = 'forging a key to your crush\'s heart...';

function App() {
  const [started, setStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<'choose' | 'read' | 'listen' | null>(null);
  // 'ready' = voice available, 'ios-hint' = iOS without Ava, false = no voice option
  const [voiceStatus, setVoiceStatus] = useState<'ready' | 'ios-hint' | false>(false);
  const pendingResult = useRef<string | null>(null);
  const pendingError = useRef<string | null>(null);

  // Check if a suitable TTS voice is available on this device
  useEffect(() => {
    // Guard: speechSynthesis may not exist in some webviews (e.g. Farcaster Android)
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setVoiceStatus(false);
      return;
    }

    let mounted = true;
    const checkVoice = () => {
      if (!mounted) return;
      try {
        const voices = speechSynthesis.getVoices();
        
        // Priority 1: Our two preferred Android/Chromebook voices
        const hasPreferred = voices.some(v =>
          v.name.includes('en-us-x-tpf-network') || v.name.includes('en-us-x-iob-network')
        );
        if (hasPreferred) { setVoiceStatus('ready'); return; }

        // Priority 2: iOS Ava
        const hasAva = voices.some(v => v.name.includes('Ava'));
        if (hasAva) { setVoiceStatus('ready'); return; }

        // Priority 3: Any US English female voice
        // Common female voice name patterns across platforms
        const femaleNames = ['samantha', 'victoria', 'allison', 'susan', 'karen',
          'kathy', 'princess', 'vicki', 'zira', 'jenny', 'aria',
          'sara', 'nicky', 'joana', 'fiona', 'female'];
        const hasUSFemale = voices.some(v => {
          const isUS = v.lang === 'en-US' || v.lang === 'en_US';
          const nameLower = v.name.toLowerCase();
          return isUS && femaleNames.some(f => nameLower.includes(f));
        });
        if (hasUSFemale) { setVoiceStatus('ready'); return; }

        // Priority 4 (last resort): Any English voice at all
        const hasAnyEnglish = voices.some(v => v.lang.startsWith('en'));
        if (hasAnyEnglish) { setVoiceStatus('ready'); return; }

        // Voices not loaded yet — don't give up, wait for onvoiceschanged
        if (voices.length === 0) return;

        // Detect iOS without good voice — show hint to download Ava
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        if (isIOS) { setVoiceStatus('ios-hint'); return; }

        // No suitable female US voice found — hide voice option
        setVoiceStatus(false);
      } catch (e) {
        console.warn('Voice check failed:', e);
        setVoiceStatus(false);
      }
    };

    checkVoice();
    try {
      speechSynthesis.onvoiceschanged = checkVoice;
    } catch (_) {}

    // Fallback: if voices never load, give up after 3s
    const timeout = setTimeout(() => {
      if (!mounted) return;
      // If still default (false), that's fine — voice option stays hidden
    }, 3000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      try { speechSynthesis.onvoiceschanged = null; } catch (_) {}
    };
  }, []);

  // Build rotating messages based on chosen bird
  const chosenBirdRef = useRef('spirit animal');
  // Update ref whenever answers change
  useEffect(() => {
    chosenBirdRef.current = answers[1] || 'spirit animal';
  }, [answers]);

  const getRotatingMessages = useCallback(() => [
    'checking your flirt-o-meter...',
    `consulting your crush's ${chosenBirdRef.current}...`,
    'doing some heart math...',
    'consulting Cupid...',
    'drinking my Aperol Spritz...',
    'shuffling my tarot cards...',
    'asking Venus for guidance...',
    'warming up my crystal ball...',
  ], []);

  useEffect(() => {
    if (!loading) return;
    let index = 0;
    let cancelled = false;
    const messages = getRotatingMessages();
    setLoadingMsg(messages[0]);

    const interval = setInterval(() => {
      if (cancelled) return;

      // If an error occurred, show it and stop
      if (pendingError.current) {
        clearInterval(interval);
        setError(pendingError.current);
        pendingError.current = null;
        setLoading(false);
        return;
      }

      // If result has arrived, jump to final message then show choice or read
      if (pendingResult.current) {
        clearInterval(interval);
        setLoadingMsg(FINAL_MESSAGE);
        setTimeout(() => {
          if (!cancelled) {
            setResult(pendingResult.current);
            pendingResult.current = null;
            setLoading(false);
            setDeliveryMode(voiceStatus ? 'choose' : 'read');
          }
        }, 2500);
        return;
      }

      index++;
      // Cycle through messages continuously
      setLoadingMsg(messages[index % messages.length]);
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [loading, getRotatingMessages, voiceStatus]);

  const handleAnswer = async (answer: string) => {
    const updated = [...answers];
    updated[currentQuestion] = answer;
    setAnswers(updated);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // All questions answered — start loading and fetch
      setLoading(true);
      setError(null);
      pendingResult.current = null;
      pendingError.current = null;

      try {
        const res = await fetch("/api/process-answers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: updated })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server error: ${res.status}`);
        }

        const data = await res.json();
        if (data.result) {
          pendingResult.current = data.result;
        } else {
          throw new Error('Empty response from Mrs. Crypto');
        }
      } catch (err: any) {
        console.error('Fetch error:', err);
        pendingError.current = err.message || 'Something went wrong. Please try again!';
      }
    }
  };

  return (
    <Layout title="Mrs. Crypto's Flirting Tips">
      {/* Hero Section */}
      <div className="relative min-h-screen min-h-[100dvh] overflow-hidden" style={{ background: '#B71C1C' }}>
        
        {/* Floating shapes — hidden on very small screens */}
        <div className="hidden sm:block absolute top-20 right-20 w-32 h-32 bg-white bg-opacity-10 rounded-full animate-float"></div>
        <div className="hidden sm:block absolute bottom-32 left-20 w-24 h-24 bg-white bg-opacity-15 rounded-full animate-float" style={{animationDelay: '2s'}}></div>
        
        {/* INTRO SCREEN — stacked: header → button → image (fills remaining space) */}
        {!started && (
          <div className="absolute inset-0 z-20 flex flex-col min-h-screen min-h-[100dvh]" style={{ background: '#B71C1C' }}>
            {/* Header area */}
            <div className="flex-shrink-0 text-center pt-8 sm:pt-12 px-4">
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white mb-2 sm:mb-3 font-display drop-shadow-lg">
                💕 FLIRTING TIPS 💕
              </h1>
              <p className="text-base sm:text-xl text-white drop-shadow-md">
                Get personalized advice from Mrs. Crypto
              </p>
            </div>
            
            {/* Button area — sits between header and image */}
            <div className="flex-shrink-0 py-5 sm:py-7 px-6 text-center">
              <button
                onClick={() => setStarted(true)}
                className="px-10 sm:px-12 py-4 sm:py-5 text-white font-bold text-lg sm:text-xl active:scale-[0.98] transition-all duration-200 rounded-2xl shadow-2xl"
                style={{
                  background: 'linear-gradient(135deg, #9ca3af, #b0b7c3, #9ca3af)',
                  border: '2px solid rgba(255, 255, 255, 0.4)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                }}
              >
                💕 Let's talk!
              </button>
            </div>

            {/* MC image — fills all remaining space below the button */}
            <div className="flex-1 min-h-0 relative overflow-hidden">
              <img
                src="/mrs-crypto-cover-portrait.webp"
                alt="Mrs. Crypto"
                className="absolute inset-0 w-full h-full object-cover object-top"
              />
            </div>
          </div>
        )}

        <div className="relative z-10 max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-8 flex flex-col min-h-screen min-h-[100dvh]">

          {/* Quiz card */}
          <div className={`bg-white bg-opacity-95 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-12 border border-white border-opacity-20 flex-1 flex flex-col justify-center ${!started ? 'hidden' : ''}`}>
            {started && !result && !loading && !error && (
              <>
                <h2 className="text-xl sm:text-3xl md:text-4xl font-black text-dark mb-4 sm:mb-8 text-center font-display">
                  {questions[currentQuestion].question}
                </h2>
                <div className="space-y-3 sm:space-y-4">
                  {questions[currentQuestion].options.map((option) => (
                    <button
                      key={option}
                      onClick={() => handleAnswer(option)}
                      className="btn-gold-glow w-full px-4 sm:px-6 py-3.5 sm:py-4 text-left text-white font-bold text-base sm:text-lg group relative overflow-hidden active:scale-[0.98] transition-transform"
                    >
                      {/* Shimmer effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 z-10"></div>
                      <span className="relative z-20">{option}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-4 sm:mt-8 text-center">
                  <p className="text-sm sm:text-base text-gray-600">
                    Question {currentQuestion + 1} of {questions.length}
                  </p>
                </div>
              </>
            )}

            {loading && (
              <div className="text-center py-8 sm:py-12">
                <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-xl sm:text-2xl font-bold text-dark">{loadingMsg}</p>
              </div>
            )}

            {error && !loading && (
              <div className="text-center py-8 sm:py-12">
                <p className="text-xl sm:text-2xl font-bold text-red-500 mb-4">
                  Oops! Mrs. Crypto spilled her Aperol Spritz 🍹
                </p>
                <p className="text-gray-600 mb-6">{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    setStarted(false);
                    setCurrentQuestion(0);
                    setAnswers([]);
                    setResult(null);
                  }}
                  className="btn-gold-glow px-8 py-3.5 text-white font-bold text-base sm:text-lg active:scale-[0.98] transition-transform"
                >
                  💕 Try Again
                </button>
              </div>
            )}

            {result && deliveryMode === 'choose' && (
              <div className="text-center py-8 sm:py-12">
                <h2 className="text-2xl sm:text-3xl font-black text-dark mb-6 sm:mb-8 font-display">
                  ✨ Your tip is ready! ✨
                </h2>
                <p className="text-gray-600 mb-6 sm:mb-8 text-base sm:text-lg">
                  How would you like it?
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
                  <button
                    onClick={() => setDeliveryMode('read')}
                    className="btn-gold-glow px-8 sm:px-10 py-3.5 sm:py-4 text-white font-bold text-base sm:text-lg active:scale-[0.98] transition-transform w-full sm:w-auto"
                  >
                    👀 Read it
                  </button>
                  <button
                    onClick={() => setDeliveryMode('listen')}
                    className="btn-gold-glow px-8 sm:px-10 py-3.5 sm:py-4 text-white font-bold text-base sm:text-lg active:scale-[0.98] transition-transform w-full sm:w-auto"
                  >
                    👂 Hear it{voiceStatus === 'ios-hint' ? '*' : ''}
                  </button>
                </div>
                {voiceStatus === 'ios-hint' && (
                  <p className="text-gray-500 text-xs sm:text-sm mt-4 px-4 leading-relaxed">
                    * For best experience on iPhone, download free "Ava (Enhanced)" voice:<br />
                    Settings → Accessibility → Spoken Content → Voices → English (US) → Ava
                  </p>
                )}
              </div>
            )}

            {result && (deliveryMode === 'read' || deliveryMode === 'listen') && (
              <VideoResult
                result={result}
                mode={deliveryMode}
                onStartOver={() => {
                  setStarted(false);
                  setCurrentQuestion(0);
                  setAnswers([]);
                  setResult(null);
                  setDeliveryMode(null);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default App;
