import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LoveHeader } from './components/LoveHeader';
import { BackgroundHearts } from './components/BackgroundHearts';
import { HeartRain } from './components/HeartRain';
import { RomanticParticleCanvas, useRomanticTyping } from './components/CaretParticles';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config/supabase';

const FORM_ENDPOINT = 'https://formspree.io/f/xnjkpozb';
const N8N_SIGNUP_WEBHOOK_URL = 'https://bhavishai.app.n8n.cloud/webhook/website-signup';
const MUSIC_SRC = '/assets/music.mp3';
const REQUIRED_CLICKS = 3;
const AUTH_STORAGE_KEY = 'nikita-supabase-session';

type StepKind = 'choice' | 'textarea';
type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';
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
      'Something slipped just now. Please try again in a moment.';
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

interface ProfileRow {
  plan: 'free' | 'basic' | 'premium';
  plan_status: 'active' | 'inactive';
  manual_access: boolean;
  role: 'user' | 'admin';
  plan_expires_at: string | null;
}

async function fetchProfile(userId: string, accessToken: string): Promise<ProfileRow | null> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=plan,plan_status,manual_access,role,plan_expires_at`,
    {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) return null;

  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

// Decides the plan label to show, in priority order: admin > manual
// access > an active, non-expired paid plan > free.
function getPlanLabel(profile: ProfileRow | null): string {
  if (!profile) return 'Free Plan';
  if (profile.role === 'admin') return 'Admin Access';
  if (profile.manual_access) return 'Manual Premium Access';

  const isActive = profile.plan_status === 'active';
  const notExpired = !profile.plan_expires_at || new Date(profile.plan_expires_at).getTime() > Date.now();

  if (isActive && notExpired) {
    if (profile.plan === 'premium') return 'Premium Plan';
    if (profile.plan === 'basic') return 'Basic Plan';
  }

  return 'Free Plan';
}

type AccessTier = 'free' | 'basic' | 'premium';

// Same priority order as getPlanLabel: admin and manual access count as premium.
function getAccessTier(profile: ProfileRow | null): AccessTier {
  if (!profile) return 'free';
  if (profile.role === 'admin' || profile.manual_access) return 'premium';

  const isActive = profile.plan_status === 'active';
  const notExpired = !profile.plan_expires_at || new Date(profile.plan_expires_at).getTime() > Date.now();

  if (isActive && notExpired) {
    if (profile.plan === 'premium') return 'premium';
    if (profile.plan === 'basic') return 'basic';
  }

  return 'free';
}

// Placeholder usage numbers for the drawer UI only — real usage tracking is
// not built yet, so nothing here is read from or written to Supabase.
const USAGE_BY_TIER: Record<AccessTier, { sites: string; edits: string; limit: string }> = {
  free: { sites: '0 / 1', edits: '0 / 5', limit: '1 site · 5 edits' },
  basic: { sites: '0 / 5', edits: '0 / 50', limit: '5 sites · 50 edits' },
  premium: { sites: 'Unlimited', edits: 'Unlimited', limit: 'Unlimited' }
};

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
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [resetAccessToken, setResetAccessToken] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [clockLabel, setClockLabel] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);
  const typing = useRomanticTyping<HTMLTextAreaElement>();

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    if (params.get('type') === 'recovery' && params.get('access_token')) {
      setResetAccessToken(params.get('access_token')!);
      setAuthMode('reset');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!isDashboardPage) return;

    try {
      const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
      const session = raw ? JSON.parse(raw) : null;
      const accessToken = session?.access_token;
      const userId = session?.user?.id;

      if (accessToken && userId) {
        fetchProfile(userId, accessToken).then(setProfile);
      }
    } catch {
      // The plan label just won't show if this fails; the dashboard itself is unaffected.
    }
  }, [isDashboardPage]);

  useEffect(() => {
    if (!menuOpen) return;

    const updateClock = () =>
      setClockLabel(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    updateClock();
    const intervalId = window.setInterval(updateClock, 30000);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // Redirecting still works; the dashboard guard fails closed either way.
    }
    window.location.replace('index.html');
  };

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
      setAuthMessage('Please fill in a few details to continue.');
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

      // When email confirmation is enabled, Supabase returns 200 for an
      // already-registered email but with an empty identities array.
      const identities = signupResult?.identities ?? signupResult?.user?.identities;
      if (Array.isArray(identities) && identities.length === 0) {
        setAuthMessage('This email already has a space here. Please sign in instead.');
        return;
      }

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
      setAuthMessage('Your space is ready. Please sign in.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/already\s*(registered|exists)|user_already_exists|email_exists/i.test(message)) {
        setAuthMessage('This email already has a space here. Please sign in instead.');
      } else {
        setAuthMessage(message || 'That didn’t go through. Please try again in a moment.');
      }
    } finally {
      setAuthStatus('idle');
    }
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthMessage('');

    const email = loginForm.email.trim();

    if (!email || !loginForm.password) {
      setAuthMessage('Please add your email and password to continue.');
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
      setAuthMessage(error instanceof Error ? error.message : 'That didn’t quite work. Please try again softly.');
      setAuthStatus('idle');
    }
  };

  const handleForgotPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthMessage('');

    const email = forgotEmail.trim();
    if (!email) {
      setAuthMessage('Please share your email first.');
      return;
    }

    setAuthStatus('loading');

    try {
      await supabaseAuthRequest('recover', { email });
    } catch {
      // Intentionally swallowed — show the same message regardless.
    } finally {
      setAuthStatus('idle');
      setAuthMessage('If this email has a space with us, a reset link is on its way. 💌');
    }
  };

  const handleResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthMessage('');

    if (!resetPassword || resetPassword.length < 6) {
      setAuthMessage('A little longer, please — at least 6 characters.');
      return;
    }

    setAuthStatus('loading');

    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${resetAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: resetPassword })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.msg || data?.message || data?.error_description || 'That didn’t go through. Please try again in a moment.');
      }

      setResetPassword('');
      setResetAccessToken('');
      setAuthMode('login');
      setAuthMessage('Your new password is saved. Please sign in.');
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'That didn’t go through. Please try again in a moment.');
    } finally {
      setAuthStatus('idle');
    }
  };

  const isActionDisabled =
    submitStatus === 'sending' ||
    (currentStep.kind === 'textarea' && !(answers[currentStep.id] || '').trim());

  const accessTier = getAccessTier(profile);
  const usage = USAGE_BY_TIER[accessTier];

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

        <main className="relative z-10 min-h-screen w-full max-w-xl mx-auto px-4 py-20 flex items-center justify-center">
          <motion.section
            className="w-full rounded-[28px] bg-white/5 backdrop-blur-xl border border-white/10 p-8 sm:p-10 shadow-[0_15px_45px_rgba(0,0,0,0.5)] text-center relative overflow-hidden"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_0%,rgba(255,133,161,0.16),transparent_28%),radial-gradient(circle_at_80%_100%,rgba(255,214,231,0.08),transparent_30%)]" />

            <div className="relative">
              <p className="font-outfit uppercase tracking-[0.32em] text-[10px] text-pink-300/65 font-bold mb-5">
                Your private little space
              </p>
              <h1 className="font-display font-light italic text-3xl sm:text-4xl leading-tight tracking-tight mb-3">
                {authMode === 'forgot' ? "Let's find your way back" : authMode === 'reset' ? 'Choose a new password' : isSignup ? 'Create your little space' : 'Welcome back'}
              </h1>
              <p className="font-display italic text-sm text-pink-200/70 mb-5">
                A calm space for two hearts
              </p>
              <p className="text-sm sm:text-base leading-relaxed text-pink-100/82 max-w-md mx-auto mb-8">
                {authMode === 'forgot'
                  ? "Share your email and we'll send a gentle link to reset it."
                  : authMode === 'reset'
                    ? 'Choose a new password to keep your space safe.'
                    : isSignup
                      ? "Make a little space of your own, then sign in whenever you're ready."
                      : 'Sign in softly to step back into your space.'}
              </p>

              {(authMode === 'login' || authMode === 'signup') && (
                <div className="grid grid-cols-2 gap-2 rounded-full border border-white/10 bg-white/5 p-1.5 mb-8">
                  <button
                    type="button"
                    className={`rounded-full px-4 py-2 text-xs font-outfit font-bold uppercase tracking-[0.18em] transition-all duration-300 ease-out ${
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
                    className={`rounded-full px-4 py-2 text-xs font-outfit font-bold uppercase tracking-[0.18em] transition-all duration-300 ease-out ${
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
              )}

              {isSignup ? (
                <form className="grid gap-5 text-left" onSubmit={handleSignup}>
                  <label className="grid gap-2.5 text-xs font-outfit font-bold uppercase tracking-[0.18em] text-pink-200/75">
                    Name
                    <input
                      className="w-full p-4 bg-white/5 border border-white/10 text-[#fff0f3] text-sm font-sans normal-case tracking-normal focus:bg-white/10 outline-none transition-all duration-300 ease-out rounded-2xl placeholder:text-white/25 hover:border-pink-300/50 focus:border-pink-300 focus:ring-2 focus:ring-pink-300/25"
                      type="text"
                      autoComplete="name"
                      value={signupForm.name}
                      onChange={event => setSignupForm(prev => ({ ...prev, name: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="grid gap-2.5 text-xs font-outfit font-bold uppercase tracking-[0.18em] text-pink-200/75">
                    Email
                    <input
                      className="w-full p-4 bg-white/5 border border-white/10 text-[#fff0f3] text-sm font-sans normal-case tracking-normal focus:bg-white/10 outline-none transition-all duration-300 ease-out rounded-2xl placeholder:text-white/25 hover:border-pink-300/50 focus:border-pink-300 focus:ring-2 focus:ring-pink-300/25"
                      type="email"
                      autoComplete="email"
                      value={signupForm.email}
                      onChange={event => setSignupForm(prev => ({ ...prev, email: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="grid gap-2.5 text-xs font-outfit font-bold uppercase tracking-[0.18em] text-pink-200/75">
                    Phone
                    <input
                      className="w-full p-4 bg-white/5 border border-white/10 text-[#fff0f3] text-sm font-sans normal-case tracking-normal focus:bg-white/10 outline-none transition-all duration-300 ease-out rounded-2xl placeholder:text-white/25 hover:border-pink-300/50 focus:border-pink-300 focus:ring-2 focus:ring-pink-300/25"
                      type="tel"
                      autoComplete="tel"
                      value={signupForm.phone}
                      onChange={event => setSignupForm(prev => ({ ...prev, phone: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="grid gap-2.5 text-xs font-outfit font-bold uppercase tracking-[0.18em] text-pink-200/75">
                    Password
                    <input
                      className="w-full p-4 bg-white/5 border border-white/10 text-[#fff0f3] text-sm font-sans normal-case tracking-normal focus:bg-white/10 outline-none transition-all duration-300 ease-out rounded-2xl placeholder:text-white/25 hover:border-pink-300/50 focus:border-pink-300 focus:ring-2 focus:ring-pink-300/25"
                      type="password"
                      autoComplete="new-password"
                      value={signupForm.password}
                      onChange={event => setSignupForm(prev => ({ ...prev, password: event.target.value }))}
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    className="w-full mt-3 px-9 py-3.5 bg-white text-[#1a050d] rounded-full text-xs uppercase tracking-[0.2em] font-outfit font-bold shadow-[0_10px_30px_rgba(255,255,255,0.08)] hover:shadow-[0_10px_35px_rgba(255,77,109,0.3)] transition-all duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-200"
                    disabled={authStatus === 'loading'}
                  >
                    {authStatus === 'loading' ? 'Creating your space…' : 'Create my space'}
                  </button>
                </form>
              ) : authMode === 'login' ? (
                <form className="grid gap-5 text-left" onSubmit={handleLogin}>
                  <label className="grid gap-2.5 text-xs font-outfit font-bold uppercase tracking-[0.18em] text-pink-200/75">
                    Email
                    <input
                      className="w-full p-4 bg-white/5 border border-white/10 text-[#fff0f3] text-sm font-sans normal-case tracking-normal focus:bg-white/10 outline-none transition-all duration-300 ease-out rounded-2xl placeholder:text-white/25 hover:border-pink-300/50 focus:border-pink-300 focus:ring-2 focus:ring-pink-300/25"
                      type="email"
                      autoComplete="email"
                      value={loginForm.email}
                      onChange={event => setLoginForm(prev => ({ ...prev, email: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="grid gap-2.5 text-xs font-outfit font-bold uppercase tracking-[0.18em] text-pink-200/75">
                    Password
                    <input
                      className="w-full p-4 bg-white/5 border border-white/10 text-[#fff0f3] text-sm font-sans normal-case tracking-normal focus:bg-white/10 outline-none transition-all duration-300 ease-out rounded-2xl placeholder:text-white/25 hover:border-pink-300/50 focus:border-pink-300 focus:ring-2 focus:ring-pink-300/25"
                      type="password"
                      autoComplete="current-password"
                      value={loginForm.password}
                      onChange={event => setLoginForm(prev => ({ ...prev, password: event.target.value }))}
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    className="w-full mt-3 px-9 py-3.5 bg-white text-[#1a050d] rounded-full text-xs uppercase tracking-[0.2em] font-outfit font-bold shadow-[0_10px_30px_rgba(255,255,255,0.08)] hover:shadow-[0_10px_35px_rgba(255,77,109,0.3)] transition-all duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-200"
                    disabled={authStatus === 'loading'}
                  >
                    {authStatus === 'loading' ? 'Opening…' : 'Step inside'}
                  </button>
                  <button
                    type="button"
                    className="mt-2 text-xs text-pink-200/60 hover:text-pink-100 transition-colors duration-300 ease-out cursor-pointer text-center"
                    onClick={() => { setAuthMode('forgot'); setAuthMessage(''); }}
                  >
                    Forgot your password? It happens 💌
                  </button>
                </form>
              ) : authMode === 'forgot' ? (
                <form className="grid gap-5 text-left" onSubmit={handleForgotPassword}>
                  <label className="grid gap-2.5 text-xs font-outfit font-bold uppercase tracking-[0.18em] text-pink-200/75">
                    Email
                    <input
                      className="w-full p-4 bg-white/5 border border-white/10 text-[#fff0f3] text-sm font-sans normal-case tracking-normal focus:bg-white/10 outline-none transition-all duration-300 ease-out rounded-2xl placeholder:text-white/25 hover:border-pink-300/50 focus:border-pink-300 focus:ring-2 focus:ring-pink-300/25"
                      type="email"
                      autoComplete="email"
                      value={forgotEmail}
                      onChange={event => setForgotEmail(event.target.value)}
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    className="w-full mt-3 px-9 py-3.5 bg-white text-[#1a050d] rounded-full text-xs uppercase tracking-[0.2em] font-outfit font-bold shadow-[0_10px_30px_rgba(255,255,255,0.08)] hover:shadow-[0_10px_35px_rgba(255,77,109,0.3)] transition-all duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-200"
                    disabled={authStatus === 'loading'}
                  >
                    {authStatus === 'loading' ? 'Sending…' : 'Send my reset link'}
                  </button>
                  <button
                    type="button"
                    className="mt-2 text-xs text-pink-200/60 hover:text-pink-100 transition-colors duration-300 ease-out cursor-pointer text-center"
                    onClick={() => { setAuthMode('login'); setAuthMessage(''); }}
                  >
                    Back to sign in
                  </button>
                </form>
              ) : authMode === 'reset' ? (
                <form className="grid gap-5 text-left" onSubmit={handleResetPassword}>
                  <label className="grid gap-2.5 text-xs font-outfit font-bold uppercase tracking-[0.18em] text-pink-200/75">
                    New Password
                    <input
                      className="w-full p-4 bg-white/5 border border-white/10 text-[#fff0f3] text-sm font-sans normal-case tracking-normal focus:bg-white/10 outline-none transition-all duration-300 ease-out rounded-2xl placeholder:text-white/25 hover:border-pink-300/50 focus:border-pink-300 focus:ring-2 focus:ring-pink-300/25"
                      type="password"
                      autoComplete="new-password"
                      value={resetPassword}
                      onChange={event => setResetPassword(event.target.value)}
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    className="w-full mt-3 px-9 py-3.5 bg-white text-[#1a050d] rounded-full text-xs uppercase tracking-[0.2em] font-outfit font-bold shadow-[0_10px_30px_rgba(255,255,255,0.08)] hover:shadow-[0_10px_35px_rgba(255,77,109,0.3)] transition-all duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-200"
                    disabled={authStatus === 'loading'}
                  >
                    {authStatus === 'loading' ? 'Saving…' : 'Save new password'}
                  </button>
                </form>
              ) : null}

              {authMessage && (
                <p className="mt-6 rounded-2xl border border-pink-200/20 bg-white/5 px-5 py-3.5 text-center text-sm text-pink-100" role="status" aria-live="polite">
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
        className="fixed bottom-4 right-4 z-50 px-5 py-2.5 rounded-full border border-white/15 bg-white/5 backdrop-blur-md flex items-center gap-2 text-xs font-sans font-semibold text-[#fff0f3] opacity-80 hover:opacity-100 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-200 transition-all duration-300 ease-out cursor-pointer shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
        type="button"
        aria-label={musicOn ? 'Turn background music off' : 'Turn background music on'}
        aria-pressed={musicOn}
        onClick={toggleMusic}
      >
        <span>{musicOn ? 'Music On' : 'Music Off'}</span>
      </button>

      {musicError && (
        <p className="fixed bottom-16 right-4 z-50 max-w-[260px] rounded-2xl border border-pink-200/20 bg-[#1a050d]/85 px-5 py-3.5 text-xs text-pink-100 shadow-xl backdrop-blur-md">
          {musicError}
        </p>
      )}

      <button
        type="button"
        className="fixed left-4 top-28 sm:top-4 z-[60] flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-full border border-white/15 bg-white/5 backdrop-blur-md opacity-80 hover:opacity-100 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-200 transition-all duration-300 ease-out cursor-pointer shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
        aria-label="Open account menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(true)}
      >
        <span className="block h-[2px] w-4 rounded-full bg-[#fff0f3]" />
        <span className="block h-[2px] w-4 rounded-full bg-[#fff0f3]" />
        <span className="block h-[2px] w-4 rounded-full bg-[#fff0f3]" />
      </button>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              key="drawer-backdrop"
              className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.aside
              key="drawer"
              className="fixed left-0 top-0 z-[80] flex h-full w-[85%] max-w-sm flex-col overflow-y-auto rounded-r-[28px] border-r border-white/10 bg-gradient-to-b from-[#2c0b17] to-[#1a050d] p-7 shadow-[0_15px_45px_rgba(0,0,0,0.6)] backdrop-blur-xl"
              role="dialog"
              aria-label="Account menu"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <div className="mb-7 flex items-center justify-between">
                <p className="font-outfit uppercase tracking-[0.32em] text-[10px] text-pink-300/65 font-bold">
                  Your Account
                </p>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm text-pink-100 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-200 transition-colors duration-300 ease-out cursor-pointer"
                  aria-label="Close account menu"
                  onClick={() => setMenuOpen(false)}
                >
                  ✕
                </button>
              </div>

              <span className="mb-8 inline-flex w-fit items-center gap-2 rounded-full border border-pink-200/25 bg-white/5 px-4 py-1.5 text-xs font-outfit font-semibold tracking-wide text-pink-100 shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
                {getPlanLabel(profile)}
              </span>

              <div className="mb-8">
                <p className="mb-3 font-outfit uppercase tracking-[0.24em] text-[10px] text-pink-300/65 font-bold">
                  Usage
                </p>
                <div className="grid gap-2.5 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-pink-100/85">
                  <div className="flex items-center justify-between gap-4">
                    <span>Sites Created</span>
                    <span className="font-semibold text-[#fff0f3]">{usage.sites}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Edits Used</span>
                    <span className="font-semibold text-[#fff0f3]">{usage.edits}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Usage Limit</span>
                    <span className="font-semibold text-[#fff0f3]">{usage.limit}</span>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <p className="mb-3 font-outfit uppercase tracking-[0.24em] text-[10px] text-pink-300/65 font-bold">
                  Upgrade
                </p>
                {accessTier === 'premium' ? (
                  <p className="rounded-2xl border border-pink-200/20 bg-white/5 px-5 py-3.5 text-sm text-pink-100">
                    You already have premium access ✨
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {accessTier === 'free' && (
                      <button
                        type="button"
                        disabled
                        className="w-full rounded-full border border-white/20 bg-white/5 px-8 py-3 text-xs font-outfit font-bold uppercase tracking-[0.18em] text-pink-100/70 cursor-not-allowed"
                      >
                        Upgrade to Basic · Coming soon
                      </button>
                    )}
                    <button
                      type="button"
                      disabled
                      className="w-full rounded-full bg-white/90 px-8 py-3 text-xs font-outfit font-bold uppercase tracking-[0.18em] text-[#1a050d] opacity-60 cursor-not-allowed"
                    >
                      Upgrade to Premium · Coming soon
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-auto grid gap-4 border-t border-white/10 pt-6">
                <p className="text-xs text-pink-200/60">
                  Session active · {clockLabel}
                </p>
                <button
                  type="button"
                  className="w-full rounded-full border border-pink-300/40 bg-white/5 px-8 py-3 text-xs font-outfit font-bold uppercase tracking-[0.18em] text-pink-100 hover:bg-pink-300/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-200 transition-colors duration-300 ease-out cursor-pointer"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <LoveHeader
        currentQuestion={progressStep}
        totalQuestions={STEPS.length}
        isGlowing={isPBarGlowing}
        isPulsing={isPBarPulsing}
      />

      <main className="relative z-10 min-h-screen w-full max-w-xl mx-auto px-4 pt-36 pb-20 flex flex-col items-center justify-center gap-4">
        {profile && (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-4 py-1.5 text-xs font-outfit font-semibold tracking-wide text-pink-100 shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
            Your Plan: {getPlanLabel(profile)}
          </span>
        )}
        <AnimatePresence mode="wait">
          {!isComplete ? (
            <motion.section
              key={currentStep.id}
              className="w-full rounded-[28px] bg-white/5 backdrop-blur-xl border border-white/10 p-8 sm:p-10 shadow-[0_15px_45px_rgba(0,0,0,0.5)] text-center relative overflow-hidden"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -18, scale: 0.98 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            >
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_0%,rgba(255,133,161,0.16),transparent_28%),radial-gradient(circle_at_80%_100%,rgba(255,214,231,0.08),transparent_30%)]" />

              <div className="relative">
                <p className="font-outfit uppercase tracking-[0.32em] text-[10px] text-pink-300/65 font-bold mb-5">
                  Step {String(stepIndex + 1).padStart(2, '0')} of {STEPS.length}
                </p>

                <h1 className="font-display font-light italic text-3xl sm:text-4xl leading-tight tracking-tight mb-5">
                  {currentStep.title}
                </h1>

                <p className="text-sm sm:text-base leading-relaxed text-pink-100/82 max-w-md mx-auto mb-8">
                  {currentStep.note}
                </p>

                {currentStep.kind === 'textarea' && (
                  <textarea
                    ref={typing.ref}
                    onInput={typing.handleInput}
                    className="w-full min-h-[132px] p-4 bg-white/5 border border-white/10 text-[#fff0f3] text-sm focus:bg-white/10 outline-none resize-none transition-all duration-300 ease-out rounded-2xl placeholder:text-white/25 hover:border-pink-300/50 focus:border-pink-300 focus:ring-2 focus:ring-pink-300/25 mb-8"
                    placeholder={currentStep.placeholder}
                    value={answers[currentStep.id] || ''}
                    onChange={event => setAnswers(prev => ({ ...prev, [currentStep.id]: event.target.value }))}
                  />
                )}

                <div className="relative min-h-[118px] flex items-center justify-center">
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-5 w-full">
                    <motion.button
                      type="button"
                      className="w-full sm:w-auto min-w-[210px] px-9 py-3.5 bg-white text-[#1a050d] rounded-full text-xs uppercase tracking-[0.2em] font-outfit font-bold shadow-[0_10px_30px_rgba(255,255,255,0.08)] hover:shadow-[0_10px_35px_rgba(255,77,109,0.3)] transition-shadow duration-300 ease-out cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-200"
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
                        className="w-full sm:w-auto min-w-[170px] px-8 py-3.5 rounded-full border border-white/20 bg-white/5 text-white/90 font-sans text-sm cursor-pointer hover:bg-white/10 transition-colors duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-200"
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
                  <p className="mt-4 text-xs text-rose-200">
                    I could not send the note right now. Please try the submit button again.
                  </p>
                )}
              </div>
            </motion.section>
          ) : (
            <motion.section
              key="thank-you"
              className="w-full rounded-[28px] bg-gradient-to-br from-[#2c0b17] to-[#1a050d] border border-white/10 p-8 sm:p-10 text-center shadow-[0_15px_45px_rgba(0,0,0,0.5)] relative overflow-hidden"
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
                className="relative text-4xl sm:text-5xl mb-7 inline-block"
                animate={{ scale: [1, 1.16, 1], rotate: [0, -4, 4, 0] }}
                transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
              >
                ❤️
              </motion.div>

              <div className="relative max-w-md mx-auto">
                <p className="font-outfit uppercase tracking-[0.32em] text-[10px] text-pink-300/65 font-bold mb-5">
                  Thank you letter
                </p>
                <h2 className="font-display font-light italic text-3xl sm:text-4xl mb-6 tracking-tight">
                  Thank you, my love
                </h2>

                <div className="space-y-5 text-sm sm:text-base leading-relaxed text-pink-100/90">
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
