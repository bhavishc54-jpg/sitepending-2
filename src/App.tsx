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

interface LoveJourneyState {
  stepIndex: number;
  answers: Record<string, string>;
  isComplete: boolean;
  siteId: string | null;
  userId: string | null;
  // Whether the Formspree email has already been sent for this specific
  // siteId. Always written in the same localStorage blob as siteId, so the
  // two can never drift apart — there is only ever one saved journey per
  // user, and a fresh siteId is always saved together with
  // formspreeSent: false.
  formspreeSent: boolean;
}

// Writes the Love Journey progress straight to localStorage, synchronously,
// independent of React's render/effect cycle. Used right after a successful
// create_draft_site call so a refresh or browser close in the moment between
// "Supabase created the site" and "Formspree was notified" can never lose
// the new site_id and cause a second site to be created on retry.
function saveJourneyState(state: LoveJourneyState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The website should keep working even when localStorage is blocked.
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

function readAuthSession(): { accessToken: string; userId: string } | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    const session = raw ? JSON.parse(raw) : null;
    const accessToken = session?.access_token;
    const userId = session?.user?.id;
    return accessToken && userId ? { accessToken, userId } : null;
  } catch {
    return null;
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

// Plan-based limits only. `null` means unlimited. Actual usage (how many the
// user has used so far) comes from public.user_usage, fetched below.
const PLAN_LIMITS: Record<AccessTier, { sites: number | null; edits: number | null }> = {
  free: { sites: 1, edits: 5 },
  basic: { sites: 5, edits: 50 },
  premium: { sites: null, edits: null }
};

interface UsageRow {
  sites_created: number;
  edits_used: number;
  monthly_reset_at: string | null;
}

async function fetchUsage(userId: string, accessToken: string): Promise<UsageRow | null> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/user_usage?user_id=eq.${userId}&select=sites_created,edits_used,monthly_reset_at`,
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

interface CreateDraftSiteResult {
  allowed: boolean;
  reason?: string;
  site_id?: string;
  plan?: string;
  sites_created?: number;
  sites_limit?: number | null;
}

// Calls the secure create_draft_site RPC as the logged-in user (their own
// access token — never the service_role key). The database itself decides
// whether the user is under their plan's site limit and, only if so,
// creates the public.sites row and increments user_usage.sites_created in
// one atomic step. This must only be called once, at final submission.
async function createDraftSite(
  accessToken: string,
  title: string,
  answers: Record<string, string>
): Promise<CreateDraftSiteResult> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_draft_site`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_title: title, p_answers: answers })
  });

  if (!response.ok) {
    throw new Error(`create_draft_site returned ${response.status}`);
  }

  return response.json();
}

interface CompleteSiteResult {
  success: boolean;
  reason?: string;
  site_id?: string;
  status?: string;
  completed_at?: string | null;
}

// Calls the secure complete_site RPC as the logged-in user (their own
// access token — never the service_role key). Marks the caller's own site
// completed; the database side is idempotent, so calling this again after
// a network failure (without re-sending Formspree) is always safe.
async function completeSite(accessToken: string, siteId: string): Promise<CompleteSiteResult> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/complete_site`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_site_id: siteId })
  });

  if (!response.ok) {
    throw new Error(`complete_site returned ${response.status}`);
  }

  return response.json();
}

interface SiteRow {
  id: string;
  title: string | null;
  answers: Record<string, string>;
  status: 'draft' | 'completed' | 'published';
  created_at: string;
  completed_at: string | null;
  published_at: string | null;
}

// Reads only the logged-in user's own saved Love Journeys. This is
// read-only (no INSERT/UPDATE from the frontend) and relies on the
// public.sites RLS policy (auth.uid() = user_id) from Phase 4A as the real
// authority — the user_id filter here is just the same defense-in-depth
// pattern already used by fetchProfile/fetchUsage.
async function fetchSites(userId: string, accessToken: string): Promise<SiteRow[]> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/sites?user_id=eq.${userId}&select=id,title,answers,status,created_at,completed_at,published_at&order=created_at.desc`,
    {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Could not load sites (status ${response.status})`);
  }

  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

interface UpdateLoveSiteResult {
  allowed: boolean;
  reason?: string;
  site_id?: string;
  status?: string;
  plan?: string;
  edits_used?: number;
  edits_limit?: number | null;
}

// Calls the secure update_love_site RPC as the logged-in user (their own
// access token — never the service_role key). Edits the caller's own site
// and increments user_usage.edits_used in the same atomic step, only if
// they are under their plan's edit limit. Must only be called when the
// user explicitly clicks Save Changes in the edit modal — never on open,
// never while typing, never while viewing.
async function updateLoveSite(
  accessToken: string,
  siteId: string,
  title: string,
  answers: Record<string, string>
): Promise<UpdateLoveSiteResult> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_love_site`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_site_id: siteId, p_title: title, p_answers: answers })
  });

  if (!response.ok) {
    throw new Error(`update_love_site returned ${response.status}`);
  }

  return response.json();
}

