import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LoveHeader } from './website/LoveHeader';
import { BackgroundHearts } from './components/BackgroundHearts';
import { HeartRain } from './components/HeartRain';
import { RomanticParticleCanvas, useRomanticTyping } from './components/CaretParticles';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config/supabase';

const FORM_ENDPOINT = 'https://formspree.io/f/xnjkpozb';
const N8N_SIGNUP_WEBHOOK_URL = 'https://bhavishai.app.n8n.cloud/webhook/Website-signup';
const MUSIC_SRC = '/assets/music.mp3';
const REQUIRED_CLICKS = 3;
const AUTH_STORAGE_KEY = 'nikita-supabase-session';

type StepKind = 'choice' | 'textarea';
type AuthMode = 'login' | 'signup';
type AuthStatus = 'idle' | 'loading';

interface RomanticStep {
  id: string;
  kind: StepKind;
  title: string;
  note: string;
  placeholder?: string;
  actionLabel: string;
}

interface SignupForm {
  name: string;
  email: string;
  phone: string;
  password: string;
}

interface LoginForm {
  email: string;
  password: string;
}

const STEPS: RomanticStep[] = [
  {
    id: 'ready',
    kind: 'choice',
    title: 'Can we start softly, my love?',
    note: 'No pressure, no rush. Just a tiny romantic moment made for us.',
    actionLabel: 'Yes, continue'
  },
  {
    id: 'feeling',
    kind: 'textarea',
    title: 'Write one honest feeling for me',
    note: 'Even a small line is enough. I just want to understand your heart gently.',
    placeholder: 'Type your feeling here...',
    actionLabel: 'Proceed'
  },
  {
    id: 'promise',
    kind: 'choice',
    title: 'Will you keep choosing us with kindness?',
    note: 'I promise to listen, improve, and love you with a softer heart every day.',
    actionLabel: 'Yes, I will'
  },
  {
    id: 'letter',
    kind: 'textarea',
    title: 'One last message for me',
    note: 'This final note will be saved with love, then I will show you a thank-you letter.',
    placeholder: 'Write anything you want me to keep close...',
    actionLabel: 'Submit with love'
  }
];

const STORAGE_KEY = 'nikita-simple-love-flow';

function safeReadState(): Record<string, any> {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function randomOffset(range = 54) {
  const x = Math.round(Math.random() * range * 2 - range);
  const y = Math.round(Math.random() * range * 2 - range);
  return { x, y };
}

function randomNoPosition() {
  return {
    x: Math.round(Math.random() * 190 - 95),
    y: Math.round(Math.random() * 92 - 46)
  };
}

async function supabaseAuthRequest(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.msg ||
      data?.message ||
      data?.error_description ||
      data?.error ||
      'Something went wrong. Please try again.';
    throw new Error(message);
  }

  return data;
}

async function sendSignupWebhook(payload: {
  name: string;
  email: string;
  phone: string;
  user_id: string;
  registered_at: string;
}) {
  const response = await fetch(N8N_SIGNUP_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`n8n webhook returned ${response.status}`);
  }
}

function saveAuthSession(session: unknown) {
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Login still succeeds even if browser storage is unavailable.
  }
}

