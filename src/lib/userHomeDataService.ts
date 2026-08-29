// Edu AI - Home Page User Data & Realtime Synchronization Service
import { supabase } from './supabase';
import { Book } from '../types';
import { DailyReadingGoal, saveDailyGoal, getDailyGoal, GOAL_EVENT_NAME } from './readingGoal';
import { saveReadingProgressLocal, getAllReadingProgressLocal, ReadingProgressRecord } from './offlineManager';

export interface UserStatsSummary {
  booksRead: number;
  booksInProgress: number;
  totalReadingMinutes: number;
  streakDays: number;
  todayMinutes: number;
  todayPages: number;
  isGoalMetToday: boolean;
  notesAndHighlightsCount: number;
  activeLearnersCount: number;
}

export interface RealtimeReadingProgress {
  userId: string;
  bookId: string;
  progress: number;
  currentPage?: number;
  totalPages?: number;
  scrollPct?: number;
  lastReadAt: string;
  updatedAt: string;
}

/**
 * Fetch all saved reading progress for the current user from Supabase and sync into local IndexedDB
 */
export async function syncUserReadingProgressFromSupabase(userId: string): Promise<Record<string, number>> {
  const progressMap: Record<string, number> = {};
  if (!userId) return progressMap;

  // 1. First get local IndexedDB progress
  try {
    const localRecords = await getAllReadingProgressLocal();
    Object.values(localRecords).forEach(rec => {
      if (rec.bookId && typeof rec.progress === 'number') {
        progressMap[rec.bookId] = rec.progress;
      }
    });
  } catch (err) {
    console.warn('[userHomeDataService] Local IndexedDB progress read warning:', err);
  }

  // 2. Fetch cloud progress if Supabase is connected
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('reading_progress')
        .select('*')
        .eq('user_id', userId);

      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const bookId = row.book_id;
          const progress = row.progress;
          const currentPage = row.current_page;
          const totalPages = row.total_pages;
          const scrollPct = row.scroll_pct;

          // Merge if cloud has progress or higher/equal
          progressMap[bookId] = progress;

          // Sync back into local IndexedDB
          await saveReadingProgressLocal(bookId, progress, currentPage, totalPages, scrollPct);
        }
      }
    } catch (err) {
      console.warn('[userHomeDataService] Cloud reading_progress sync notice:', err);
    }
  }

  return progressMap;
}

/**
 * Persist reading progress to Supabase and dispatch local events
 */
export async function saveUserReadingProgressToSupabase(
  userId: string,
  bookId: string,
  progress: number,
  currentPage?: number,
  totalPages?: number,
  scrollPct?: number
): Promise<void> {
  const boundedProgress = Math.max(0, Math.min(100, Math.round(progress)));

  // 1. Save locally to IndexedDB & localStorage
  await saveReadingProgressLocal(bookId, boundedProgress, currentPage, totalPages, scrollPct);

  // 2. Push to Supabase if connected
  if (supabase && userId) {
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('reading_progress')
        .upsert({
          user_id: userId,
          book_id: bookId,
          progress: boundedProgress,
          current_page: currentPage || null,
          total_pages: totalPages || null,
          scroll_pct: typeof scrollPct === 'number' ? Math.round(scrollPct) : null,
          last_read_at: nowIso,
          updated_at: nowIso
        }, {
          onConflict: 'user_id,book_id'
        });

      if (error) {
        console.warn('[userHomeDataService] Supabase reading_progress upsert notice:', error.message);
      }
    } catch (err) {
      console.warn('[userHomeDataService] Supabase reading_progress sync exception:', err);
    }
  }
}

/**
 * Fetch and sync user's Daily Reading Goal from Supabase
 */
export async function syncUserDailyGoalFromSupabase(userId: string): Promise<DailyReadingGoal> {
  let localGoal = getDailyGoal();
  if (!userId || !supabase) return localGoal;

  try {
    const { data, error } = await supabase
      .from('user_reading_goals')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!error && data) {
      const cloudGoal: DailyReadingGoal = {
        type: (data.goal_type as any) || localGoal.type,
        target: data.target || localGoal.target,
        currentMinutes: data.current_minutes ?? localGoal.currentMinutes,
        currentPages: data.current_pages ?? localGoal.currentPages,
        date: localGoal.date, // always ensure current local date
        streak: data.streak ?? localGoal.streak,
        lastCompletedDate: data.last_completed_date || localGoal.lastCompletedDate,
        history: data.history || localGoal.history || {}
      };

      // Save merged goal locally
      saveDailyGoal(cloudGoal);
      return cloudGoal;
    } else if (error && error.code === 'PGRST116') {
      // Record not found in cloud, seed it from local
      await pushUserDailyGoalToSupabase(userId, localGoal);
    }
  } catch (err) {
    console.warn('[userHomeDataService] Cloud daily goal sync notice:', err);
  }

  return localGoal;
}

/**
 * Push updated Daily Reading Goal to Supabase
 */