interface PublishSiteResult {
  success: boolean;
  reason?: string;
  site_id?: string;
  status?: string;
  published_at?: string | null;
}

// Calls the secure publish_love_site RPC as the logged-in user (their own
// access token — never the service_role key). Marks the caller's own
// completed site as published; the database side is idempotent. Must only
// be called when the user explicitly clicks Publish — never while
// viewing, editing, typing, or during the create/complete submission flow.
async function publishSite(accessToken: string, siteId: string): Promise<PublishSiteResult> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/publish_love_site`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_site_id: siteId })
  });

  if (!response.ok) {
    throw new Error(`publish_love_site returned ${response.status}`);
  }

  return response.json();
}

function formatSavedDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function getSiteStatusLabel(status: string): string {
  if (status === 'published') return 'Published';
  if (status === 'completed') return 'Completed';
  return 'Draft';
}

function getSiteStatusBadgeClass(status: string): string {
  if (status === 'published') return 'border-emerald-300/40 bg-emerald-400/10 text-emerald-200';
  if (status === 'completed') return 'border-pink-300/40 bg-pink-400/10 text-pink-100';
  return 'border-white/20 bg-white/5 text-pink-100/70';
}

// Friendlier labels than raw answer keys for the read-only detail view.
const ANSWER_LABELS: Record<string, string> = {
  ready: 'Ready to begin',
  feeling: 'A feeling shared',
  promise: 'A promise made',
  letter: 'Final letter'
};

export default function App() {
  const savedState = useMemo<Record<string, any>>(() => {
    if (typeof window === 'undefined') return {};
    const raw = safeReadState();
    const currentUserId = readAuthSession()?.userId ?? null;
    // Only reuse a saved Love Journey (including its siteId) when it was
    // saved by the account that is currently logged in. Anything saved
    // without a matching userId — a different account, or no account at
    // all — is ignored so one account can never see or reuse another
    // account's browser-local progress or site id.
    return raw.userId && currentUserId && raw.userId === currentUserId ? raw : {};
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
  const [siteId, setSiteId] = useState<string | null>(() => savedState.siteId || null);
  const [formspreeSent, setFormspreeSent] = useState(() => Boolean(savedState.formspreeSent));
  const [limitBlocked, setLimitBlocked] = useState(false);
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
  const [usageRow, setUsageRow] = useState<UsageRow | null>(null);
  const [sites, setSites] = useState<SiteRow[] | null>(null);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [sitesError, setSitesError] = useState(false);
  const [viewingSite, setViewingSite] = useState<SiteRow | null>(null);
  const [editingSite, setEditingSite] = useState<SiteRow | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editFeeling, setEditFeeling] = useState('');
  const [editLetter, setEditLetter] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editLimitReached, setEditLimitReached] = useState(false);
  const [editSuccessNotice, setEditSuccessNotice] = useState('');
  const [editInfoNotice, setEditInfoNotice] = useState('');
  const [publishingSiteId, setPublishingSiteId] = useState<string | null>(null);
  const [publishError, setPublishError] = useState('');
  const [publishSuccessNotice, setPublishSuccessNotice] = useState('');
  const [resetAccessToken, setResetAccessToken] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [clockLabel, setClockLabel] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);
  const isSubmittingRef = useRef(false);
  const isSavingEditRef = useRef(false);
  const isPublishingRef = useRef(false);
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

  // Loads only the current user's own saved Love Journeys for the "My Love
  // Pages" section. Defined before the effect below so it can be called
  // from there, and reused later (after a successful completion) to
  // refresh the list without a full page reload.
  const loadSites = async (session?: { accessToken: string; userId: string } | null) => {
    const activeSession = session ?? readAuthSession();
    if (!activeSession) return;

    setSitesLoading(true);
    setSitesError(false);
    try {
      const rows = await fetchSites(activeSession.userId, activeSession.accessToken);
      setSites(rows);
    } catch (error) {
      console.error('[Sites] Could not load saved Love Pages.', error);
      setSitesError(true);
    } finally {
      setSitesLoading(false);
    }
  };

  // Opens the edit modal pre-filled from the site's already-fetched data —
  // no RPC call here, just populating local form state.
  const openEditSite = (site: SiteRow) => {
    if (site.status === 'published') return;
    setEditingSite(site);
    setEditTitle(site.title || '');
    setEditFeeling(site.answers?.feeling || '');
    setEditLetter(site.answers?.letter || '');
    setEditError('');
    setEditLimitReached(false);
    setEditInfoNotice('');
  };

  // Closing (Cancel or the ✕ button) never calls the RPC either — it just
  // discards the local form state.
  const closeEditSite = () => {
    if (editSaving) return;
    setEditingSite(null);
    setEditError('');
    setEditLimitReached(false);
  };

  const saveEditedSite = async () => {
    // Same synchronous-ref-guard pattern as the main submit flow: state
    // updates are batched/async, so a ref is what actually stops a second
    // click fired in the same tick from sending a second RPC call.
    if (isSavingEditRef.current || !editingSite) return;

    // No-op guard: update_love_site increments edits_used on every allowed
    // call, so if nothing the user can actually change (title, feeling,
    // letter) is different from what the modal was opened with, skip the
    // RPC entirely rather than spend an edit for a save that changes
    // nothing. Compared against the exact values openEditSite pre-filled
    // the form with, not a re-fetch, since editingSite is that same
    // untouched snapshot for as long as the modal has been open.
    const originalTitle = editingSite.title || '';
    const originalFeeling = editingSite.answers?.feeling || '';
    const originalLetter = editingSite.answers?.letter || '';
    const hasChanges =
      editTitle !== originalTitle || editFeeling !== originalFeeling || editLetter !== originalLetter;

    if (!hasChanges) {
      setEditingSite(null);
      setEditError('');
      setEditLimitReached(false);
      setEditInfoNotice('No changes to save.');
      window.setTimeout(() => setEditInfoNotice(''), 4000);
      return;
    }

    isSavingEditRef.current = true;
    setEditSaving(true);
    setEditError('');
    setEditLimitReached(false);
    setEditInfoNotice('');

    try {
      const session = readAuthSession();
      if (!session) {
        setEditError('Please sign in again to save changes.');
        return;
      }

      // Start from the site's full existing answers object (preserving any
      // extra keys it may already contain) and only ever change feeling
      // and letter here. ready/promise are kept if already present, and
      // only default to 'yes' when genuinely missing.
      const existingAnswers = editingSite.answers || {};
      const updatedAnswers = {
        ...existingAnswers,
        ready: existingAnswers.ready || 'yes',
        promise: existingAnswers.promise || 'yes',
        feeling: editFeeling,
        letter: editLetter
      };

      let result: UpdateLoveSiteResult;
      try {
        result = await updateLoveSite(session.accessToken, editingSite.id, editTitle, updatedAnswers);
      } catch (error) {
        console.error('[Site] Could not reach update_love_site.', error);
        setEditError('I could not save your changes right now. Please try again.');
        return;
      }

      if (!result.allowed) {
        if (result.reason === 'edit_limit_reached') {
          setEditLimitReached(true);
          setEditError(`You've reached your ${getPlanLabel(profile)} edit limit. Upgrade to keep making changes to your love pages.`);
        } else if (result.reason === 'site_locked') {
          setEditError('Published pages cannot be edited yet.');
        } else if (result.reason === 'site_not_found') {
          setEditError('This page could not be found for your account.');
        } else if (result.reason === 'invalid_answers') {
          setEditError('Saved answers format is invalid.');
        } else {
          setEditError('That didn’t go through. Please try again in a moment.');
        }
        return;
      }

      // Success — the site was actually saved and counted in Supabase.
      const savedSiteId = editingSite.id;
      setEditingSite(null);
      setEditSuccessNotice('Your changes were saved with love.');
      window.setTimeout(() => setEditSuccessNotice(''), 4000);

      // If the same site is currently open in the read-only View modal,
      // refresh that snapshot too so reopening it doesn't show stale data.
      setViewingSite(prev =>
        prev && prev.id === savedSiteId ? { ...prev, title: editTitle, answers: updatedAnswers } : prev
      );

      loadSites(session);
      fetchUsage(session.userId, session.accessToken).then(setUsageRow);
    } finally {
      setEditSaving(false);
      isSavingEditRef.current = false;
    }
  };

  const publishSavedSite = async (site: SiteRow) => {
    // Only completed sites can ever reach this — the button itself is only
    // rendered for status === 'completed', and the RPC re-checks this
    // authoritatively regardless.
    if (isPublishingRef.current || site.status !== 'completed') return;

    const confirmed = window.confirm(
      'Publish this Love Page? This marks it as published — you can always come back here first.'
    );
    if (!confirmed) return;

    isPublishingRef.current = true;
    setPublishingSiteId(site.id);
    setPublishError('');
    setPublishSuccessNotice('');

    try {
      const session = readAuthSession();
      if (!session) {
        setPublishError('Please sign in again to publish this page.');
        return;
      }

      let result: PublishSiteResult;
      try {
        result = await publishSite(session.accessToken, site.id);
      } catch (error) {
        console.error('[Site] Could not reach publish_love_site.', error);
        setPublishError('I could not publish this page right now. Please try again.');
        return;
      }

      if (!result.success) {
        if (result.reason === 'site_not_completed') {
          setPublishError('Complete this Love Page before publishing.');
        } else if (result.reason === 'site_not_found') {
          setPublishError('This page could not be found for your account.');
        } else {
          setPublishError('That didn’t go through. Please try again in a moment.');
        }
        return;
      }

      // Success — the site is confirmed published in Supabase. No usage
      // change: sites_created/edits_used are never touched by publishing.
      setPublishSuccessNotice('Your Love Page is published.');
      window.setTimeout(() => setPublishSuccessNotice(''), 4000);

      // If the same site is currently open in the read-only View modal,
      // refresh that snapshot too so reopening it doesn't show stale data.
      setViewingSite(prev =>
        prev && prev.id === site.id
          ? { ...prev, status: 'published', published_at: result.published_at ?? prev.published_at }
          : prev
      );

      loadSites(session);
    } finally {
      setPublishingSiteId(null);
      isPublishingRef.current = false;
    }
  };

  useEffect(() => {
    if (!isDashboardPage) return;

    const session = readAuthSession();
    if (!session) return;

    fetchProfile(session.userId, session.accessToken).then(setProfile);
    fetchUsage(session.userId, session.accessToken).then(row => {
      if (!row) {
        console.warn('[Usage] No user_usage row found for this user; showing 0 values.');
      }
      setUsageRow(row);
    });
    loadSites(session);
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
    saveJourneyState({
      stepIndex,
      answers,
      isComplete,
      siteId,
      userId: readAuthSession()?.userId ?? null,
      formspreeSent
    });
  }, [stepIndex, answers, isComplete, siteId, formspreeSent]);

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
    // Synchronous guard against double-clicks/duplicate calls: React state
    // updates below are batched/async, so two click events fired in the
    // same tick could otherwise both slip past a state-based check. A ref
    // updates immediately, so the second call sees isSubmittingRef.current
    // already true and bails out before doing anything.
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSubmitStatus('sending');

    try {
      const session = readAuthSession();
      if (!session) {
        console.error('[Site] No active session; cannot save this Love Journey.');
        setSubmitStatus('error');
        return;
      }

      // A site was already created in an earlier attempt (e.g. Supabase
      // succeeded but a later step failed, and the user hit submit again,
      // or the page was refreshed). Skip create_draft_site entirely — it
      // must only ever run once per completed Love Journey.
      let currentSiteId = siteId;
      let alreadySentFormspree = formspreeSent;

      if (!currentSiteId) {
        const loveJourneyAnswers = {
          ready: 'yes',
          feeling: answers.feeling || '',
          promise: 'yes',
          letter: answers.letter || ''
        };
        const title = `My Love Page — ${new Date().toLocaleDateString()}`;

        let rpcResult: CreateDraftSiteResult;
        try {
          rpcResult = await createDraftSite(session.accessToken, title, loveJourneyAnswers);
        } catch (error) {
          console.error('[Site] Could not reach create_draft_site.', error);
          setSubmitStatus('error');
          return;
        }

        if (!rpcResult.allowed) {
          if (rpcResult.reason === 'site_limit_reached') {
            setLimitBlocked(true);
            setSubmitStatus('idle');
          } else {
            console.error('[Site] create_draft_site denied the request.', rpcResult);
            setSubmitStatus('error');
          }
          return;
        }

        currentSiteId = rpcResult.site_id ?? null;
        alreadySentFormspree = false;
        setSiteId(currentSiteId);
        setFormspreeSent(false);

        // Persist the new site id to localStorage right now, synchronously
        // — not just via setSiteId (async/batched) and not just via the
        // periodic useEffect (fires after React re-renders). If the browser
        // is refreshed or closed in the moment right after Supabase creates
        // the site but before Formspree runs below, this write guarantees
        // the site id survives, so a retry reuses it instead of calling
        // create_draft_site a second time.
        saveJourneyState({
          stepIndex,
          answers,
          isComplete: false,
          siteId: currentSiteId,
          userId: session.userId,
          formspreeSent: false
        });

        // Real usage just changed in the database — reflect it in the
        // drawer instead of guessing/incrementing a local number.
        fetchUsage(session.userId, session.accessToken).then(setUsageRow);
      }

      if (!alreadySentFormspree) {
        // The draft site is confirmed saved in Supabase (just now, or in an
        // earlier attempt) — only now is it safe to send the email
        // notification.
        const payload = {
          _subject: 'Someone completed your love website',
          ready: 'yes',
          feeling: answers.feeling || '',
          promise: 'yes',
          finalMessage: answers.letter || ''
        };

        let formspreeOk = false;
        try {
          const res = await fetch(FORM_ENDPOINT, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
          formspreeOk = res.ok;
        } catch (error) {
          console.error('[Form] Could not reach Formspree.', error);
        }

        if (!formspreeOk) {
          // The draft site stays exactly as it is — nothing to undo, no
          // second site, no usage change. Retrying later will skip
          // create_draft_site (siteId is already saved) and simply try
          // Formspree again.
          setSubmitStatus('error');
          return;
        }

        alreadySentFormspree = true;
        setFormspreeSent(true);

        // Persist formspreeSent = true synchronously, before calling
        // complete_site below. If the browser is refreshed or closed
        // between "Formspree succeeded" and "site marked completed", this
        // write guarantees a retry skips Formspree instead of emailing the
        // same completed answers a second time.
        saveJourneyState({
          stepIndex,
          answers,
          isComplete: false,
          siteId: currentSiteId,
          userId: session.userId,
          formspreeSent: true
        });
      }

      // Formspree is confirmed sent (just now, or in an earlier attempt) —
      // only now do we mark the site itself as completed.
      let completeResult: CompleteSiteResult;
      try {
        completeResult = await completeSite(session.accessToken, currentSiteId as string);
      } catch (error) {
        console.error('[Site] Could not reach complete_site.', error);
        setSubmitStatus('error');
        return;
      }

      if (!completeResult.success || (completeResult.status !== 'completed' && completeResult.status !== 'published')) {
        console.error('[Site] complete_site did not confirm completion.', completeResult);
        setSubmitStatus('error');
        return;
      }

      // Persist the finished state synchronously before flipping the UI,
      // for the same reason as the earlier saves — a refresh right after
      // this point must land back on the completed screen, not restart or
      // re-trigger anything.
      saveJourneyState({
        stepIndex,
        answers,
        isComplete: true,
        siteId: currentSiteId,
        userId: session.userId,
        formspreeSent: true
      });

      setIsComplete(true);
      setSubmitStatus('idle');

      // The freshly completed site should show up in "My Love Pages"
      // immediately, without needing a full page reload.
      loadSites(session);
    } catch (error) {
      console.error('[Form] Could not submit romantic answers.', error);
      setSubmitStatus('error');
    } finally {
      isSubmittingRef.current = false;
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
  const planLimits = PLAN_LIMITS[accessTier];
  const sitesCreated = usageRow?.sites_created ?? 0;
  const editsUsed = usageRow?.edits_used ?? 0;
  const usage = {
    sites: planLimits.sites === null ? 'Unlimited' : `${sitesCreated} / ${planLimits.sites}`,
    edits: planLimits.edits === null ? 'Unlimited' : `${editsUsed} / ${planLimits.edits}`,
    limit:
      planLimits.sites === null
        ? 'Unlimited'
        : `${planLimits.sites} site${planLimits.sites === 1 ? '' : 's'} · ${planLimits.edits} edits`
  };

  // Starts a brand-new Love Journey, but only after checking the same real
  // usage numbers shown in the drawer. This is a UI-level courtesy check
  // only — create_draft_site() remains the actual secure authority at
  // final submission, since usageRow here could theoretically be stale.
  const startNewJourney = () => {
    if (planLimits.sites !== null && sitesCreated >= planLimits.sites) {
      setLimitBlocked(true);
      return;
    }

    setLimitBlocked(false);
    setSubmitStatus('idle');
    setStepIndex(0);
    setAnswers({});
    setButtonClicks({});
    setButtonOffset({ x: 0, y: 0 });
    setNoOffset({ x: 0, y: 0 });
    setIsComplete(false);
    setSiteId(null);
    setFormspreeSent(false);

    const session = readAuthSession();
    saveJourneyState({
      stepIndex: 0,
      answers: {},
      isComplete: false,
      siteId: null,
      userId: session?.userId ?? null,
      formspreeSent: false
    });
  };

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
        className="fixed left-4 top-4 z-[60] flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-full border border-white/15 bg-white/5 backdrop-blur-md opacity-80 hover:opacity-100 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-200 transition-all duration-300 ease-out cursor-pointer shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
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

      <main className="relative z-10 min-h-screen w-full max-w-xl mx-auto px-4 pt-16 pb-20 flex flex-col items-center justify-center gap-4">
        <LoveHeader
          currentQuestion={progressStep}
          totalQuestions={STEPS.length}
          isGlowing={isPBarGlowing}
          isPulsing={isPBarPulsing}
        />
        <div className="flex flex-wrap items-center justify-center gap-2">
          {profile && (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-4 py-1.5 text-xs font-outfit font-semibold tracking-wide text-pink-100 shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
              Your Plan: {getPlanLabel(profile)}
            </span>
          )}
          {/* Always-visible jump link to the "My Love Pages" section below.
              The main flow card can push that section past the fold on
              shorter/mobile viewports, and since this page previously read
              as one self-contained centered card, users had no visual cue
              that more content existed to scroll to. This anchor sits in
              the very first viewport on every device, right under the
              header, so the section is always reachable in one tap. */}
          <button
            type="button"
            onClick={() =>
              document.getElementById('my-love-pages')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-4 py-1.5 text-xs font-outfit font-semibold tracking-wide text-pink-100 hover:bg-white/10 transition-colors duration-300 ease-out cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
          >
            My Love Pages ↓
          </button>
        </div>
        <AnimatePresence mode="wait">
          {limitBlocked ? (
            <motion.section
              key="upgrade-limit"
              className="w-full rounded-[28px] bg-white/5 backdrop-blur-xl border border-white/10 p-8 sm:p-10 shadow-[0_15px_45px_rgba(0,0,0,0.5)] text-center relative overflow-hidden"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -18, scale: 0.98 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            >
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_0%,rgba(255,133,161,0.16),transparent_28%),radial-gradient(circle_at_80%_100%,rgba(255,214,231,0.08),transparent_30%)]" />

              <div className="relative">
                <p className="font-outfit uppercase tracking-[0.32em] text-[10px] text-pink-300/65 font-bold mb-5">
                  Plan Limit Reached
                </p>

                <h1 className="font-display font-light italic text-3xl sm:text-4xl leading-tight tracking-tight mb-5">
                  You&apos;ve reached your {getPlanLabel(profile)} limit
                </h1>

                <p className="text-sm sm:text-base leading-relaxed text-pink-100/82 max-w-md mx-auto mb-8">
                  Upgrade to continue creating more love pages.
                </p>

                <div className="grid gap-3 max-w-xs mx-auto">
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
              </div>
            </motion.section>
          ) : !isComplete ? (
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

        <section
          id="my-love-pages"
          className="w-full rounded-[28px] bg-white/5 backdrop-blur-xl border border-white/10 p-6 sm:p-8 shadow-[0_15px_45px_rgba(0,0,0,0.5)] relative overflow-hidden scroll-mt-4"
        >
          <div className="relative flex items-center justify-between gap-4 mb-5 flex-wrap">
            <p className="font-outfit uppercase tracking-[0.28em] text-[10px] text-pink-300/65 font-bold">
              My Love Pages
            </p>
            <button
              type="button"
              onClick={startNewJourney}
              className="rounded-full border border-pink-300/40 bg-white/5 px-5 py-2 text-xs font-outfit font-bold uppercase tracking-[0.16em] text-pink-100 hover:bg-pink-300/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-200 transition-colors duration-300 ease-out cursor-pointer"
            >
              + Create New Love Journey
            </button>
          </div>

          {editSuccessNotice && (
            <p
              className="relative mb-4 rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-100"
              role="status"
              aria-live="polite"
            >
              {editSuccessNotice}
            </p>
          )}

          {editInfoNotice && (
            <p
              className="relative mb-4 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-xs text-pink-100/80"
              role="status"
              aria-live="polite"
            >
              {editInfoNotice}
            </p>
          )}

          {publishSuccessNotice && (
            <p
              className="relative mb-4 rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-100"
              role="status"
              aria-live="polite"
            >
              {publishSuccessNotice}
            </p>
          )}

          {publishError && (
            <p
              className="relative mb-4 rounded-2xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-xs text-rose-200"
              role="status"
              aria-live="polite"
            >
              {publishError}
            </p>
          )}

          {sitesLoading && !sites ? (
            <p className="relative text-sm text-pink-100/70">Loading your saved pages…</p>
          ) : sitesError ? (
            <div className="relative">
              <p className="mb-3 text-sm text-rose-200">
                I could not load your saved pages right now.
              </p>
              <button
                type="button"
                onClick={() => loadSites()}
                className="rounded-full border border-white/20 bg-white/5 px-5 py-2 text-xs font-outfit font-bold uppercase tracking-[0.16em] text-pink-100 hover:bg-white/10 transition-colors duration-300 ease-out cursor-pointer"
              >
                Try again
              </button>
            </div>
          ) : sites && sites.length === 0 ? (
            <p className="relative text-sm text-pink-100/60">
              No love pages yet — finish your Love Journey above to save one here.
            </p>
          ) : sites ? (
            <div className="relative grid gap-3">
              {sites.map(site => (
                <div
                  key={site.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#fff0f3]">
                      {site.title || 'Untitled Love Page'}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-pink-200/60">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-outfit font-bold uppercase tracking-wide ${getSiteStatusBadgeClass(site.status)}`}
                      >
                        {getSiteStatusLabel(site.status)}
                      </span>
                      <span>Created {formatSavedDate(site.created_at)}</span>
                      {site.completed_at && <span>· Completed {formatSavedDate(site.completed_at)}</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {site.status !== 'published' && (
                      <button
                        type="button"
                        onClick={() => openEditSite(site)}
                        className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-outfit font-bold uppercase tracking-[0.14em] text-pink-100 hover:bg-white/10 transition-colors duration-300 ease-out cursor-pointer"
                      >
                        Edit
                      </button>
                    )}
                    {site.status === 'completed' && (
                      <button
                        type="button"
                        onClick={() => publishSavedSite(site)}
                        disabled={publishingSiteId === site.id}
                        className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-xs font-outfit font-bold uppercase tracking-[0.14em] text-emerald-200 hover:bg-emerald-400/20 transition-colors duration-300 ease-out cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                      >
                        {publishingSiteId === site.id ? 'Publishing…' : 'Publish'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setViewingSite(site)}
                      className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-outfit font-bold uppercase tracking-[0.14em] text-pink-100 hover:bg-white/10 transition-colors duration-300 ease-out cursor-pointer"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </main>

      <AnimatePresence>
        {viewingSite && (
          <>
            <motion.div
              key="site-detail-backdrop"
              className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setViewingSite(null)}
            />
            <motion.div
              key="site-detail"
              className="fixed inset-0 z-[80] flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <div
                role="dialog"
                aria-label="Saved Love Page detail"
                className="w-full max-w-md rounded-[28px] border border-white/10 bg-gradient-to-b from-[#2c0b17] to-[#1a050d] p-7 sm:p-8 shadow-[0_15px_45px_rgba(0,0,0,0.6)] relative max-h-[85vh] overflow-y-auto"
              >
                <button
                  type="button"
                  onClick={() => setViewingSite(null)}
                  aria-label="Close"
                  className="absolute top-6 right-6 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm text-pink-100 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-200 transition-colors duration-300 ease-out cursor-pointer"
                >
                  ✕
                </button>

                <span
                  className={`inline-block rounded-full border px-3 py-1 text-[10px] font-outfit font-bold uppercase tracking-wide mb-4 ${getSiteStatusBadgeClass(viewingSite.status)}`}
                >
                  {getSiteStatusLabel(viewingSite.status)}
                </span>

                <h2 className="font-display font-light italic text-2xl leading-tight tracking-tight mb-2 pr-10">
                  {viewingSite.title || 'Untitled Love Page'}
                </h2>
                <p className="mb-6 text-xs text-pink-200/60">
                  Created {formatSavedDate(viewingSite.created_at)}
                  {viewingSite.completed_at && ` · Completed ${formatSavedDate(viewingSite.completed_at)}`}
                </p>

                <div className="grid gap-5">
                  {Object.entries(viewingSite.answers || {}).map(([key, value]) => (
                    <div key={key}>
                      <p className="mb-1 text-[10px] uppercase tracking-widest text-pink-300/50 font-bold">
                        {ANSWER_LABELS[key] || key}
                      </p>
                      <p className="text-sm text-pink-100/90 whitespace-pre-wrap">{value || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingSite && (
          <>
            <motion.div
              key="site-edit-backdrop"
              className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={closeEditSite}
            />
            <motion.div
              key="site-edit"
              className="fixed inset-0 z-[80] flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <div
                role="dialog"
                aria-label="Edit saved Love Page"
                className="w-full max-w-md rounded-[28px] border border-white/10 bg-gradient-to-b from-[#2c0b17] to-[#1a050d] p-7 sm:p-8 shadow-[0_15px_45px_rgba(0,0,0,0.6)] relative max-h-[85vh] overflow-y-auto"
              >
                <button
                  type="button"
                  onClick={closeEditSite}
                  disabled={editSaving}
                  aria-label="Close"
                  className="absolute top-6 right-6 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm text-pink-100 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-200 transition-colors duration-300 ease-out cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  ✕
                </button>

                <p className="font-outfit uppercase tracking-[0.28em] text-[10px] text-pink-300/65 font-bold mb-5 pr-10">
                  Edit Love Page
                </p>

                <label className="grid gap-2 text-xs font-outfit font-bold uppercase tracking-[0.16em] text-pink-200/75 mb-5">
                  Title
                  <input
                    className="w-full p-3.5 bg-white/5 border border-white/10 text-[#fff0f3] text-sm font-sans normal-case tracking-normal focus:bg-white/10 outline-none transition-all duration-300 ease-out rounded-2xl placeholder:text-white/25 hover:border-pink-300/50 focus:border-pink-300 focus:ring-2 focus:ring-pink-300/25"
                    type="text"
                    value={editTitle}
                    onChange={event => setEditTitle(event.target.value)}
                    placeholder="My Love Page"
                    disabled={editSaving}
                  />
                </label>

                <label className="grid gap-2 text-xs font-outfit font-bold uppercase tracking-[0.16em] text-pink-200/75 mb-5">
                  A feeling shared
                  <textarea
                    className="w-full min-h-[90px] p-3.5 bg-white/5 border border-white/10 text-[#fff0f3] text-sm font-sans normal-case tracking-normal focus:bg-white/10 outline-none resize-none transition-all duration-300 ease-out rounded-2xl placeholder:text-white/25 hover:border-pink-300/50 focus:border-pink-300 focus:ring-2 focus:ring-pink-300/25"
                    value={editFeeling}
                    onChange={event => setEditFeeling(event.target.value)}
                    placeholder="Type your feeling here..."
                    disabled={editSaving}
                  />
                </label>

                <label className="grid gap-2 text-xs font-outfit font-bold uppercase tracking-[0.16em] text-pink-200/75 mb-6">
                  Final letter
                  <textarea
                    className="w-full min-h-[110px] p-3.5 bg-white/5 border border-white/10 text-[#fff0f3] text-sm font-sans normal-case tracking-normal focus:bg-white/10 outline-none resize-none transition-all duration-300 ease-out rounded-2xl placeholder:text-white/25 hover:border-pink-300/50 focus:border-pink-300 focus:ring-2 focus:ring-pink-300/25"
                    value={editLetter}
                    onChange={event => setEditLetter(event.target.value)}
                    placeholder="Write anything you want me to keep close..."
                    disabled={editSaving}
                  />
                </label>

                {editError && (
                  <p
                    className={`mb-5 rounded-2xl border px-4 py-3 text-xs ${
                      editLimitReached
                        ? 'border-pink-300/30 bg-pink-400/10 text-pink-100'
                        : 'border-rose-300/25 bg-rose-500/10 text-rose-200'
                    }`}
                    role="status"
                    aria-live="polite"
                  >
                    {editError}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeEditSite}
                    disabled={editSaving}
                    className="flex-1 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-xs font-outfit font-bold uppercase tracking-[0.16em] text-pink-100 hover:bg-white/10 transition-colors duration-300 ease-out cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveEditedSite}
                    disabled={editSaving}
                    className="flex-1 rounded-full bg-white text-[#1a050d] px-6 py-3 text-xs font-outfit font-bold uppercase tracking-[0.16em] shadow-[0_10px_30px_rgba(255,255,255,0.08)] hover:shadow-[0_10px_35px_rgba(255,77,109,0.3)] transition-all duration-300 ease-out cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    {editSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <footer className="relative z-10 w-full text-center text-[10px] text-pink-300/30 font-sans pb-6 select-none pointer-events-none uppercase tracking-widest font-bold">
        Copyright © 2026 Bhavish. All Rights Reserved.
      </footer>
    </div>
  );
}
