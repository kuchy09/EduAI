import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, Globe2, BookOpen, CheckCircle2, Loader2, X, Sparkles } from 'lucide-react';
import {
  EDUCATION_LEVELS,
  COUNTRIES_WITH_CURRICULA,
  CURRICULA,
  FIELDS_OF_STUDY,
  SCHOOL_SUBJECTS,
  COLLEGE_SUBJECTS_MAP,
  extractUserAcademicProfile,
  saveStoredAcademicPrefs,
} from '../lib/bookPersonalization';
import { getSupabaseClient, getActiveEphemeralSession } from '../lib/supabase';

interface AcademicPreferencesModalProps {
  isOpen: boolean;
  onClose?: () => void;
  canDismiss?: boolean;
  user: any;
  profile: any;
  accessToken?: string;
  onSaved: (updatedProfile: any, updatedUserMeta?: any) => void;
}

export function AcademicPreferencesModal({
  isOpen,
  onClose,
  canDismiss = true,
  user,
  profile,
  accessToken,
  onSaved,
}: AcademicPreferencesModalProps) {
  const existing = extractUserAcademicProfile(profile, user);

  const [country, setCountry] = useState(existing.country || 'Kenya');
  const [educationLevel, setEducationLevel] = useState(existing.educationLevel || 'High School');
  const [curriculum, setCurriculum] = useState(existing.curriculum || 'CBC');
  const [fieldOfStudy, setFieldOfStudy] = useState(
    existing.fieldOfStudy || 'Natural Sciences, Mathematics, and Statistics'
  );
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(existing.subjects);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = extractUserAcademicProfile(profile, user);
      if (current.country) setCountry(current.country);
      if (current.educationLevel) setEducationLevel(current.educationLevel);
      if (current.curriculum) setCurriculum(current.curriculum);
      if (current.fieldOfStudy) setFieldOfStudy(current.fieldOfStudy);
      setSelectedSubjects(current.subjects);
      setError(null);
    }
  }, [isOpen, profile, user]);

  const isSchool = educationLevel === 'Primary' || educationLevel === 'High School';

  const availableSubjects = isSchool
    ? SCHOOL_SUBJECTS
    : fieldOfStudy
      ? COLLEGE_SUBJECTS_MAP[fieldOfStudy] || []
      : [];

  const handleCountryChange = (nextCountry: string) => {
    setCountry(nextCountry);
    const match = COUNTRIES_WITH_CURRICULA.find((c) => c.name === nextCountry);
    if (match && (educationLevel === 'Primary' || educationLevel === 'High School')) {
      setCurriculum(match.curriculum);
    }
  };

  const handleEducationLevelChange = (nextLevel: string) => {
    setEducationLevel(nextLevel);
    const nextIsSchool = nextLevel === 'Primary' || nextLevel === 'High School';
    if (nextIsSchool !== isSchool) {
      setSelectedSubjects([]);
    }
    if (nextIsSchool && !curriculum) {
      const match = COUNTRIES_WITH_CURRICULA.find((c) => c.name === country);
      setCurriculum(match?.curriculum || 'CBC');
    }
  };

  const handleFieldChange = (nextField: string) => {
    setFieldOfStudy(nextField);
    const nextAllowed = new Set(COLLEGE_SUBJECTS_MAP[nextField] || []);
    setSelectedSubjects((prev) => prev.filter((s) => nextAllowed.has(s)));
  };

  const toggleSubject = (subj: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subj) ? prev.filter((s) => s !== subj) : [...prev, subj]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!country || !educationLevel) {
      setError('Please select your country and level of education.');
      return;
    }
    if (isSchool && !curriculum) {
      setError('Please select your school curriculum.');
      return;
    }
    if (!isSchool && !fieldOfStudy) {
      setError('Please select your field of study.');
      return;
    }
    if (selectedSubjects.length === 0) {
      setError('Please select at least one subject to personalize your shelves.');
      return;
    }

    setIsSaving(true);
    setError(null);

    const subjectsStr = selectedSubjects.join(', ');
    const payload = {
      country,
      education_level: educationLevel,
      curriculum: isSchool ? curriculum : '',
      field_of_study: isSchool ? '' : fieldOfStudy,
      subjects: subjectsStr,
    };

    try {
      // 1. Instant local persistence so shelves update with 0ms latency
      saveStoredAcademicPrefs(user?.id, payload);

      // 2. Update via browser Supabase client if available
      const client = getSupabaseClient();
      let updatedProfileRow: any = null;
      if (client && user?.id) {
        try {
          await client.auth.updateUser({
            data: payload,
          });
        } catch (_) {}

        try {
          const { data: profData } = await client
            .from('profiles')
            .upsert(
              {
                id: user.id,
                country: payload.country,
                location: payload.country,
                education_level: payload.education_level,
                curriculum: payload.curriculum || null,
                field_of_study: payload.field_of_study || null,
                subjects: payload.subjects,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'id' }
            )
            .select('*')
            .maybeSingle();
          if (profData) updatedProfileRow = profData;
        } catch (_) {}
      }

      // 3. Also sync through server JWT-verified endpoint (/api/auth/preferences)
      let bearerToken = accessToken || '';
      if (!bearerToken && client) {
        try {
          const { data: sess } = await client.auth.getSession();
          bearerToken = sess?.session?.access_token || '';
        } catch (_) {}
      }
      if (!bearerToken) {
        bearerToken = getActiveEphemeralSession()?.access_token || '';
      }

      if (bearerToken) {
        try {
          const res = await fetch('/api/auth/preferences', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${bearerToken}`,
            },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data?.profile) {
              updatedProfileRow = { ...(updatedProfileRow || {}), ...data.profile };
            }
          }
        } catch (_) {}
      }

      const mergedProfile = {
        ...(profile || {}),
        ...(updatedProfileRow || {}),
        id: user?.id || profile?.id,
        country: payload.country,
        location: payload.country,
        education_level: payload.education_level,
        curriculum: payload.curriculum || null,
        field_of_study: payload.field_of_study || null,
        subjects: payload.subjects,
      };

      onSaved(mergedProfile, payload);
      onClose?.();
    } catch (err: any) {
      setError(err?.message || 'Could not save preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#18181b] border border-slate-200 dark:border-[#2e2e34] rounded-3xl shadow-2xl text-slate-900 dark:text-slate-100"
          >
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-md px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-[#2a2a30] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-100 dark:border-brand-500/30">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold font-display text-slate-900 dark:text-white truncate">
                    Personalize Your Study Shelves
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    Tailor Home, Library, Bookstore, Audiobooks & AI Recommendations
                  </p>
                </div>
              </div>
              {canDismiss && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs font-medium text-rose-700 dark:text-rose-300">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Globe2 className="w-3.5 h-3.5 text-brand-500" />
                    Country
                  </label>
                  <select
                    value={country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#222227] border border-slate-200 dark:border-[#34343c] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {COUNTRIES_WITH_CURRICULA.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-brand-500" />
                    Level of Education
                  </label>
                  <select
                    value={educationLevel}
                    onChange={(e) => handleEducationLevelChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#222227] border border-slate-200 dark:border-[#34343c] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {EDUCATION_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {isSchool ? (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    Curriculum
                  </label>
                  <select
                    value={curriculum}
                    onChange={(e) => setCurriculum(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#222227] border border-slate-200 dark:border-[#34343c] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {CURRICULA.map((curr) => (
                      <option key={curr} value={curr}>
                        {curr}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    Field of Study / Major
                  </label>
                  <select
                    value={fieldOfStudy}
                    onChange={(e) => handleFieldChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#222227] border border-slate-200 dark:border-[#34343c] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {FIELDS_OF_STUDY.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                    Subjects ({selectedSubjects.length} selected)
                  </label>
                  {selectedSubjects.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedSubjects([])}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      Clear selection
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-[#202025] border border-slate-200/80 dark:border-[#2e2e36] max-h-52 overflow-y-auto">
                  {availableSubjects.map((subj) => {
                    const active = selectedSubjects.includes(subj);
                    return (
                      <button
                        key={subj}
                        type="button"
                        onClick={() => toggleSubject(subj)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer border ${
                          active
                            ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                            : 'bg-white dark:bg-[#2a2a31] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#383842] hover:border-brand-300 dark:hover:border-brand-500/50'
                        }`}
                      >
                        {active && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                        <span>{subj}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-[#2a2a30]">
                {canDismiss && onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Shelves...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Save & Personalize Books</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
