import React, { useState, useEffect } from 'react';
import { safeStorage } from '../lib/safeStorage';
import {
  extractUserAcademicProfile,
  getPersonalizedBooks,
  ACADEMIC_PREFS_EVENT,
} from '../lib/bookPersonalization';
import {
  FileQuestion, Play, Trophy, Sparkles, BookOpen, Clock,
  CheckCircle2, AlertCircle, RefreshCw, ChevronRight, Lock,
  X, HelpCircle, ArrowLeft, Check, Award
} from 'lucide-react';
import {
  recordQuizCompleted,
  reconcileAchievementsSnapshot,
  EduPointsAwardResult,
} from '../lib/achievementsService';
import {
  ACCOUNT_SYNC_EVENT,
  getGeneratedQuizzesStorageKey,
  mergeQuizzesLists,
  pushAccountSyncPatch,
} from '../lib/accountSyncService';

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
}

interface Quiz {
  id: string;
  title: string;
  subject: string;
  score: number | null;
  questions: Question[];
  status: 'pending' | 'completed';
  date: string;
}

interface QuizzesProps {
  user?: any;
  profile?: any;
  books?: any[];
}

export function Quizzes({ user, profile, books = [] }: QuizzesProps) {
  const quizStorageKey = getGeneratedQuizzesStorageKey(user?.id);
  const quizzesDirtyRef = React.useRef(false);

  const [quizzes, setQuizzes] = useState<Quiz[]>(() => {
    const saved = safeStorage.getItem(getGeneratedQuizzesStorageKey(user?.id)) || safeStorage.getItem('generated_quizzes');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved quizzes:", e);
      }
    }
    
    // Initial default quizzes so the user sees practice material immediately
    return [
      {
        id: 'q-1',
        title: 'Physics Theory & Mechanics',
        subject: 'Physics',
        score: 80,
        questions: [
          {
            question: "What is the correct SI unit of Force?",
            options: ["Newton (N)", "Joule (J)", "Watt (W)", "Pascal (Pa)"],
            correctAnswer: 0
          },
          {
            question: "Which of the following describes Newton's Third Law of Motion?",
            options: [
              "An object at rest stays at rest unless speeded up.",
              "Force equals mass times acceleration (F=ma).",
              "For every action, there is an equal and opposite reaction.",
              "Gravity pulls object towards Earth's center."
            ],
            correctAnswer: 2
          },
          {
            question: "What is the speed of light in a vacuum?",
            options: ["300,000 km/s", "150,000 km/s", "1,000,000 km/s", "500,000 km/s"],
            correctAnswer: 0
          },
          {
            question: "What form of energy is possessed by a moving object?",
            options: ["Potential Energy", "Kinetic Energy", "Thermal Energy", "Chemical Energy"],
            correctAnswer: 1
          },
          {
            question: "What instrument is used to measure atmospheric pressure?",
            options: ["Thermometer", "Barometer", "Anemometer", "Hygrometer"],
            correctAnswer: 1
          }
        ],
        status: 'completed',
        date: '2026-06-12'
      },
      {
        id: 'q-2',
        title: 'CBC Mathematics Fundamentals',
        subject: 'Mathematics',
        score: null,
        questions: [
          {
            question: "Unlock the value of x if 2x + 7 = 19.",
            options: ["5", "6", "7", "8"],
            correctAnswer: 1
          },
          {
            question: "What is the values of 12 squared (12²)?",
            options: ["120", "144", "156", "164"],
            correctAnswer: 1
          },
          {
            question: "Which term describes a triangle with three equal sides?",
            options: ["Isosceles", "Scalene", "Equilateral", "Right-angled"],
            correctAnswer: 2
          },
          {
            question: "What is the formula representing the area of a circle?",
            options: ["2 * pi * r", "pi * d", "pi * r²", "2 * pi * r²"],
            correctAnswer: 2
          },
          {
            question: "What is the probability of tossing a fair coin and landing on heads?",
            options: ["1/4", "1/2", "3/4", "1"],
            correctAnswer: 1
          }
        ],
        status: 'pending',
        date: '2026-06-13'
      }
    ];
  });

  // Active quiz playing states
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [quizCompleted, setQuizCompleted] = useState<boolean>(false);
  const [viewingReview, setViewingReview] = useState<boolean>(false);
  const [lastQuizReward, setLastQuizReward] = useState<EduPointsAwardResult | null>(null);

  // Quiz generation modal states
  const [showGenerator, setShowGenerator] = useState<boolean>(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Re-hydrate from cloud sync when ACCOUNT_SYNC_EVENT fires
  useEffect(() => {
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.userId && user?.id && detail.userId !== user.id) return;
      const synced = detail?.sync?.generatedQuizzes;
      const stored = safeStorage.getJSON<Quiz[]>(getGeneratedQuizzesStorageKey(user?.id), []);
      const incoming = Array.isArray(synced) && synced.length > 0 ? synced : stored;
      if (Array.isArray(incoming) && incoming.length > 0) {
        quizzesDirtyRef.current = false;
        setQuizzes((prev) => mergeQuizzesLists(prev, incoming) as Quiz[]);
      }
    };
    window.addEventListener(ACCOUNT_SYNC_EVENT, handleSync);
    return () => window.removeEventListener(ACCOUNT_SYNC_EVENT, handleSync);
  }, [user?.id]);

  // Save quizzes to localStorage and cloud sync whenever they change
  useEffect(() => {
    safeStorage.setItem(quizStorageKey, JSON.stringify(quizzes));
    if (user?.id && quizzesDirtyRef.current) {
      pushAccountSyncPatch(user.id, { generatedQuizzes: quizzes });
    }
    quizzesDirtyRef.current = true;
  }, [quizzes, quizStorageKey, user?.id]);

  // Ensure any completed quizzes already present are reflected in achievements ledger (silently)
  useEffect(() => {
    const completed = quizzes
      .filter((q) => q.status === 'completed' && typeof q.score === 'number')
      .map((q) => ({ id: q.id, title: q.title, subject: q.subject, score: q.score as number }));
    if (completed.length > 0 && user?.id) {
      reconcileAchievementsSnapshot(user.id, { completedQuizzes: completed }, { silentToast: true });
    }
  }, [user?.id, quizzes]);

  const [prefsTick, setPrefsTick] = useState(0);
  useEffect(() => {
    const refreshPrefs = () => setPrefsTick((t) => t + 1);
    window.addEventListener(ACADEMIC_PREFS_EVENT, refreshPrefs);
    return () => window.removeEventListener(ACADEMIC_PREFS_EVENT, refreshPrefs);
  }, []);

  const academicProfile = React.useMemo(
    () => extractUserAcademicProfile(profile, user),
    [profile, user, prefsTick]
  );

  const scopedBooks = React.useMemo(
    () => getPersonalizedBooks(books as any, academicProfile),
    [books, academicProfile]
  );

  // Read all subjects and calculate reading progress statistics scoped to user's academic intake
  const subjectStats = React.useMemo(() => {
    const subjectsMap: { [key: string]: { total: number; progressSum: number; activeCount: number; booksList: any[] } } = {};
    
    academicProfile.subjects.forEach((sub) => {
      const cleanSub = sub.trim();
      if (cleanSub && !subjectsMap[cleanSub]) {
        subjectsMap[cleanSub] = { total: 0, progressSum: 0, activeCount: 0, booksList: [] };
      }
    });

    scopedBooks.forEach(book => {
      const bookSubjects = book.subjects || [];
      const prog = book.readProgress || 0;
      
      bookSubjects.forEach((subject: string) => {
        const cleanSub = subject.trim();
        if (!cleanSub) return;
        
        if (!subjectsMap[cleanSub]) {
          subjectsMap[cleanSub] = { total: 0, progressSum: 0, activeCount: 0, booksList: [] };
        }
        
        subjectsMap[cleanSub].total += 1;
        subjectsMap[cleanSub].progressSum += prog;
        if (prog > 0) {
          subjectsMap[cleanSub].activeCount += 1;
        }
        subjectsMap[cleanSub].booksList.push(book);
      });
    });

    return Object.keys(subjectsMap).map(subjectName => {
      const data = subjectsMap[subjectName];
      const avgProg = data.total > 0 ? Math.round(data.progressSum / data.total) : 0;
      
      return {
        name: subjectName,
        totalBooks: data.total,
        avgProgress: avgProg,
        activeBooks: data.activeCount,
        isActive: data.activeCount > 0 || academicProfile.subjects.includes(subjectName),
        books: data.booksList
      };
    }).sort((a, b) => b.avgProgress - a.avgProgress || b.totalBooks - a.totalBooks || a.name.localeCompare(b.name));
  }, [scopedBooks, academicProfile]);

  const activeSubjects = React.useMemo(() => subjectStats.filter(s => s.isActive), [subjectStats]);

  // Set default subject to first active subject
  const firstActiveSubjectName = activeSubjects[0]?.name;
  useEffect(() => {
    if (firstActiveSubjectName && !selectedSubject) {
      setSelectedSubject(firstActiveSubjectName);
    }
  }, [firstActiveSubjectName, selectedSubject]);

  // Launch pre-existing quiz
  const handleStartQuiz = (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setCurrentIdx(0);
    setSelectedOption(null);
    setUserAnswers([]);
    setQuizCompleted(false);
    setViewingReview(false);
    setLastQuizReward(null);
  };

  // Turn page or go to next question
  const handleNextQuestion = () => {
    if (selectedOption === null) return;
    
    const newAnswers = [...userAnswers, selectedOption];
    setUserAnswers(newAnswers);
    
    if (activeQuiz && currentIdx < activeQuiz.questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setSelectedOption(null);
    } else if (activeQuiz) {
      // Calculate score
      let correctCount = 0;
      activeQuiz.questions.forEach((q, idx) => {
        if (q.correctAnswer === newAnswers[idx]) {
          correctCount++;
        }
      });
      const finalScore = Math.round((correctCount / activeQuiz.questions.length) * 100);
      
      // Update quiz state
      setQuizzes(prev => prev.map(q => {
        if (q.id === activeQuiz.id) {
          return { ...q, score: finalScore, status: 'completed' };
        }
        return q;
      }));

      // Award Edu Points & check quiz badges
      const reward = recordQuizCompleted(user?.id, {
        id: activeQuiz.id,
        title: activeQuiz.title,
        subject: activeQuiz.subject,
        score: finalScore,
      });
      setLastQuizReward(reward);
      
      setQuizCompleted(true);
    }
  };

  // Call Gemini API to generate Quiz
  const handleGenerateQuiz = async () => {
    if (!selectedSubject) {
      setErrorMsg("Please select a subject first.");
      return;
    }

    const targetSubject = subjectStats.find(s => s.name === selectedSubject);
    if (!targetSubject || !targetSubject.isActive) {
      setErrorMsg("Generation locked. Choose a subject with active readings.");
      return;
    }

    setIsGenerating(true);
    setErrorMsg('');

    const activeBookTitles = targetSubject.books
      .filter(b => (b.readProgress || 0) > 0)
      .map(b => `"${b.title}" (Progress: ${b.readProgress}%)`)
      .join(", ");

    const generationPrompt = `Generate a 5-question multiple-choice quiz testing material on the subject "${selectedSubject}", keeping specifically in mind that the user is currently studying these textbook reading materials: ${activeBookTitles}.
Your output response must be ONLY a raw JSON array of objects enclosed inside a standard markdown codeblock. 

Each object has 3 keys exactly:
1. "question" (string, clear academic testing question, can involve physics formulas or math equations using LaTeX if appropriate),
2. "options" (array of exactly 4 strings),
3. "correctAnswer" (integer, value 0 to 3 matching the correct option index).

Do not add extra conversational markdown explanation outside the codeblock. Ensure the output is valid, parseable JSON.`;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: generationPrompt,
          provider: 'gemini',
          allowDataCollection: true
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Quiz generation failed (HTTP ${response.status})`);
      }

      const data = await response.json();
      const reply = data.reply || '';

      // Extract JSON array from Markdown codeblock
      const match = reply.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (!match) {
        throw new Error("Could not parse JSON format from model reply");
      }

      const questionsList: Question[] = JSON.parse(match[0]);
      if (!Array.isArray(questionsList) || questionsList.length === 0) {
        throw new Error("Invalid format returned by the AI.");
      }

      const newQuiz: Quiz = {
        id: 'quiz_' + Date.now(),
        title: `${selectedSubject} Adaptive Progress Quiz`,
        subject: selectedSubject,
        score: null,
        questions: questionsList,
        status: 'pending',
        date: new Date().toISOString().split('T')[0]
      };

      setQuizzes(prev => [newQuiz, ...prev]);
      setShowGenerator(false);
      handleStartQuiz(newQuiz);
    } catch (error: any) {
      console.error("AI quiz generation error:", error);
      setErrorMsg(error?.message || "Could not generate quiz right now. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const currentQuestion = activeQuiz?.questions[currentIdx];

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8 font-sans">
      
      {/* Quiz Play View Screen */}
      {activeQuiz && (
        <div className="bg-white dark:bg-[#1a1a1d] rounded-3xl border border-slate-200 dark:border-[#2e2e32] shadow-sm max-w-3xl mx-auto p-6 sm:p-10 relative overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2a2a30] pb-4 mb-6">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setActiveQuiz(null)}
                className="p-1.5 hover:bg-slate-50 dark:hover:bg-[#26262c] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <span className="text-xs font-semibold text-brand-600 dark:text-[#b8a5f0]">{activeQuiz.subject}</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#ededed] mt-0.5 truncate max-w-[200px] sm:max-w-none">{activeQuiz.title}</h3>
              </div>
            </div>
            
            <div className="text-right">
              <span className="text-xs font-semibold text-slate-400">Question</span>
              <div className="text-sm font-bold text-slate-800 dark:text-[#ededed] tabular-nums">{currentIdx + 1} of {activeQuiz.questions.length}</div>
            </div>
          </div>

          {!quizCompleted && !viewingReview ? (
            <div>
              {/* Question progress dot bar */}
              <div className="w-full bg-slate-100 dark:bg-[#2a2a30] h-1.5 rounded-full mb-8 overflow-hidden">
                <div 
                  className="h-full bg-brand-600 dark:bg-[#8a70d6] transition-all duration-300"
                  style={{ width: `${((currentIdx + 1) / activeQuiz.questions.length) * 100}%` }}
                ></div>
              </div>

              {/* Question Container */}
              <div className="mb-8 select-text">
                <p className="text-lg sm:text-xl font-bold text-slate-800 dark:text-[#ededed] leading-relaxed">
                  {currentQuestion?.question}
                </p>
              </div>

              {/* Options */}
              <div className="space-y-3 mb-8">
                {currentQuestion?.options.map((option, idx) => {
                  const isSelected = selectedOption === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedOption(idx)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between group cursor-pointer ${
                        isSelected 
                          ? 'border-brand-600 bg-brand-50 dark:bg-brand-950/40 text-brand-900 dark:text-white font-medium' 
                          : 'border-slate-100 dark:border-[#2c2c32] bg-slate-50/50 dark:bg-[#222226] text-slate-700 dark:text-[#d4d4d8] hover:border-slate-300 dark:hover:border-[#3e3e46] hover:bg-slate-50 dark:hover:bg-[#28282e]'
                      }`}
                    >
                      <span>{option}</span>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected 
                          ? 'border-brand-600 bg-brand-600 text-white' 
                          : 'border-slate-300 dark:border-[#44444d] bg-white dark:bg-[#1a1a1d] group-hover:border-slate-400'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Foot Nav */}
              <div className="flex sm:justify-end">
                <button
                  disabled={selectedOption === null}
                  onClick={handleNextQuestion}
                  className="w-full sm:w-auto bg-brand-600 text-white flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm hover:bg-brand-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {currentIdx === activeQuiz.questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Quiz Score / Completed Review Screen */
            <div className="text-center py-6">
              {!viewingReview ? (
                <div className="max-w-md mx-auto space-y-6">
                  <div className="w-20 h-20 bg-amber-50 dark:bg-amber-950/50 rounded-full flex items-center justify-center mx-auto text-amber-500 scale-110 mb-2">
                    <Trophy className="w-10 h-10" />
                  </div>
                  
                  <div>
                    <h4 className="text-2xl font-bold text-slate-900 dark:text-[#ededed]">Quiz Completed!</h4>
                    <p className="text-slate-500 dark:text-[#a1a1aa] mt-1">Excellent job practice testing your readings.</p>
                  </div>

                  <div className="bg-slate-50 dark:bg-[#222226] p-6 rounded-2xl border border-slate-100 dark:border-[#2e2e34] flex justify-between items-center text-left">
                    <div>
                      <div className="text-xs font-medium text-slate-500 dark:text-[#a1a1aa]">Your Score</div>
                      <div className="text-4xl font-extrabold text-slate-900 dark:text-[#ededed] mt-1 tabular-nums">
                        {quizzes.find(q => q.id === activeQuiz.id)?.score}%
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-sm font-semibold text-brand-600 dark:text-[#b8a5f0]">
                        {(quizzes.find(q => q.id === activeQuiz.id)?.score ?? 0) >= 70 ? 'Passed' : 'Study More'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-[#a1a1aa] tabular-nums">
                        Total: {lastQuizReward?.totalEduPoints.toLocaleString() ?? 0} EP
                      </div>
                    </div>
                  </div>

                  {lastQuizReward && (lastQuizReward.pointsGained > 0 || lastQuizReward.newlyUnlockedBadges.length > 0) && (
                    <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/50 text-left space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                          <Award className="w-4 h-4 shrink-0" />
                          Edu Points Earned
                        </span>
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                          +{lastQuizReward.pointsGained} EP
                        </span>
                      </div>
                      {lastQuizReward.newlyUnlockedBadges.map((b) => (
                        <div key={b.id} className="text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between pt-1 border-t border-emerald-200/70 dark:border-emerald-800/40">
                          <span>Badge Unlocked: <strong>{b.title}</strong></span>
                          <span className="font-semibold tabular-nums">+{b.pointsReward} EP</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => setViewingReview(true)}
                      className="flex-1 bg-slate-100 dark:bg-[#28282e] hover:bg-slate-200 dark:hover:bg-[#32323a] text-slate-800 dark:text-[#ededed] font-semibold py-3 rounded-xl text-sm transition-colors cursor-pointer"
                    >
                      Review Answers
                    </button>
                    <button
                      onClick={() => setActiveQuiz(null)}
                      className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors cursor-pointer"
                    >
                      Back to Quizzes
                    </button>
                  </div>
                </div>
              ) : (
                /* Question-by-Question review logic */
                <div className="text-left space-y-6 max-h-[500px] overflow-y-auto pr-2">
                  <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-[#2a2a30] sticky top-0 bg-white dark:bg-[#1a1a1d] z-10">
                    <h4 className="text-lg font-bold text-slate-800 dark:text-[#ededed]">Answer Review</h4>
                    <button 
                      onClick={() => setViewingReview(false)}
                      className="text-slate-500 dark:text-[#c4c4c8] hover:text-slate-800 dark:hover:text-white text-sm font-semibold flex items-center gap-1 bg-slate-100 dark:bg-[#26262c] px-3 py-1.5 rounded-lg cursor-pointer"
                    >
                      Back to Score
                    </button>
                  </div>

                  {activeQuiz.questions.map((q, qindex) => {
                    const uAns = userAnswers[qindex];
                    const correctAns = q.correctAnswer;
                    const isCorrect = uAns === correctAns;

                    return (
                      <div key={qindex} className="p-5 border border-slate-100 dark:border-[#2c2c32] rounded-xl space-y-3 bg-slate-50/50 dark:bg-[#222226]">
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">{qindex + 1}.</span>
                          <span className="font-semibold text-slate-800 dark:text-[#ededed] text-base">{q.question}</span>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          {q.options.map((opt, oidx) => {
                            const isUserSelected = uAns === oidx;
                            const isCorrectOpt = correctAns === oidx;
                            
                            let styleClass = 'border-slate-100 dark:border-[#2e2e36] bg-white dark:bg-[#1a1a1d] text-slate-700 dark:text-[#d4d4d8]';
                            if (isCorrectOpt) {
                              styleClass = 'border-emerald-200 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-medium';
                            } else if (isUserSelected && !isCorrect) {
                              styleClass = 'border-rose-200 dark:border-rose-700/60 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 font-medium';
                            }

                            return (
                              <div key={oidx} className={`p-3 rounded-lg border text-sm flex items-center justify-between ${styleClass}`}>
                                <span>{opt}</span>
                                {isCorrectOpt && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                                {isUserSelected && !isCorrect && <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Quizzes Workspace & Statistics Screen when no quiz is loaded */}
      {!activeQuiz && (
        <div className="space-y-8">
          
          {/* Headline Heading Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-[#ededed] tracking-tight mb-2">Quizzes</h2>
              <p className="text-slate-500 dark:text-[#a1a1aa] leading-relaxed">
                Boost retention with adaptive practice testing and earn +50 to +90 Edu Points per completed quiz.
              </p>
            </div>
            <button 
              onClick={() => {
                setErrorMsg('');
                setShowGenerator(true);
              }}
              className="bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl font-semibold text-sm transition-all shadow-sm shrink-0 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-brand-100" /> Generate Practice Quiz
            </button>
          </div>

          {/* Dynamic Subject Reading Tracker Progress Indicator Screen */}
          <div className="bg-white dark:bg-[#1a1a1d] p-6 rounded-2xl border border-slate-200 dark:border-[#2e2e32] shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-2.5 mb-6">
              <BookOpen className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-[#ededed] font-display">Reading Progress per Subject</h3>
            </div>

            {subjectStats.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                No textbook subjects available. Upload textbooks or register on courses to track progress.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {subjectStats.map((sub, index) => {
                  return (
                    <div 
                      key={index} 
                      className={`p-4 rounded-xl border flex flex-col justify-between transition-colors min-h-[125px] ${
                        sub.isActive 
                          ? 'border-indigo-200/80 dark:border-indigo-500/30 bg-indigo-50/30 dark:bg-indigo-950/20' 
                          : 'border-slate-100 dark:border-[#2a2a30] bg-slate-50/40 dark:bg-[#222226] opacity-75'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-slate-800 dark:text-[#ededed] text-sm truncate max-w-[140px]" title={sub.name}>
                            {sub.name}
                          </span>
                          {sub.isActive ? (
                            <span className="text-xs font-semibold text-brand-700 dark:text-[#b8a5f0]">
                              Active
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-slate-400 inline-flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Locked
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 dark:text-[#a1a1aa] font-medium block mt-1 tabular-nums">
                          {sub.totalBooks} {sub.totalBooks === 1 ? 'Textbook' : 'Textbooks'}
                        </span>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#a1a1aa] font-medium mb-1">
                          <span>Reading Progress</span>
                          <span className="font-bold text-slate-700 dark:text-[#ededed] tabular-nums">{sub.avgProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-[#2e2e34] h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${sub.isActive ? 'bg-indigo-500 dark:bg-[#8a70d6]' : 'bg-slate-300 dark:bg-slate-700'}`}
                            style={{ width: `${sub.avgProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quizzes Grid Workspace */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-[#ededed] flex items-center gap-2">
              <FileQuestion className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              Practice Quizzes List
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {quizzes.map((quiz) => (
                <div key={quiz.id} className="bg-white dark:bg-[#1a1a1d] p-6 rounded-2xl border border-slate-200 dark:border-[#2e2e32] shadow-sm flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-[#3e3e46]">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2 text-xs text-slate-400 dark:text-[#a1a1aa]">
                      <span className="font-semibold text-brand-600 dark:text-[#b8a5f0]">{quiz.subject}</span>
                      <span className="tabular-nums">{quiz.date} · +50 EP</span>
                    </div>
                    <h4 className="text-lg font-bold text-slate-900 dark:text-[#ededed] mb-1">{quiz.title}</h4>
                    <p className="text-sm text-slate-500 dark:text-[#a1a1aa] mb-4 tabular-nums">{quiz.questions.length} Questions adaptive practice</p>
                  </div>

                  {quiz.status === 'completed' ? (
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-[#2a2a30] pt-4 mt-2">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">Score: {quiz.score}%</span>
                      </div>
                      <button 
                        onClick={() => handleStartQuiz(quiz)}
                        className="text-sm font-semibold text-slate-600 dark:text-[#ededed] hover:text-slate-900 bg-slate-100 dark:bg-[#26262c] hover:bg-slate-200 dark:hover:bg-[#32323a] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        Retake / Review
                      </button>
                    </div>
                  ) : (
                    <div className="border-t border-slate-100 dark:border-[#2a2a30] pt-4 mt-2">
                      <button 
                        onClick={() => handleStartQuiz(quiz)}
                        className="w-full bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 dark:hover:bg-brand-900/60 text-brand-700 dark:text-[#b8a5f0] flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer"
                      >
                        <Play className="w-4 h-4" /> Start Quiz
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Generate Quiz Setup Form Drawer / Modal overlay */}
      {showGenerator && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1a1a1d] rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-[#2e2e32] shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowGenerator(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 dark:hover:bg-[#2a2a30] text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/60 p-3 rounded-2xl w-fit mb-4">
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
            </div>

            <h3 className="text-xl font-bold text-slate-900 dark:text-[#ededed] font-display">Adaptive Quiz Generator</h3>
            <p className="text-sm text-slate-500 dark:text-[#a1a1aa] mt-1 mb-5">AI compiles practice questions using textbook subjects that track active readings in your library.</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 dark:text-[#a1a1aa] uppercase tracking-widest block mb-1.5">Select Subject</label>
                {activeSubjects.length === 0 ? (
                  <div className="p-4 rounded-xl border border-amber-100 dark:border-amber-800/50 bg-amber-50/55 dark:bg-amber-950/30 flex gap-2 text-amber-800 dark:text-amber-200 text-sm leading-relaxed mb-4">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">No Active Readings Detected:</span> To unlock testing, go to the Library and start reading textbook materials. Quizzes can only be generated on subjects you have started reading.
                    </div>
                  </div>
                ) : (
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#222226] border border-slate-200 dark:border-[#34343c] rounded-xl px-4 py-3 text-slate-700 dark:text-[#ededed] text-sm outline-none focus:border-brand-500 font-medium"
                  >
                    {activeSubjects.map(s => (
                      <option key={s.name} value={s.name}>
                        {s.name} (Progress: {s.avgProgress}%)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-800/50 text-rose-600 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="font-semibold">{errorMsg}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowGenerator(false)}
                  className="flex-1 border border-slate-200 dark:border-[#34343c] bg-white dark:bg-[#222226] hover:bg-slate-50 dark:hover:bg-[#2c2c32] text-slate-700 dark:text-[#ededed] font-bold py-3 rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={isGenerating || activeSubjects.length === 0}
                  onClick={handleGenerateQuiz}
                  className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-brand-200" /> Generate Quiz
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline fallback loader animation if missing
function Loader2(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