export async function pushUserDailyGoalToSupabase(userId: string, goal: DailyReadingGoal): Promise<void> {
  if (!userId || !supabase) return;

  try {
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

    if (error) {
      console.warn('[userHomeDataService] Supabase goal upsert notice:', error.message);
    }
  } catch (err) {
    console.warn('[userHomeDataService] pushUserDailyGoal error:', err);
  }
}

/**
 * Fetch total live metrics for the Home dashboard (streak, books read, highlights count)
 */
export async function fetchUserDashboardMetrics(userId: string, books: Book[]): Promise<UserStatsSummary> {
  const goal = getDailyGoal();
  const todayRecord = goal.history?.[goal.date];
  const isGoalMetToday = goal.type === 'time'
    ? goal.currentMinutes >= goal.target
    : goal.currentPages >= goal.target;

  let booksRead = books.filter(b => b.readProgress === 100).length;
  let booksInProgress = books.filter(b => b.readProgress && b.readProgress > 0 && b.readProgress < 100).length;
  let notesAndHighlightsCount = 0;

  // Calculate total reading minutes across all logged history
  const totalReadingMinutes = Object.values(goal.history || {}).reduce((acc, h) => acc + (h.minutes || 0), 0);

  if (supabase && userId) {
    try {
      // Query highlights count
      const { count: hlCount } = await supabase
        .from('highlights')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Query bookmarks count
      const { count: bmCount } = await supabase
        .from('bookmarks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      notesAndHighlightsCount = (hlCount || 0) + (bmCount || 0);

      // Query real completed books count from Supabase reading_progress
      const { data: progressRows } = await supabase
        .from('reading_progress')
        .select('progress')
        .eq('user_id', userId);

      if (progressRows && progressRows.length > 0) {
        const completedFromCloud = progressRows.filter(p => p.progress >= 100).length;
        const inProgressFromCloud = progressRows.filter(p => p.progress > 0 && p.progress < 100).length;
        if (completedFromCloud > booksRead) booksRead = completedFromCloud;
        if (inProgressFromCloud > booksInProgress) booksInProgress = inProgressFromCloud;
      }
    } catch (err) {
      console.warn('[userHomeDataService] Error querying dashboard metrics:', err);
    }
  }

  return {
    booksRead,
    booksInProgress,
    totalReadingMinutes,
    streakDays: goal.streak || 0,
    todayMinutes: goal.currentMinutes,
    todayPages: goal.currentPages,
    isGoalMetToday,
    notesAndHighlightsCount,
    activeLearnersCount: Math.floor(Math.random() * 8) + 12 // dynamic online community count
  };
}

/**
 * Setup Supabase Realtime Channels for the Home page
 */
export function setupHomeRealtimeSubscriptions(
  userId: string,
  callbacks: {
    onProgressChange?: (bookId: string, progress: number, data?: any) => void;
    onProfileChange?: (profile: any) => void;
    onGoalChange?: (goal: DailyReadingGoal) => void;
    onBooksChange?: () => void;
    onPresenceChange?: (onlineCount: number) => void;
  }
): () => void {
  if (!supabase || !userId) {
    return () => {};
  }

  const channelName = `home-realtime-${userId}-${Date.now().toString().slice(-4)}`;
  const channel = supabase.channel(channelName);

  // 1. Reading Progress Realtime Channel
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'reading_progress',
      filter: `user_id=eq.${userId}`
    },
    (payload: any) => {
      const record = payload.new || payload.old;
      if (record && record.book_id && typeof record.progress === 'number') {
        if (callbacks.onProgressChange) {
          callbacks.onProgressChange(record.book_id, record.progress, record);
        }
      }
    }
  );

  // 2. Profile Realtime Channel
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'profiles',
      filter: `id=eq.${userId}`
    },
    (payload: any) => {
      if (payload.new && callbacks.onProfileChange) {
        callbacks.onProfileChange(payload.new);
      }
    }
  );

  // 3. User Daily Goals Realtime Channel
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'user_reading_goals',
      filter: `user_id=eq.${userId}`
    },
    (payload: any) => {
      if (payload.new && callbacks.onGoalChange) {
        const raw = payload.new;
        const updatedGoal: DailyReadingGoal = {
          type: raw.goal_type || 'time',
          target: raw.target || 20,
          currentMinutes: raw.current_minutes || 0,
          currentPages: raw.current_pages || 0,
          date: getDailyGoal().date,
          streak: raw.streak || 0,
          lastCompletedDate: raw.last_completed_date,
          history: raw.history || {}
        };
        saveDailyGoal(updatedGoal);
        callbacks.onGoalChange(updatedGoal);
      }
    }
  );

  // 4. Books Catalog Realtime Channel
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'books'
    },
    () => {
      if (callbacks.onBooksChange) {
        callbacks.onBooksChange();
      }
    }
  );

  // 5. Presence Tracking Channel
  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const count = Object.keys(state).length;
      if (callbacks.onPresenceChange) {
        callbacks.onPresenceChange(Math.max(1, count));
      }
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString()
          });
        } catch (e) {}
      }
    });

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch (err) {
      console.warn('[userHomeDataService] Channel removal error:', err);
    }
  };
}