export default function App() {
  const savedState = useMemo<Record<string, any>>(() => {
    if (typeof window === 'undefined') return {};
    return safeReadState();
  }, []);
  const isDashboardPage = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const pathname = window.location.pathname.toLowerCase().replace(/\/+$/, '');
    return pathname.endsWith('/dashboard.html') || pathname.endsWith('/dashboard');
  }, []);

  const [stepIndex, setStepIndex] = useState(() => Number(savedState.stepIndex || 0));
  const [answers, setAnswers] = useState<Record<string, string>>(() => savedState.answers || {});
  const [buttonClicks, setButtonClicks] = useState<Record<string, number>>({});
  const [buttonOffset, setButtonOffset] = useState({ x: 0, y: 0 });
  const [noOffset, setNoOffset] = useState({ x: 0, y: 0 });
  const [musicOn, setMusicOn] = useState(false);
  const [musicError, setMusicError] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const [isComplete, setIsComplete] = useState(() => Boolean(savedState.isComplete));
  const [isPBarGlowing, setIsPBarGlowing] = useState(false);
  const [isPBarPulsing, setIsPBarPulsing] = useState(false);
  const [petals, setPetals] = useState<{ id: number; left: number; delay: number; duration: number; size: number }[]>([]);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle');
  const [authMessage, setAuthMessage] = useState('');
  const [signupForm, setSignupForm] = useState<SignupForm>({
    name: '',
    email: '',
    phone: '',
    password: ''
  });
  const [loginForm, setLoginForm] = useState<LoginForm>({
    email: '',
    password: ''
  });
  const audioRef = useRef<HTMLAudioElement>(null);
  const typing = useRomanticTyping<HTMLTextAreaElement>();

  const currentStep = STEPS[Math.min(stepIndex, STEPS.length - 1)];
  const currentClicks = buttonClicks[currentStep.id] || 0;
  const remainingClicks = Math.max(REQUIRED_CLICKS - currentClicks, 1);
  const progressStep = isComplete ? STEPS.length : stepIndex + 1;

  useEffect(() => {
    const items = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 8,
      duration: Math.random() * 6 + 8,
      size: Math.random() * 10 + 8
    }));
    setPetals(items);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          stepIndex,
          answers,
          isComplete
        })
      );
    } catch {
      // The website should keep working even when localStorage is blocked.
    }
  }, [stepIndex, answers, isComplete]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.6;
    audio.loop = true;
  }, []);

  const playPrimarySfx = () => {
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextCtor();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.13);
      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch {
      // Decorative sound only.
    }
  };

  const startMusic = async () => {
    const audio = audioRef.current;
    if (!audio) return false;

    try {
      setMusicError('');
      audio.volume = 0.6;
      audio.loop = true;
      await audio.play();
      setMusicOn(true);
      return true;
    } catch (error) {
      console.error('[Music] Could not start background music.', {
        expectedPath: MUSIC_SRC,
        error
      });
      setMusicOn(false);
      setMusicError('Music could not start. Please tap Music On again, or check /assets/music.mp3.');
      return false;
    }
  };

  const toggleMusic = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (musicOn && !audio.paused) {
      audio.pause();
      setMusicOn(false);
      return;
    }

    await startMusic();
  };

  const pulseProgress = () => {
    setIsPBarGlowing(true);
    setIsPBarPulsing(true);
    window.setTimeout(() => {
      setIsPBarGlowing(false);
      setIsPBarPulsing(false);
    }, 850);
  };

  const submitAnswers = async () => {
    setSubmitStatus('sending');

    const payload = {
      _subject: 'Someone completed your love website',
      ready: 'yes',
      feeling: answers.feeling || '',
      promise: 'yes',
      finalMessage: answers.letter || ''
    };

    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`Formspree returned ${res.status}`);
      setIsComplete(true);
      setSubmitStatus('idle');
    } catch (error) {
      console.error('[Form] Could not submit romantic answers.', error);
      setSubmitStatus('error');
    }
  };

  const moveForward = async () => {
    playPrimarySfx();
    setButtonOffset(randomOffset());
    pulseProgress();

    if (!musicOn) {
      await startMusic();
    }

    const nextCount = currentClicks + 1;
    setButtonClicks(prev => ({ ...prev, [currentStep.id]: nextCount }));

    if (nextCount < REQUIRED_CLICKS) return;

    if (currentStep.id === 'letter') {
      await submitAnswers();
      return;
    }

    setButtonClicks(prev => ({ ...prev, [currentStep.id]: 0 }));
    setButtonOffset({ x: 0, y: 0 });
    setNoOffset({ x: 0, y: 0 });
    setStepIndex(prev => Math.min(prev + 1, STEPS.length - 1));
  };

  const moveNoButton = () => {
    setNoOffset(randomNoPosition());
  };

  const blockNoClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setNoOffset(randomNoPosition());
    playPrimarySfx();
  };

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthMessage('');

    const name = signupForm.name.trim();
    const email = signupForm.email.trim();
    const phone = signupForm.phone.trim();

    if (!name || !email || !phone || !signupForm.password) {
      setAuthMessage('Please fill in all signup fields.');
      return;
    }

    setAuthStatus('loading');

    try {
      const signupResult = await supabaseAuthRequest('signup', {
        email,
        password: signupForm.password,
        data: {
          name,
          phone
        }
      });

      try {
        await sendSignupWebhook({
          name,
          email,
          phone,
          user_id: signupResult?.user?.id || signupResult?.id || '',
          registered_at: new Date().toISOString()
        });
      } catch (webhookError) {
        console.error('[n8n] Signup webhook failed.', webhookError);
      }

      setSignupForm({ name: '', email: '', phone: '', password: '' });
      setAuthMode('login');
      setAuthMessage('Signup successful. Please login.');
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Signup failed. Please try again.');
    } finally {
      setAuthStatus('idle');
    }
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthMessage('');

    const email = loginForm.email.trim();

    if (!email || !loginForm.password) {
      setAuthMessage('Please enter your email and password.');
      return;
    }

    setAuthStatus('loading');

    try {
      const session = await supabaseAuthRequest('token?grant_type=password', {
        email,
        password: loginForm.password
      });
      saveAuthSession(session);
      window.location.href = 'dashboard.html';
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Login failed. Please try again.');
      setAuthStatus('idle');
    }
  };

  const isActionDisabled =
    submitStatus === 'sending' ||
    (currentStep.kind === 'textarea' && !(answers[currentStep.id] || '').trim());

  if (!isDashboardPage) {
    const isSignup = authMode === 'signup';

    return (
      <div className="min-h-screen bg-[#1a050d] text-[#fff0f3] selection:bg-pink-400/30 selection:text-white overflow-x-hidden relative font-sans">
        <BackgroundHearts />
        <RomanticParticleCanvas />

        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,77,109,0.16),transparent_34%),linear-gradient(180deg,#1a050d_0%,#2c0b17_48%,#110208_100%)]" />
          <div className="absolute inset-0 opacity-[0.05] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />
          {petals.map(p => (
            <span
              key={p.id}
              className="petal"
              style={{
                left: `${p.left}%`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                width: `${p.size}px`,
                height: `${p.size}px`
              }}
            />
          ))}
        </div>

        <main className="relative z-10 min-h-screen w-full max-w-xl mx-auto px-4 py-16 flex items-center justify-center">
          <motion.section
            className="w-full rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 sm:p-8 shadow-[0_15px_45px_rgba(0,0,0,0.5)] text-center relative overflow-hidden"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_0%,rgba(255,133,161,0.16),transparent_28%),radial-gradient(circle_at_80%_100%,rgba(255,214,231,0.08),transparent_30%)]" />

            <div className="relative">
              <p className="font-outfit uppercase tracking-[0.32em] text-[10px] text-pink-300/65 font-bold mb-4">
                Private love space
              </p>
              <h1 className="font-display font-light italic text-3xl sm:text-4xl leading-tight tracking-tight mb-4">
                {isSignup ? 'Create your account' : 'Login to continue'}
              </h1>
              <p className="text-sm sm:text-base leading-relaxed text-pink-100/82 max-w-md mx-auto mb-7">
                {isSignup
                  ? 'Sign up softly, then login to open the romantic dashboard.'
                  : 'Enter your email and password to open the dashboard.'}
              </p>

              <div className="grid grid-cols-2 gap-2 rounded-full border border-white/10 bg-white/5 p-1 mb-6">
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 text-xs font-outfit font-bold uppercase tracking-[0.18em] transition-colors ${
                    !isSignup ? 'bg-white text-[#1a050d]' : 'text-pink-100 hover:bg-white/10'
                  }`}
                  aria-pressed={!isSignup}
                  onClick={() => {
                    setAuthMode('login');
                    setAuthMessage('');
                  }}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 text-xs font-outfit font-bold uppercase tracking-[0.18em] transition-colors ${
                    isSignup ? 'bg-white text-[#1a050d]' : 'text-pink-100 hover:bg-white/10'
                  }`}
                  aria-pressed={isSignup}
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthMessage('');
                  }}
                >
                  Signup
                </button>
              </div>

              {isSignup ? (
                <form className="grid gap-4 text-left" onSubmit={handleSignup}>
                  <label className="grid gap-2 text-xs font-outfit font-bold uppercase tracking-[0.18em] text-pink-200/75">
                    Name
                    <input
                      className="w-full p-4 bg-white/5 border border-white/10 text-[#fff0f3] text-sm font-sans normal-case tracking-normal focus:bg-white/10 outline-none transition-all duration-300 rounded-xl placeholder:text-white/25 focus:border-pink-300 focus:ring-2 focus:ring-pink-300/25"
                      type="text"
                      autoComplete="name"
                      value={signupForm.name}
                      onChange={event => setSignupForm(prev => ({ ...prev, name: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="grid gap-2 text-xs font-outfit font-bold uppercase tracking-[0.18em] text-pink-200/75">
                    Email
                    <input
                      className="w-full p-4 bg-white/5 border border-white/10 text-[#fff0f3] text-sm font-sans normal-case tracking-normal focus:bg-white/10 outline-none transition-all duration-300 rounded-xl placeholder:text-white/25 focus:border-pink-300 focus:ring-2 focus:ring-pink-300/25"
                      type="email"
                      autoComplete="email"
                      value={signupForm.email}
                      onChange={event => setSignupForm(prev => ({ ...prev, email: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="grid gap-2 text-xs font-outfit font-bold uppercase tracking-[0.18em] text-pink-200/75">
                    Phone
                    <input
                      className="w-full p-4 bg-white/5 border border-white/10 text-[#fff0f3] text-sm font-sans normal-case tracking-normal focus:bg-white/10 outline-none transition-all duration-300 rounded-xl placeholder:text-white/25 focus:border-pink-300 focus:ring-2 focus:ring-pink-300/25"
                      type="tel"
                      autoComplete="tel"
                      value={signupForm.phone}
                      onChange={event => setSignupForm(prev => ({ ...prev, phone: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="grid gap-2 text-xs font-outfit font-bold uppercase tracking-[0.18em] text-pink-200/75">
                    Password
                    <input
                      className="w-full p-4 bg-white/5 border border-white/10 text-[#fff0f3] text-sm font-sans normal-case tracking-normal focus:bg-white/10 outline-none transition-all duration-300 rounded-xl placeholder:text-white/25 focus:border-pink-300 focus:ring-2 focus:ring-pink-300/25"
                      type="password"
                      autoComplete="new-password"
                      value={signupForm.password}
                      onChange={event => setSignupForm(prev => ({ ...prev, password: event.target.value }))}
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    className="w-full mt-2 px-9 py-3.5 bg-white text-[#1a050d] rounded-full text-xs uppercase tracking-[0.2em] font-outfit font-bold shadow-[0_10px_30px_rgba(255,255,255,0.08)] hover:shadow-[0_10px_35px_rgba(255,77,109,0.3)] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-200"
                    disabled={authStatus === 'loading'}
                  >
                    {authStatus === 'loading' ? 'Creating...' : 'Create account'}
                  </button>
                </form>
              ) : (
                <form className="grid gap-4 text-left" onSubmit={handleLogin}>
                  <label className="grid gap-2 text-xs font-outfit font-bold uppercase tracking-[0.18em] text-pink-200/75">
                    Email
                    <input
                      className="w-full p-4 bg-white/5 border border-white/10 text-[#fff0f3] text-sm font-sans normal-case tracking-normal focus:bg-white/10 outline-none transition-all duration-300 rounded-xl placeholder:text-white/25 focus:border-pink-300 focus:ring-2 focus:ring-pink-300/25"
                      type="email"
                      autoComplete="email"
                      value={loginForm.email}
                      onChange={event => setLoginForm(prev => ({ ...prev, email: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="grid gap-2 text-xs font-outfit font-bold uppercase tracking-[0.18em] text-pink-200/75">
                    Password
                    <input
                      className="w-full p-4 bg-white/5 border border-white/10 text-[#fff0f3] text-sm font-sans normal-case tracking-normal focus:bg-white/10 outline-none transition-all duration-300 rounded-xl placeholder:text-white/25 focus:border-pink-300 focus:ring-2 focus:ring-pink-300/25"
                      type="password"
                      autoComplete="current-password"
                      value={loginForm.password}
                      onChange={event => setLoginForm(prev => ({ ...prev, password: event.target.value }))}
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    className="w-full mt-2 px-9 py-3.5 bg-white text-[#1a050d] rounded-full text-xs uppercase tracking-[0.2em] font-outfit font-bold shadow-[0_10px_30px_rgba(255,255,255,0.08)] hover:shadow-[0_10px_35px_rgba(255,77,109,0.3)] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-200"
                    disabled={authStatus === 'loading'}
                  >
                    {authStatus === 'loading' ? 'Logging in...' : 'Login'}
                  </button>
                </form>
              )}

              {authMessage && (
                <p className="mt-5 rounded-xl border border-pink-200/20 bg-white/5 px-4 py-3 text-center text-sm text-pink-100" role="status" aria-live="polite">
                  {authMessage}
                </p>
              )}
            </div>
          </motion.section>
        </main>

        <footer className="relative z-10 w-full text-center text-[10px] text-pink-300/30 font-sans pb-6 select-none pointer-events-none uppercase tracking-widest font-bold">
          Copyright © 2026 Bhavish. All Rights Reserved.
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a050d] text-[#fff0f3] selection:bg-pink-400/30 selection:text-white overflow-x-hidden relative font-sans">
      <audio ref={audioRef} id="bgm" src={MUSIC_SRC} loop preload="auto" />
      <BackgroundHearts />
      <RomanticParticleCanvas />
      {isComplete && <HeartRain />}

      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,77,109,0.16),transparent_34%),linear-gradient(180deg,#1a050d_0%,#2c0b17_48%,#110208_100%)]" />
        <div className="absolute inset-0 opacity-[0.05] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />
        {petals.map(p => (
          <span
            key={p.id}
            className="petal"
            style={{
              left: `${p.left}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              width: `${p.size}px`,
              height: `${p.size}px`
            }}
          />
        ))}
      </div>

      <button
        className="fixed bottom-4 right-4 z-50 px-4 py-2 rounded-full border border-white/15 bg-white/5 backdrop-blur-md flex items-center gap-2 text-xs font-sans font-semibold text-[#fff0f3] opacity-80 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-200 transition-opacity cursor-pointer shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
        type="button"
        aria-label={musicOn ? 'Turn background music off' : 'Turn background music on'}
        aria-pressed={musicOn}
        onClick={toggleMusic}
      >
        <span>{musicOn ? 'Music On' : 'Music Off'}</span>
      </button>

      {musicError && (
        <p className="fixed bottom-16 right-4 z-50 max-w-[260px] rounded-xl border border-pink-200/20 bg-[#1a050d]/85 px-4 py-3 text-xs text-pink-100 shadow-xl backdrop-blur-md">
          {musicError}
        </p>
      )}

      <LoveHeader
        currentQuestion={progressStep}
        totalQuestions={STEPS.length}
        isGlowing={isPBarGlowing}
        isPulsing={isPBarPulsing}
      />

      <main className="relative z-10 min-h-screen w-full max-w-xl mx-auto px-4 pt-36 pb-16 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {!isComplete ? (
            <motion.section
              key={currentStep.id}
              className="w-full rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 sm:p-8 shadow-[0_15px_45px_rgba(0,0,0,0.5)] text-center relative overflow-hidden"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -18, scale: 0.98 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            >
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_0%,rgba(255,133,161,0.16),transparent_28%),radial-gradient(circle_at_80%_100%,rgba(255,214,231,0.08),transparent_30%)]" />

              <div className="relative">
                <p className="font-outfit uppercase tracking-[0.32em] text-[10px] text-pink-300/65 font-bold mb-4">
                  Step {String(stepIndex + 1).padStart(2, '0')} of {STEPS.length}
                </p>

                <h1 className="font-display font-light italic text-3xl sm:text-4xl leading-tight tracking-tight mb-4">
                  {currentStep.title}
                </h1>

                <p className="text-sm sm:text-base leading-relaxed text-pink-100/82 max-w-md mx-auto mb-7">
                  {currentStep.note}
                </p>

                {currentStep.kind === 'textarea' && (
                  <textarea
                    ref={typing.ref}
                    onInput={typing.handleInput}
                    className="w-full min-h-[132px] p-4 bg-white/5 border border-white/10 text-[#fff0f3] text-sm focus:bg-white/10 outline-none resize-none transition-all duration-300 rounded-xl placeholder:text-white/25 focus:border-pink-300 focus:ring-2 focus:ring-pink-300/25 mb-6"
                    placeholder={currentStep.placeholder}
                    value={answers[currentStep.id] || ''}
                    onChange={event => setAnswers(prev => ({ ...prev, [currentStep.id]: event.target.value }))}
                  />
                )}

                <div className="relative min-h-[118px] flex items-center justify-center">
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
                    <motion.button
                      type="button"
                      className="w-full sm:w-auto min-w-[210px] px-9 py-3.5 bg-white text-[#1a050d] rounded-full text-xs uppercase tracking-[0.2em] font-outfit font-bold shadow-[0_10px_30px_rgba(255,255,255,0.08)] hover:shadow-[0_10px_35px_rgba(255,77,109,0.3)] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-200"
                      disabled={isActionDisabled}
                      animate={{ x: buttonOffset.x, y: buttonOffset.y }}
                      transition={{ duration: 0.75, ease: 'easeInOut' }}
                      whileTap={{ scale: 0.96 }}
                      onClick={moveForward}
                    >
                      {submitStatus === 'sending'
                        ? 'Sending...'
                        : currentClicks > 0
                          ? `${currentStep.actionLabel} (${remainingClicks} more)`
                          : currentStep.actionLabel}
                    </motion.button>

                    {currentStep.kind === 'choice' && (
                      <motion.button
                        type="button"
                        className="w-full sm:w-auto min-w-[170px] px-8 py-3 rounded-full border border-white/20 bg-white/5 text-white/90 font-sans text-sm cursor-pointer hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-200"
                        animate={{ x: noOffset.x, y: noOffset.y }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        onMouseEnter={moveNoButton}
                        onMouseMove={moveNoButton}
                        onFocus={moveNoButton}
                        onTouchStart={moveNoButton}
                        onClick={blockNoClick}
                      >
                        No
                      </motion.button>
                    )}
                  </div>
                </div>

                {submitStatus === 'error' && (
                  <p className="mt-3 text-xs text-rose-200">
                    I could not send the note right now. Please try the submit button again.
                  </p>
                )}
              </div>
            </motion.section>
          ) : (
            <motion.section
              key="thank-you"
              className="w-full rounded-2xl bg-gradient-to-br from-[#2c0b17] to-[#1a050d] border border-white/10 p-7 sm:p-9 text-center shadow-[0_15px_45px_rgba(0,0,0,0.5)] relative overflow-hidden"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.6 }}
            >
              <div className="absolute inset-0 pointer-events-none opacity-50">
                <div className="absolute top-[18%] left-[12%] w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                <div className="absolute top-[62%] right-[15%] w-1.5 h-1.5 bg-pink-200 rounded-full animate-ping" />
                <div className="absolute bottom-[18%] left-[42%] w-1 h-1 bg-white rounded-full animate-pulse" />
              </div>

              <motion.div
                className="relative text-4xl sm:text-5xl mb-6 inline-block"
                animate={{ scale: [1, 1.16, 1], rotate: [0, -4, 4, 0] }}
                transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
              >
                ❤️
              </motion.div>

              <div className="relative max-w-md mx-auto">
                <p className="font-outfit uppercase tracking-[0.32em] text-[10px] text-pink-300/65 font-bold mb-4">
                  Thank you letter
                </p>
                <h2 className="font-display font-light italic text-3xl sm:text-4xl mb-5 tracking-tight">
                  Thank you, my love
                </h2>

                <div className="space-y-4 text-sm sm:text-base leading-relaxed text-pink-100/90">
                  <p>
                    Thank you for giving this little moment your time, your patience, and a piece of your heart.
                  </p>
                  <p>
                    I will keep loving you softly, listening to you carefully, and choosing us with honesty every day.
                  </p>
                  <p className="font-display italic text-xl text-[#ffb3c1] pt-2">
                    You are precious to me, always.
                  </p>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="relative z-10 w-full text-center text-[10px] text-pink-300/30 font-sans pb-6 select-none pointer-events-none uppercase tracking-widest font-bold">
        Copyright © 2026 Bhavish. All Rights Reserved.
      </footer>
    </div>
  );
}
