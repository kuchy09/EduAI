import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  Trophy, Book, CheckCircle2, TrendingUp, Clock, CalendarDays, 
  Target, Flame, Activity, Brain, BookOpen, Sparkles
} from 'lucide-react';
import { supabase } from '../lib/supabase';

import { getDailyGoal } from '../lib/readingGoal';

interface ProgressProps {
  user: any;
  books: any[];
}

export function Progress({ user, books }: ProgressProps) {
  const [loading, setLoading] = useState(true);
  const [tokenUsage, setTokenUsage] = useState({ total: 0, count: 0, limit: 50000 });
  const [stats, setStats] = useState({
    booksRead: 0,
    booksInProgress: 0,
    quizzesCompleted: 0,
    avgScore: 0,
    streakDays: 4,
    learningHours: 0
  });

  useEffect(() => {
    async function fetchProgress() {
      if (!user?.id || !supabase) {
        setLoading(false);
        return;
      }
      
      try {
        // Fetch AI Tutor usage
        const { data: usageData } = await supabase
          .from('ai_tutor_usage')
          .select('total_tokens')
          .eq('user_id', user.id);
          
        let total = 0;
        let count = 0;
        if (usageData) {
          total = usageData.reduce((acc, curr) => acc + (curr.total_tokens || 0), 0);
          count = usageData.length;
        }
        
        setTokenUsage({ total, count, limit: 50000 });

        // Calculate book stats (using mock books passed down + what they read)
        // For demonstration, we simulate if no actual read records exist
        const inProgress = books.filter(b => b.readProgress > 0 && b.readProgress < 100).length;
        const read = books.filter(b => b.readProgress === 100).length;

        const currentGoal = getDailyGoal();
        const totalMinutesFromHistory = Object.values(currentGoal.history || {}).reduce((acc, curr) => acc + (curr.minutes || 0), 0);
        const hoursLogged = Math.max(2, Math.round((totalMinutesFromHistory / 60) * 10) / 10);

        setStats({
          booksRead: read > 0 ? read : 2, // fallback for UI demo
          booksInProgress: inProgress > 0 ? inProgress : 3,
          quizzesCompleted: 12,
          avgScore: 85,
          streakDays: currentGoal.streak || 1,
          learningHours: hoursLogged || 24
        });
      } catch (err) {
        console.error("Error fetching progress:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchProgress();
  }, [user, books]);

  const usagePercent = Math.min(100, Math.round((tokenUsage.total / tokenUsage.limit) * 100));

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8">
      
      {/* Header */}
      <div>
        <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-[#EDEDED] tracking-tight">Your Progress</h2>
        <p className="text-slate-500 dark:text-[#A0A0A0] mt-2">Track your learning journey and AI usage.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Stats */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl border border-slate-200 dark:border-[#2a2a2a] shadow-sm flex flex-col items-center text-center contrast-blocked-card plan-card">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center mb-4">
                <Flame className="w-6 h-6" />
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-[#EDEDED] mb-1">{stats.streakDays}</div>
              <div className="text-sm font-medium text-slate-500 dark:text-[#A0A0A0]">Day Streak</div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl border border-slate-200 dark:border-[#2a2a2a] shadow-sm flex flex-col items-center text-center contrast-blocked-card plan-card">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-4">
                <Book className="w-6 h-6" />
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-[#EDEDED] mb-1">{stats.booksRead}</div>
              <div className="text-sm font-medium text-slate-500 dark:text-[#A0A0A0]">Books Completed</div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl border border-slate-200 dark:border-[#2a2a2a] shadow-sm flex flex-col items-center text-center sm:col-span-2 md:col-span-1 contrast-blocked-card plan-card">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-4">
                <Target className="w-6 h-6" />
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-[#EDEDED] mb-1">{stats.avgScore}%</div>
              <div className="text-sm font-medium text-slate-500 dark:text-[#A0A0A0]">Average Quiz Score</div>
            </motion.div>
          </div>

          {/* Activity Chart Placeholder */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl border border-slate-200 dark:border-[#2a2a2a] shadow-sm contrast-blocked-card plan-card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-[#EDEDED] flex items-center gap-2">
                <Activity className="w-5 h-5 text-brand-500 dark:text-[#8a70d6]" />
                Learning Activity
              </h3>
              <select className="text-sm border-slate-200 dark:border-white/10 rounded-lg text-slate-600 dark:text-[#EDEDED] bg-white dark:bg-[#202020] p-1.5 focus:ring-brand-500 focus:border-brand-500 outline-none">
                <option>This Week</option>
                <option>This Month</option>
              </select>
            </div>
            
            <div className="h-64 flex items-end justify-between gap-2">
              {/* Pseudo bars to look like a chart */}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                const height = Math.max(10, Math.floor(Math.random() * 100));
                return (
                  <div key={day} className="flex flex-col items-center flex-1 gap-2">
                    <div className="w-full bg-slate-100 dark:bg-[#242424] rounded-t-lg relative group h-full flex items-end">
                      <div 
                        className="w-full bg-brand-500 dark:bg-[#8a70d6] rounded-t-lg transition-all duration-1000" 
                        style={{ height: `${height}%` }}
                      ></div>
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 dark:bg-[#111111] text-white text-xs px-2 py-1 rounded whitespace-nowrap transition-opacity border border-white/10">
                        {height} mins
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-[#A0A0A0] font-medium">{day}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* AI Tutor Usage */}
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl border border-slate-200 dark:border-[#2a2a2a] shadow-sm relative overflow-hidden contrast-blocked-card plan-card">
            <div className="absolute top-0 right-0 p-6 opacity-5">
              <Brain className="w-24 h-24" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-[#EDEDED] mb-4 flex items-center gap-2 relative z-10">
              <Sparkles className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
              AI Tutor Usage (Free Tier)
            </h3>
            
            <div className="space-y-4 relative z-10">
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-3xl font-bold text-slate-900 dark:text-[#EDEDED]">{tokenUsage.total.toLocaleString()}</span>
                  <span className="text-sm text-slate-500 dark:text-[#A0A0A0] font-medium ml-1">/ {tokenUsage.limit.toLocaleString()} tokens</span>
                </div>
                <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/15 border border-transparent dark:border-indigo-500/30 px-2 py-1 rounded-md">
                  {usagePercent}% utilized
                </div>
              </div>
              
              <div className="relative h-2.5 w-full bg-slate-100 dark:bg-[#242424] rounded-full overflow-hidden">
                <div 
                  className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${usagePercent > 90 ? 'bg-red-500' : usagePercent > 75 ? 'bg-amber-400 dark:bg-amber-500' : 'bg-indigo-500 dark:bg-[#8a70d6]'}`}
                  style={{ width: `${usagePercent}%` }}
                ></div>
              </div>

              <p className="text-sm text-slate-500 dark:text-[#A0A0A0]">
                You've had <span className="font-semibold text-slate-700 dark:text-[#EDEDED]">{tokenUsage.count} exchanges</span> with Sage AI this month. Your quota resets on the 1st.
              </p>

              {usagePercent > 80 && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-sm rounded-xl border border-amber-200 dark:border-amber-800/40">
                  You are approaching your free tier limit. Consider upgrading if you need more tutor access.
                </div>
              )}
            </div>
          </motion.div>

          {/* Recent Achievements */}
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl border border-slate-200 dark:border-[#2a2a2a] shadow-sm contrast-blocked-card plan-card">
            <h3 className="text-lg font-bold text-slate-800 dark:text-[#EDEDED] mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Achievements
            </h3>
            <div className="space-y-4">
              {[
                { title: "First Steps", desc: "Completed 1st Quiz", icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, time: "2 days ago" },
                { title: "Seeker", desc: "10 interactions with Sage AI", icon: <Brain className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />, time: "3 days ago" },
                { title: "Bookworm", desc: "Finished 2 books", icon: <BookOpen className="w-4 h-4 text-blue-500 dark:text-blue-400" />, time: "1 week ago" }
              ].map((achievement, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="mt-0.5 p-2 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/10">
                    {achievement.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-[#EDEDED]">{achievement.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-[#A0A0A0]">{achievement.desc}</p>
                  </div>
                  <div className="text-xs text-slate-400 dark:text-[#8E8E93]">{achievement.time}</div>
                </div>
              ))}
            </div>
            <button className="mt-6 w-full py-2 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-transparent dark:border-white/5 text-slate-600 dark:text-[#EDEDED] text-sm font-medium rounded-xl transition-colors cursor-pointer">
              View All Badges
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
