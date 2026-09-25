import React, { useState } from 'react';
import { supabase, clearStaleSupabaseTokens } from '../lib/supabase';
import { Mail, Phone, Lock, Hash, Loader2, BookOpen, Compass, ArrowRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type AuthMode = 'email' | 'phone';
type AuthState = 'sign_in' | 'sign_up' | 'verify_otp';

interface AuthProps {
  onContinueAsGuest?: () => void;
}

export function Auth({ onContinueAsGuest }: AuthProps = {}) {
  const [mode, setMode] = useState<AuthMode>('email');
  const [state, setState] = useState<AuthState>('sign_in');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const educationLevels = ['Primary', 'High School', 'College', 'University', 'Graduate', 'Postgraduate', 'Vocational'];
  const roles = ['student', 'teacher', 'educator', 'parent'];
  const countries = [
    { name: 'United States', curriculum: 'AP' },
    { name: 'United Kingdom', curriculum: 'A-Levels' },
    { name: 'Canada', curriculum: 'Provincial Curriculum' },
    { name: 'Australia', curriculum: 'National Curriculum' },
    { name: 'Kenya', curriculum: 'CBC' },
    { name: 'Nigeria', curriculum: 'WASSCE' },
    { name: 'South Africa', curriculum: 'NSC' },
    { name: 'India', curriculum: 'CBSE' },
    { name: 'Germany', curriculum: 'Abitur' },
    { name: 'France', curriculum: 'Baccalaureate' },
    { name: 'China', curriculum: 'Gaokao' },
    { name: 'Japan', curriculum: 'National Curriculum' },
    { name: 'Singapore', curriculum: 'GCE A-Levels' },
    { name: 'Ghana', curriculum: 'WASSCE' },
    { name: 'Egypt', curriculum: 'Thanaweya Amma' },
    { name: 'Brazil', curriculum: 'ENEM' },
    { name: 'Mexico', curriculum: 'Bachillerato' },
    { name: 'Italy', curriculum: 'Maturità' },
    { name: 'Spain', curriculum: 'Bachillerato' },
    { name: 'Netherlands', curriculum: 'VWO/HAVO' },
    { name: 'Ireland', curriculum: 'Leaving Certificate' },
    { name: 'Pakistan', curriculum: 'Matriculation' },
    { name: 'Bangladesh', curriculum: 'HSC' },
    { name: 'Indonesia', curriculum: 'National Curriculum' },
    { name: 'South Korea', curriculum: 'CSAT' },
    { name: 'Finland', curriculum: 'Ylioppilastutkinto' },
    { name: 'Turkey', curriculum: 'National Curriculum' },
    { name: 'Other', curriculum: 'IB' }
  ];
  const curricula = [
    'IGCSE', 'IB', 'National Curriculum', 'A-Levels', 'AP', 'SAT/ACT', 
    'CBSE', 'ICSE', 'WASSCE', 'CBC', 'KCSE', 'NSC', 'Abitur', 'Baccalaureate', 
    'Gaokao', 'Thanaweya Amma', 'ENEM', 'Bachillerato', 'Maturità', 
    'Leaving Certificate', 'Matriculation', 'HSC', 'CSAT', 'Ylioppilastutkinto', 'Other'
  ];
  const fieldsOfStudy = [
    'Business, Administration, and Law',
    'Engineering, Manufacturing, and Construction',
    'Information and Communication Technologies (ICT)',
    'Health and Welfare',
    'Natural Sciences, Mathematics, and Statistics',
    'Arts and Humanities',
    'Social Sciences',
    'Agriculture, Forestry, Fisheries, and Veterinary',
    'Services'
  ];

  const schoolSubjects = [
    'Mathematics', 'English Language', 'Biology', 'Chemistry', 'Physics', 
    'History', 'Geography', 'Computer Science', 'Literature', 'Art', 
    'Music', 'Physical Education', 'Economics', 'Psychology', 'Sociology'
  ];

  const collegeSubjectsMap: Record<string, string[]> = {
    'Business, Administration, and Law': [
      'Accounting', 'Marketing', 'Finance', 'Management', 'Business Law', 
      'Economics', 'Human Resources', 'International Business', 
      'Public Administration', 'Constitutional Law', 'Contract Law', 'Criminal Law'
    ],
    'Engineering, Manufacturing, and Construction': [
      'Civil Engineering', 'Mechanical Engineering', 'Electrical Engineering', 
      'Electronic Engineering', 'Chemical Engineering', 'Architecture', 
      'Urban Planning', 'Construction Management', 'Manufacturing Technology', 'Materials Science'
    ],
    'Information and Communication Technologies (ICT)': [
      'Computer Science', 'Software Engineering', 'Cybersecurity', 'Data Science', 
      'Web Development', 'Network Engineering', 'Artificial Intelligence', 
      'Database Management', 'Information Systems', 'Cloud Computing'
    ],
    'Health and Welfare': [
      'Medicine', 'Nursing', 'Pharmacy', 'Dentistry', 'Public Health', 
      'Physical Therapy', 'Medical Technology', 'Social Work', 'Psychology', 'Veterinary Nursing'
    ],
    'Natural Sciences, Mathematics, and Statistics': [
      'Biology', 'Chemistry', 'Physics', 'Mathematics', 'Statistics', 
      'Geology', 'Astronomy', 'Environmental Science', 'Biochemistry', 'Genetics'
    ],
    'Arts and Humanities': [
      'Fine Arts', 'Graphic Design', 'Fashion Design', 'History', 'Philosophy', 
      'Literature', 'Modern Languages', 'Linguistics', 'Music', 'Performing Arts'
    ],
    'Social Sciences': [
      'Sociology', 'Political Science', 'Anthropology', 'International Relations', 
      'Criminology', 'Media Studies', 'Journalism', 'Social Policy', 'Human Geography'
    ],
    'Agriculture, Forestry, Fisheries, and Veterinary': [
      'Crop Science', 'Animal Science', 'Forestry', 'Fisheries Science', 
      'Veterinary Medicine', 'Horticulture', 'Soil Science', 'Agricultural Economics'
    ],
    'Services': [
      'Tourism', 'Hospitality Management', 'Culinary Arts', 'Transportation', 
      'Logistics', 'Security Services', 'Personal Services', 'Occupational Health'
    ]
  };

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

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    if (!supabase) return setError('Supabase not configured');
    try {
      setIsLoading(true);
      setError(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Failed to fetch') || err.name === 'TypeError') {
        setError('Unable to reach the authentication server. Please check your network connection.');
      } else {
        setError(msg || 'An error occurred during authentication');
      }
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return setError('Supabase not configured');
    
    try {
      setIsLoading(true);
      setError(null);
      
      if (state === 'sign_in') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        // Robust Form Validation
        if (!fullName.trim()) return setError('Please enter your full name');
        if (!dob) return setError('Please enter your date of birth');
        if (!educationLevel) return setError('Please select your level of education');
        if (!country) return setError('Please select your country of study');
        
        // Level-specific validation
        const isSchoolLevel = educationLevel === 'Primary' || educationLevel === 'High School';
        const isHigherEducation = !isSchoolLevel && educationLevel !== 'Vocational' && educationLevel !== '';
        
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

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName,
              dob: dob,
              education_level: educationLevel,
              subjects: subjects.join(', '),
              field_of_study: (educationLevel === 'College' || educationLevel === 'University' || educationLevel === 'Graduate' || educationLevel === 'Postgraduate') ? fieldOfStudy : null,
              role: role,
              country: country,
              curriculum: (educationLevel === 'Primary' || educationLevel === 'High School') ? curriculum : null,
              join_date: new Date().toISOString(),
            }
          }
        });
        if (error) throw error;
        setError('Check your email for a verification link.');
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Refresh Token') || msg.includes('refresh_token') || msg.includes('Invalid')) {
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
    if (!supabase) return setError('Supabase not configured');

    try {
      setIsLoading(true);
      setError(null);

      if (state === 'verify_otp') {
        const { error } = await supabase.auth.verifyOtp({
          phone,
          token: otp,
          type: 'sms',
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          phone,
        });
        if (error) throw error;
        setState('verify_otp');
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden"
      >
        <div className="p-8 pb-6 text-center border-b border-slate-100">
          <div className="w-12 h-12 bg-brand-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-500/30">
            <BookOpen className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-display font-bold text-slate-900 mb-2">
            Welcome to Edu AI
          </h2>
          <p className="text-slate-500 text-sm">
            Sign in to access your personalized learning path
          </p>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
              {error}
            </div>
          )}

          {/* Social Logins */}
          <div className="space-y-3 mb-6">
            <button
              onClick={() => handleOAuthLogin('google')}
              className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-xl font-medium transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
          </div>

          <div className="relative flex items-center justify-center mb-6">
            <div className="border-t border-slate-200 w-full"></div>
            <div className="absolute bg-white px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
              Or continue with
            </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            <button
              onClick={() => { setMode('email'); setState('sign_in'); setError(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === 'email' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Email
            </button>
            <button
              onClick={() => { setMode('phone'); setState('sign_in'); setError(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === 'phone' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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
                        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-slate-900"
                          placeholder="Alex Johnson"
                          required
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
                          <input
                            type="date"
                            value={dob}
                            onChange={(e) => setDob(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-slate-900"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                          <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-slate-900 capitalize"
                          >
                            {roles.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Education Level</label>
                          <select
                            value={educationLevel}
                            onChange={(e) => setEducationLevel(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-slate-900"
                            required
                          >
                            <option value="">Select level...</option>
                            {educationLevels.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Country of Study</label>
                          <select
                            value={country}
                            onChange={(e) => handleCountryChange(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-slate-900"
                            required
                          >
                            <option value="">Select country...</option>
                            {countries.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>

                      {(educationLevel === 'Primary' || educationLevel === 'High School') && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">System / Curriculum</label>
                          <div className="relative">
                            <select
                              value={curriculum}
                              onChange={(e) => setCurriculum(e.target.value)}
                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-slate-900"
                              required
                            >
                              <option value="">Select curriculum...</option>
                              {curricula.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            {country && (
                              <p className="mt-1.5 text-[11px] text-brand-600 font-medium px-1">
                                Suggested based on {country}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {(educationLevel === 'College' || educationLevel === 'University' || educationLevel === 'Graduate' || educationLevel === 'Postgraduate') && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Major / Field of Study</label>
                          <select
                            value={fieldOfStudy}
                            onChange={(e) => {
                              setFieldOfStudy(e.target.value);
                              setSubjects([]); // Reset subjects when field changes
                            }}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-slate-900"
                            required
                          >
                            <option value="">Select field study...</option>
                            {fieldsOfStudy.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </div>
                      )}

                      {((educationLevel === 'Primary' || educationLevel === 'High School') || (educationLevel && fieldOfStudy)) && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Subjects Intake (Select multiple)</label>
                          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-xl">
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
                                className={`text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                  subjects.includes(subj)
                                    ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                                    : 'bg-white text-slate-600 border-slate-100 hover:border-slate-300'
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-slate-900"
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-slate-900"
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
                      <label className="block text-sm font-medium text-slate-700 mb-1">Enter OTP Code</label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="text"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-slate-900 tracking-widest"
                          placeholder="000000"
                          required
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-2 text-center">
                        Code sent to {phone}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium text-slate-900"
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
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 mt-6 disabled:opacity-70"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === 'phone' && state === 'sign_in' ? 'Send Code' : (state === 'sign_up' ? 'Create Account' : 'Sign In')}
              </button>
            </motion.form>
          </AnimatePresence>

          {mode === 'email' && (
            <div className="mt-6 text-center text-sm">
              <div>
                <span className="text-slate-500">
                  {state === 'sign_in' ? "Don't have an account? " : "Already have an account? "}
                </span>
                <button
                  onClick={() => setState(state === 'sign_in' ? 'sign_up' : 'sign_in')}
                  className="text-brand-600 hover:text-brand-700 font-medium transition-colors"
                >
                  {state === 'sign_in' ? 'Sign up' : 'Sign in'}
                </button>
              </div>
            </div>
          )}

          {onContinueAsGuest && (
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
              <button
                type="button"
                onClick={onContinueAsGuest}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:border-brand-300 dark:border-slate-700 dark:hover:border-brand-600 text-slate-700 dark:text-slate-200 bg-slate-50/70 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 transition-all font-medium text-xs sm:text-sm flex items-center justify-center gap-2 group cursor-pointer shadow-xs"
              >
                <Sparkles className="w-4 h-4 text-brand-500 group-hover:scale-110 transition-transform" />
                <span>Explore Applet as Guest</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <p className="text-[11px] text-slate-400 mt-2">
                Preview all reader features, AI tools, and curriculum library instantly
              </p>
            </div>
          )}
          
          {mode === 'phone' && state === 'verify_otp' && (
            <div className="mt-4 text-center text-sm">
              <button
                onClick={() => setState('sign_in')}
                className="text-brand-600 hover:text-brand-700 font-medium transition-colors"
              >
                Use a different number
              </button>
            </div>
          )}

          {!supabase && (
            <div className="mt-8 p-4 bg-amber-50 rounded-xl border border-amber-200">
              <h4 className="text-amber-800 font-semibold text-sm mb-1">Preview Mode Setup Needed</h4>
              <p className="text-amber-700 text-xs leading-relaxed">
                Supabase credentials not found. To enable real auth, add your <code className="bg-amber-100 px-1 rounded">VITE_SUPABASE_URL</code> and <code className="bg-amber-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to the <code className="bg-amber-100 px-1 rounded">.env</code> file.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
