import { supabase } from './supabase';
import { safeStorage } from './safeStorage';

export type GoalType = 'time' | 'pages';

export interface DayHistoryRecord {
  minutes: number;
  pages: number;
  completed: boolean;
  target: number;
  type: GoalType;
}

export interface DailyReadingGoal {
  type: GoalType;
  target: number; // in minutes (if type === 'time') or pages (if type === 'pages')
  currentMinutes: number;
  currentPages: number;
  date: string; // 'YYYY-MM-DD'
  streak: number;
  lastCompletedDate?: string;
  history: Record<string, DayHistoryRecord>;
}

const STORAGE_KEY = 'edu_ai_daily_reading_goal';
export const GOAL_EVENT_NAME = 'daily-reading-goal-updated';

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function generateInitialHistory(todayStr: string, yesterdayStr: string): Record<string, DayHistoryRecord> {
  const history: Record<string, DayHistoryRecord> = {};
  const d = new Date();
  
  // Seed past 7 days with realistic activity
  for (let i = 6; i >= 1; i--) {
    const pastDate = new Date();
    pastDate.setDate(d.getDate() - i);
    const dateKey = pastDate.toISOString().split('T')[0];
    const isCompleted = i <= 3; // past 3 days completed for positive initial streak
    history[dateKey] = {
      minutes: isCompleted ? 25 + Math.floor(Math.random() * 15) : 10,
      pages: isCompleted ? 18 + Math.floor(Math.random() * 10) : 6,
      completed: isCompleted,
      target: 20,
      type: 'time',
    };
  }

  history[todayStr] = {
    minutes: 8,
    pages: 5,
    completed: false,
    target: 20,
    type: 'time',
  };

  return history;
}

export function getDailyGoal(): DailyReadingGoal {
  const todayStr = getTodayString();
  const yesterdayStr = getYesterdayString();

  try {
    const raw = safeStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial: DailyReadingGoal = {
        type: 'time',
        target: 20,
        currentMinutes: 8,
        currentPages: 5,
        date: todayStr,
        streak: 3,
        lastCompletedDate: yesterdayStr,
        history: generateInitialHistory(todayStr, yesterdayStr),
      };
      safeStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }

    const parsed: DailyReadingGoal = JSON.parse(raw);

    // If day changed, roll over to new day
    if (parsed.date !== todayStr) {
      // Check if previous recorded day met its goal
      const prevDate = parsed.date;
      const prevRecord = parsed.history?.[prevDate];
      const prevWasCompleted = prevRecord?.completed ?? false;

      let newStreak = parsed.streak;
      if (prevDate === yesterdayStr) {
        if (!prevWasCompleted) {
          newStreak = 0;
        }
      } else if (parsed.lastCompletedDate !== yesterdayStr) {
        newStreak = 0;
      }

      parsed.date = todayStr;
      parsed.currentMinutes = 0;
      parsed.currentPages = 0;
      parsed.streak = newStreak;
      if (!parsed.history) {
        parsed.history = {};
      }
      parsed.history[todayStr] = {
        minutes: 0,
        pages: 0,
        completed: false,
        target: parsed.target,
        type: parsed.type,
      };

      safeStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }

    return parsed;
  } catch {
    const fallback: DailyReadingGoal = {
      type: 'time',
      target: 20,
      currentMinutes: 8,
      currentPages: 5,
      date: todayStr,
      streak: 3,
      history: generateInitialHistory(todayStr, yesterdayStr),
    };
    return fallback;
  }
}

export function saveDailyGoal(goal: DailyReadingGoal, syncCloud = true): void {
  try {
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(goal));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(GOAL_EVENT_NAME, { detail: goal }));
    }
  } catch (err) {
    console.error('Failed to save daily goal:', err);
  }

  // Push to Supabase asynchronously
  if (syncCloud && supabase) {
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) return;
        const userId = data?.user?.id;
        if (userId) {
          const { error } = await supabase
            .from('user_reading_goals')
            .upsert({
              user_id: userId,
              goal_type: goal.type,
              target: goal.target,
              current_minutes: goal.currentMinutes,
              current_pages: goal.currentPages,
              streak: goal.streak,
              last_completed_date: goal.lastCompletedDate || null,
              history: goal.history || {},
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id'
            });
          if (error) console.warn('[readingGoal] Cloud sync notice:', error.message);
        }
      } catch (err) {
        console.warn('[readingGoal] Cloud sync error:', err);
      }
    })();
  }
}

export function setDailyGoalConfig(type: GoalType, target: number): DailyReadingGoal {
  const goal = getDailyGoal();
  goal.type = type;
  goal.target = Math.max(1, target);
  
  // Re-evaluate today's completion with new config
  const currentValue = type === 'time' ? goal.currentMinutes : goal.currentPages;
  const isCompleted = currentValue >= goal.target;
  const todayStr = goal.date;

  if (isCompleted && !goal.history[todayStr]?.completed) {
    goal.streak += 1;
    goal.lastCompletedDate = todayStr;
  }

  if (!goal.history[todayStr]) {
    goal.history[todayStr] = {
      minutes: goal.currentMinutes,
      pages: goal.currentPages,
      completed: isCompleted,
      target: goal.target,
      type: goal.type,
    };
  } else {
    goal.history[todayStr].completed = isCompleted;
    goal.history[todayStr].target = goal.target;
    goal.history[todayStr].type = goal.type;
  }

  saveDailyGoal(goal);
  return goal;
}

export function logReadingProgress(delta: { minutes?: number; pages?: number }): DailyReadingGoal {
  const goal = getDailyGoal();
  const todayStr = goal.date;

  if (delta.minutes) {
    goal.currentMinutes = Math.max(0, goal.currentMinutes + delta.minutes);
  }
  if (delta.pages) {
    goal.currentPages = Math.max(0, goal.currentPages + delta.pages);
  }

  const currentValue = goal.type === 'time' ? goal.currentMinutes : goal.currentPages;
  const wasCompleted = goal.history[todayStr]?.completed || false;
  const isNowCompleted = currentValue >= goal.target;

  if (!wasCompleted && isNowCompleted) {
    goal.streak += 1;
    goal.lastCompletedDate = todayStr;
  }

  if (!goal.history[todayStr]) {
    goal.history[todayStr] = {
      minutes: goal.currentMinutes,
      pages: goal.currentPages,
      completed: isNowCompleted,
      target: goal.target,
      type: goal.type,
    };
  } else {
    goal.history[todayStr].minutes = goal.currentMinutes;
    goal.history[todayStr].pages = goal.currentPages;
    goal.history[todayStr].completed = isNowCompleted;
    goal.history[todayStr].target = goal.target;
    goal.history[todayStr].type = goal.type;
  }

  saveDailyGoal(goal);
  return goal;
}

export function resetTodayProgress(): DailyReadingGoal {
  const goal = getDailyGoal();
  const todayStr = goal.date;

  const wasCompleted = goal.history[todayStr]?.completed || false;
  if (wasCompleted && goal.streak > 0 && goal.lastCompletedDate === todayStr) {
    goal.streak = Math.max(0, goal.streak - 1);
    goal.lastCompletedDate = undefined;
  }

  goal.currentMinutes = 0;
  goal.currentPages = 0;

  if (goal.history[todayStr]) {
    goal.history[todayStr].minutes = 0;
    goal.history[todayStr].pages = 0;
    goal.history[todayStr].completed = false;
  }

  saveDailyGoal(goal);
  return goal;
}
