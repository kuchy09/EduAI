import React, { useState, useEffect, useRef } from 'react';
import {
  supabase,
  clearStaleSupabaseTokens,
  ensureSupabaseRuntimeConfig,
  getSupabaseClient,
  getResolvedSupabaseUrl,
  isServerAuthAvailable,
  SERVER_VERIFIED_SESSION_KEY,
} from '../lib/supabase';
import { safeStorage } from '../lib/safeStorage';
import {
  EDUCATION_LEVELS,
  COUNTRIES_WITH_CURRICULA,
  CURRICULA,
  FIELDS_OF_STUDY,
  SCHOOL_SUBJECTS,
  COLLEGE_SUBJECTS_MAP,
  saveStoredAcademicPrefs,
} from '../lib/bookPersonalization';
import { Mail, Phone, Lock, Hash, Loader2, BookOpen, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type AuthMode = 'email' | 'phone';
type AuthState = 'sign_in' | 'sign_up' | 'verify_otp';
type OAuthProviderType = 'google' | 'apple' | 'github';

interface AuthProps {
  onLoginSuccess?: (session: any, profile?: any) => void;
}

export function Auth({ onLoginSuccess }: AuthProps = {}) {
  const [mode, setMode] = useState<AuthMode>('email');
  const [state, setState] = useState<AuthState>('sign_in');
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoadingProvider, setOauthLoadingProvider] = useState<OAuthProviderType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(() => isServerAuthAvailable());
  const popupTimerRef = useRef<number | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');

  // Extended Sign Up states
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [educationLevel, setEducationLevel] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [fieldOfStudy, setFieldOfStudy] = useState('');
  const [role, setRole] = useState('student');
  const [country, setCountry] = useState('');
  const [curriculum, setCurriculum] = useState('');

  const educationLevels = [...EDUCATION_LEVELS];
  const roles = ['student', 'teacher', 'educator', 'parent'];
  const countries = COUNTRIES_WITH_CURRICULA;
  const curricula = CURRICULA;
  const fieldsOfStudy = FIELDS_OF_STUDY;
  const schoolSubjects = SCHOOL_SUBJECTS;
  const collegeSubjectsMap = COLLEGE_SUBJECTS_MAP;

  const currentAvailableSubjects = (educationLevel === 'Primary' || educationLevel === 'High School') 
    ? schoolSubjects 
    : (educationLevel && fieldOfStudy ? collegeSubjectsMap[fieldOfStudy] || [] : []);

  const handleCountryChange = (name: string) => {
    setCountry(name);
    const mapping = countries.find(c => c.name === name);
    if (mapping && (educationLevel === 'Primary' || educationLevel === 'High School')) {
      setCurriculum(mapping.curriculum);
    }
  };

  useEffect(() => {
    let mounted = true;
    ensureSupabaseRuntimeConfig().then((cfg) => {
      if (mounted) {
        setAuthReady(Boolean(cfg.client || cfg.supabaseUrl || cfg.serverAuthReady));
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleOAuthMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const payload = event.data;
      if (!payload || payload.type !== 'EDU_SUPABASE_OAUTH_CALLBACK') return;

      if (popupTimerRef.current) {
        window.clearInterval(popupTimerRef.current);
        popupTimerRef.current = null;
      }

      if (payload.error || payload.error_description) {
        const rawErr = String(payload.error_description || payload.error || 'Authentication cancelled');
        const decodedErr = decodeURIComponent(rawErr.replace(/\+/g, ' '));
        if (decodedErr.toLowerCase().includes('provider is not enabled') || decodedErr.toLowerCase().includes('unsupported provider')) {
          setError('This OAuth provider must be toggled ON with its Client ID & Secret in your Supabase Dashboard (Authentication -> Providers).');
        } else {
          setError(decodedErr);
        }
        setOauthLoadingProvider(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const runtimeCfg = await ensureSupabaseRuntimeConfig();
        const client = runtimeCfg.client || getSupabaseClient();
        let activeSession: any = null;
        let fetchedProfile: any = null;

        if (client && payload.code) {
          const { data, error: exchangeErr } = await client.auth.exchangeCodeForSession(payload.code);
          if (exchangeErr) throw exchangeErr;
          activeSession = data.session;
        } else if (client && payload.access_token && payload.refresh_token) {
          const { data, error: sessionErr } = await client.auth.setSession({
            access_token: payload.access_token,
            refresh_token: payload.refresh_token,
          });
          if (sessionErr) throw sessionErr;
          activeSession = data.session;
        } else if (payload.access_token) {
          const verifyRes = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: payload.access_token,
              refresh_token: payload.refresh_token || '',
            }),
          });
          const verifyJson = await verifyRes.json().catch(() => ({}));
          if (!verifyRes.ok || !verifyJson?.session) {
            throw new Error(verifyJson?.error || 'Could not verify OAuth session.');
          }
          activeSession = verifyJson.session;
          fetchedProfile = verifyJson.profile || null;
          try {
            safeStorage.setItem(SERVER_VERIFIED_SESSION_KEY, JSON.stringify(activeSession));
          } catch (_) {}
        }

        if (activeSession && onLoginSuccess) {
          onLoginSuccess(activeSession, fetchedProfile);
        }
      } catch (err: any) {
        setError(err?.message || 'Could not finalize OAuth sign-in.');
      } finally {
        setOauthLoadingProvider(null);
        setIsLoading(false);
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => {
      window.removeEventListener('message', handleOAuthMessage);
      if (popupTimerRef.current) {
        window.clearInterval(popupTimerRef.current);
      }
    };
  }, [onLoginSuccess]);

  const handleOAuthLogin = async (provider: OAuthProviderType) => {
    const providerLabel = provider === 'github' ? 'GitHub' : provider === 'apple' ? 'Apple' : 'Google';
    try {
      setOauthLoadingProvider(provider);
      setError(null);
      setInfoMessage(null);

      const runtimeCfg = await ensureSupabaseRuntimeConfig();
      const client = runtimeCfg.client || getSupabaseClient();
      const sbUrl = (runtimeCfg.supabaseUrl || getResolvedSupabaseUrl()).replace(/\/$/, '');

      if (!client && !sbUrl) {
        setOauthLoadingProvider(null);
        return setError(`Supabase project URL (VITE_SUPABASE_URL) is not configured yet.`);
      }

      const redirectTo = `${window.location.origin}/auth/callback`;
      let oauthUrl = '';

      if (client) {
        const { data, error } = await client.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo,
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;
        oauthUrl = data?.url || '';
      } else {
        oauthUrl = `${sbUrl}/auth/v1/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirectTo)}`;
      }

      if (!oauthUrl) {
        throw new Error(`Unable to start ${providerLabel} authentication.`);
      }

      const width = 540;
      const height = 680;
      const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
      const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
      const popup = window.open(
        oauthUrl,
        'eduai_supabase_oauth',
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,status=no`
      );

      if (!popup) {
        const inIframe = window.self !== window.top;
        if (inIframe) {
          setOauthLoadingProvider(null);
          setError(`Popup blocked. Please allow popups in your browser to continue with ${providerLabel}.`);
          return;
        }
        window.location.assign(oauthUrl);
        return;
      }

      if (popupTimerRef.current) {
        window.clearInterval(popupTimerRef.current);
      }
      popupTimerRef.current = window.setInterval(() => {
        if (popup.closed) {
          if (popupTimerRef.current) {
            window.clearInterval(popupTimerRef.current);
            popupTimerRef.current = null;
          }
          setOauthLoadingProvider((current) => (current === provider ? null : current));
        }
      }, 600);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Failed to fetch') || err.name === 'TypeError') {
        setError('Unable to reach the authentication server. Please check your network connection.');
      } else if (msg.toLowerCase().includes('provider is not enabled') || msg.toLowerCase().includes('unsupported provider')) {
        setError(`${providerLabel} sign-in must be enabled in your Supabase Dashboard under Authentication -> Providers.`);
      } else {
        setError(msg || `An error occurred during ${providerLabel} authentication`);
      }
      setOauthLoadingProvider(null);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError(null);
      setInfoMessage(null);

      const runtimeCfg = await ensureSupabaseRuntimeConfig();
      const client = runtimeCfg.client || getSupabaseClient();

      if (!client && !runtimeCfg.serverAuthReady) {
        setError('Authentication server is not configured. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
        return;
      }
      
      if (state === 'sign_in') {
        if (client) {
          const { data: signInData, error } = await client.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (error) throw error;
          if (signInData?.session && onLoginSuccess) {
            onLoginSuccess(signInData.session);
          }
        } else {
          const res = await fetch('/api/auth/signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim(), password }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data?.session) {
            throw new Error(data?.error || 'Invalid email or password.');
          }
          try {
            safeStorage.setItem(SERVER_VERIFIED_SESSION_KEY, JSON.stringify(data.session));
          } catch (_) {}
          if (onLoginSuccess) {
            onLoginSuccess(data.session, data.profile || null);
          }
        }
      } else {
        // Robust Form Validation
        if (!fullName.trim()) return setError('Please enter your full name');
        if (!dob) return setError('Please enter your date of birth');
        if (!educationLevel) return setError('Please select your level of education');
        if (!country) return setError('Please select your country of study');
        
        // Level-specific validation
        const isSchoolLevel = educationLevel === 'Primary' || educationLevel === 'High School';
        const isHigherEducation = !isSchoolLevel && educationLevel !== '';

        if (isSchoolLevel && !curriculum) {
          return setError(`Please select a curriculum for ${educationLevel}`);
        }
        
        if (isHigherEducation && !fieldOfStudy) {
          return setError('Please select your field of study');
        }
        
        if (subjects.length === 0) {
          return setError('Please select at least one subject of interest');
        }

        if (password.length < 6) {
          return setError('Password must be at least 6 characters long');
        }

        const subjectsJoined = subjects.join(', ');
        const metadata = {
          full_name: fullName.trim(),
          dob: dob,
          education_level: educationLevel,
          subjects: subjectsJoined,
          field_of_study: !isSchoolLevel ? fieldOfStudy : null,
          role: role,
          country: country,
          curriculum: isSchoolLevel ? curriculum : null,
          join_date: new Date().toISOString(),
        };
        const emailRedirectTo = `${window.location.origin}/auth/callback`;

        if (client) {
          const { data: signUpData, error } = await client.auth.signUp({
            email: email.trim(),
            password,
            options: {
              emailRedirectTo,
              data: metadata,
            }
          });
          if (error) throw error;
          const createdUserId = signUpData?.user?.id || signUpData?.session?.user?.id;
          if (createdUserId) {
            saveStoredAcademicPrefs(createdUserId, {
              country,
              education_level: educationLevel,
              curriculum: isSchoolLevel ? curriculum : '',
              field_of_study: !isSchoolLevel ? fieldOfStudy : '',
              subjects: subjectsJoined,
            });
          }
          if (signUpData?.session) {
            if (onLoginSuccess) {
              onLoginSuccess(signUpData.session, {
                id: createdUserId,
                full_name: metadata.full_name,
                email: email.trim(),
                country: metadata.country,
                education_level: metadata.education_level,
                curriculum: metadata.curriculum,
                field_of_study: metadata.field_of_study,
                subjects: metadata.subjects,
                role: metadata.role,
              });
            }
          } else {
            setInfoMessage('Account created! Please check your email inbox for a verification link, then sign in below.');
            setState('sign_in');
          }
        } else {
          const res = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email.trim(),
              password,
              metadata,
              emailRedirectTo,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data?.error || 'Could not create account.');
          }
          const createdUserId = data?.user?.id || data?.session?.user?.id;
          if (createdUserId) {
            saveStoredAcademicPrefs(createdUserId, {
              country,
              education_level: educationLevel,
              curriculum: isSchoolLevel ? curriculum : '',
              field_of_study: !isSchoolLevel ? fieldOfStudy : '',
              subjects: subjectsJoined,
            });
          }
          if (data?.session) {
            try {
              safeStorage.setItem(SERVER_VERIFIED_SESSION_KEY, JSON.stringify(data.session));
            } catch (_) {}
            if (onLoginSuccess) {
              onLoginSuccess(data.session, {
                id: createdUserId,
                full_name: metadata.full_name,
                email: email.trim(),
                country: metadata.country,
                education_level: metadata.education_level,
                curriculum: metadata.curriculum,
                field_of_study: metadata.field_of_study,
                subjects: metadata.subjects,
                role: metadata.role,
              });
            }
          } else {
            setInfoMessage('Account created! Please check your email inbox for a verification link, then sign in below.');
            setState('sign_in');
          }
        }
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Refresh Token') || msg.includes('refresh_token') || (msg.includes('Invalid') && !msg.includes('Invalid login credentials') && !msg.includes('Invalid email'))) {
        clearStaleSupabaseTokens();
        setError('Your session expired. Please enter your email and password to sign in again.');
      } else if (msg.includes('Failed to fetch') || err.name === 'TypeError') {
        clearStaleSupabaseTokens();
        setError('Unable to reach the authentication server. Please check your network connection.');
      } else {
        setError(msg || 'An error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError(null);
      setInfoMessage(null);

      const runtimeCfg = await ensureSupabaseRuntimeConfig();
      const client = runtimeCfg.client || getSupabaseClient();

      if (!client && !runtimeCfg.serverAuthReady) {
        setError('Authentication server is not configured. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
        return;
      }

      if (state === 'verify_otp') {
        if (client) {
          const { data: otpData, error } = await client.auth.verifyOtp({
            phone: phone.trim(),
            token: otp.trim(),
            type: 'sms',
          });
          if (error) throw error;
          if (otpData?.session && onLoginSuccess) {
            onLoginSuccess(otpData.session);
          }
        } else {
          const res = await fetch('/api/auth/otp-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: phone.trim(), token: otp.trim() }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data?.session) {
            throw new Error(data?.error || 'Invalid verification code.');
          }
          try {
            safeStorage.setItem(SERVER_VERIFIED_SESSION_KEY, JSON.stringify(data.session));
          } catch (_) {}
          if (onLoginSuccess) {
            onLoginSuccess(data.session);
          }
        }
      } else {
        if (client) {
          const { error } = await client.auth.signInWithOtp({
            phone: phone.trim(),
          });
          if (error) throw error;
          setState('verify_otp');
        } else {
          const res = await fetch('/api/auth/otp-send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: phone.trim() }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data?.error || 'Could not send verification code.');
          }
          setState('verify_otp');
        }
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Failed to fetch') || err.name === 'TypeError') {
        setError('Unable to reach authentication server. Please check your connection.');
      } else {
        setError(msg || 'An error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#121212] flex items-center justify-center p-4 transition-colors">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white dark:bg-[#1A1A1A] rounded-3xl shadow-xl border border-slate-100 dark:border-white/10 overflow-hidden"
      >
        <div className="p-8 pb-6 text-center border-b border-slate-100 dark:border-white/10">
          <div className="w-12 h-12 bg-brand-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-500/30">
            <BookOpen className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-2">
            {state === 'sign_up' ? 'Create Your Edu AI Account' : 'Welcome to Edu AI'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {state === 'sign_up'
              ? 'Sign up to unlock your personalized learning platform'
              : 'Sign in or create an account to access the platform'}
          </p>

          {state !== 'verify_otp' && (
            <div className="grid grid-cols-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl mt-5">
              <button
                type="button"
                onClick={() => { setState('sign_in'); setError(null); setInfoMessage(null); }}
                className={`py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                  state === 'sign_in'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('email'); setState('sign_up'); setError(null); setInfoMessage(null); }}
                className={`py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                  state === 'sign_up'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}
        </div>

        <div className="p-8">
          {infoMessage && (
            <div className="mb-6 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-sm rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <span>{infoMessage}</span>
            </div>
          )}

          {error && (
            <div className="mb-6 p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 text-sm rounded-xl border border-red-100 dark:border-red-900/60">
              {error}
            </div>
          )}

          {/* Social Logins (Sign In & Sign Up via Google, Apple, GitHub) */}
          <div className="space-y-2.5 mb-6">
            <button
              type="button"
              disabled={isLoading || oauthLoadingProvider !== null}
              onClick={() => handleOAuthLogin('google')}
              className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/80 px-4 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-60 cursor-pointer"
            >
              {oauthLoadingProvider === 'google' ? (
                <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              <span>{state === 'sign_up' ? 'Sign up with Google' : 'Continue with Google'}</span>
            </button>

            <button
              type="button"
              disabled={isLoading || oauthLoadingProvider !== null}
              onClick={() => handleOAuthLogin('apple')}
              className="w-full flex items-center justify-center gap-3 bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-100 border border-slate-950 dark:border-white text-white dark:text-slate-950 px-4 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-60 cursor-pointer"
            >
              {oauthLoadingProvider === 'apple' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
              )}
              <span>{state === 'sign_up' ? 'Sign up with Apple' : 'Continue with Apple'}</span>
            </button>

            <button
              type="button"
              disabled={isLoading || oauthLoadingProvider !== null}
              onClick={() => handleOAuthLogin('github')}
              className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/80 px-4 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-60 cursor-pointer"
            >
              {oauthLoadingProvider === 'github' ? (
                <Loader2 className="w-5 h-5 animate-spin text-slate-700 dark:text-slate-200" />
              ) : (
                <svg className="w-5 h-5 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              )}
              <span>{state === 'sign_up' ? 'Sign up with GitHub' : 'Continue with GitHub'}</span>
            </button>
          </div>

          <div className="relative flex items-center justify-center mb-6">
            <div className="border-t border-slate-200 dark:border-white/10 w-full"></div>
            <div className="absolute bg-white dark:bg-[#1A1A1A] px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
              Or continue with
            </div>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => { setMode('email'); if (state === 'verify_otp') setState('sign_in'); setError(null); setInfoMessage(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${mode === 'email' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => { setMode('phone'); setState('sign_in'); setError(null); setInfoMessage(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${mode === 'phone' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              Phone (OTP)
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.form
              key={mode + state}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              onSubmit={mode === 'email' ? handleEmailAuth : handlePhoneAuth}
              className="space-y-4"
            >
              {mode === 'email' ? (
                <div className="space-y-4">
                  {state === 'sign_up' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
                          placeholder="Alex Johnson"
                          required
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date of Birth</label>
                          <input
                            type="date"
                            value={dob}
                            onChange={(e) => setDob(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-slate-900 dark:text-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
                          <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-slate-900 dark:text-white capitalize"
                          >
                            {roles.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Education Level</label>
                          <select
                            value={educationLevel}
                            onChange={(e) => setEducationLevel(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-slate-900 dark:text-white"
                            required
                          >
                            <option value="">Select level...</option>
                            {educationLevels.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Country of Study</label>
                          <select
                            value={country}
                            onChange={(e) => handleCountryChange(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-slate-900 dark:text-white"
                            required
                          >
                            <option value="">Select country...</option>
                            {countries.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>

                      {(educationLevel === 'Primary' || educationLevel === 'High School') && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">System / Curriculum</label>
                          <div className="relative">
                            <select
                              value={curriculum}
                              onChange={(e) => setCurriculum(e.target.value)}
                              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-slate-900 dark:text-white"
                              required
                            >
                              <option value="">Select curriculum...</option>
                              {curricula.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            {country && (
                              <p className="mt-1.5 text-[11px] text-brand-600 dark:text-brand-400 font-medium px-1">
                                Suggested based on {country}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {(educationLevel === 'College' || educationLevel === 'University' || educationLevel === 'Graduate' || educationLevel === 'Postgraduate') && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Major / Field of Study</label>
                          <select
                            value={fieldOfStudy}
                            onChange={(e) => {
                              setFieldOfStudy(e.target.value);
                              setSubjects([]); // Reset subjects when field changes
                            }}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-slate-900 dark:text-white"
                            required
                          >
                            <option value="">Select field study...</option>
                            {fieldsOfStudy.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </div>
                      )}

                      {((educationLevel === 'Primary' || educationLevel === 'High School') || (educationLevel && fieldOfStudy)) && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subjects Intake (Select multiple)</label>
                          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                            {currentAvailableSubjects.map((subj) => (
                              <button
                                key={subj}
                                type="button"
                                onClick={() => {
                                  setSubjects(prev => 
                                    prev.includes(subj) 
                                      ? prev.filter(s => s !== subj) 
                                      : [...prev, subj]
                                  );
                                }}
                                className={`text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all border cursor-pointer ${
                                  subjects.includes(subj)
                                    ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                }`}
                              >
                                {subj}
                              </button>
                            ))}
                          </div>
                          <p className="mt-2 text-[11px] text-slate-400 italic">
                            Selected: {subjects.length > 0 ? subjects.join(', ') : 'None'}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {state === 'verify_otp' ? (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Enter OTP Code</label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="text"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-slate-900 dark:text-white tracking-widest placeholder:text-slate-400"
                          placeholder="000000"
                          required
                        />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
                        Code sent to {phone}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
                          placeholder="+1 (555) 000-0000"
                          required
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 mt-6 disabled:opacity-70 cursor-pointer"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === 'phone' && state === 'sign_in' ? 'Send Code' : (state === 'sign_up' ? 'Create Account' : 'Sign In')}
              </button>
            </motion.form>
          </AnimatePresence>

          {mode === 'email' && (
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-white/10 text-center text-sm">
              <div>
                <span className="text-slate-500 dark:text-slate-400">
                  {state === 'sign_in' ? "Don't have an account? " : "Already have an account? "}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setState(state === 'sign_in' ? 'sign_up' : 'sign_in');
                    setError(null);
                    setInfoMessage(null);
                  }}
                  className="text-brand-600 dark:text-brand-400 hover:text-brand-700 font-semibold transition-colors cursor-pointer"
                >
                  {state === 'sign_in' ? 'Sign up' : 'Sign in'}
                </button>
              </div>
            </div>
          )}
          
          {mode === 'phone' && state === 'verify_otp' && (
            <div className="mt-4 text-center text-sm">
              <button
                type="button"
                onClick={() => setState('sign_in')}
                className="text-brand-600 dark:text-brand-400 hover:text-brand-700 font-medium transition-colors cursor-pointer"
              >
                Use a different number
              </button>
            </div>
          )}

          {!supabase && !authReady && (
            <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/60">
              <h4 className="text-amber-800 dark:text-amber-300 font-semibold text-sm mb-1">Supabase Configuration Needed</h4>
              <p className="text-amber-700 dark:text-amber-400 text-xs leading-relaxed">
                Add <code className="bg-amber-100 dark:bg-amber-900/60 px-1 rounded">VITE_SUPABASE_URL</code> and <code className="bg-amber-100 dark:bg-amber-900/60 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> in your environment settings to enable authentication.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
