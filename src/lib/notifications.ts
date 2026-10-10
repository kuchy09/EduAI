import { ViewState } from '../types';
import { safeStorage } from './safeStorage';

export type NotificationType = 'platform' | 'teacher' | 'ai_study' | 'peer' | 'system_alert';
export type NotificationPriority = 'urgent' | 'high' | 'normal' | 'low';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string; // relative display string
  createdAt: number;
  isRead: boolean;
  priority?: NotificationPriority;
  author: {
    name: string;
    role: 'Developer' | 'Platform' | 'Teacher' | 'AI Tutor' | 'Classmate' | 'School Admin';
    avatar?: string;
    badge?: string;
  };
  actionLabel?: string;
  actionView?: ViewState;
  actionPayload?: {
    bookId?: string;
    quizId?: string;
    topic?: string;
    externalUrl?: string;
  };
  tags?: string[];
  pinned?: boolean;
}

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-plat-1',
    type: 'platform',
    title: 'Edu AI v2.5 Major Release: Offline 2.0 & CBC Kenyan Syllabus Textbooks',
    message: 'The Edu AI platform now includes all official Senior Secondary CBC curriculum textbooks, high-definition shareable quote cards, offline chapter audio narration, and instant smart AI study guides.',
    timestamp: '10 minutes ago',
    createdAt: Date.now() - 10 * 60 * 1000,
    isRead: false,
    priority: 'high',
    pinned: true,
    author: {
      name: 'Edu AI Core Dev Team',
      role: 'Developer',
      badge: 'Official Broadcast',
    },
    actionLabel: 'Explore New Textbooks',
    actionView: 'library',
    tags: ['Platform Update', 'Curriculum', 'v2.5', 'CBC'],
  },
  {
    id: 'notif-teach-1',
    type: 'teacher',
    title: 'Teacher Assignment: Physics Chapter 4 "Electromagnetism" Practice Set',
    message: 'Dr. Kamau uploaded 12 practice assessment problems and interactive lecture notes for this week\'s review. Complete the quiz before Friday 5:00 PM.',
    timestamp: '45 minutes ago',
    createdAt: Date.now() - 45 * 60 * 1000,
    isRead: false,
    priority: 'urgent',
    author: {
      name: 'Dr. Kamau',
      role: 'Teacher',
      badge: 'Senior Instructor',
    },
    actionLabel: 'Start Practice Quiz',
    actionView: 'quizzes',
    actionPayload: { topic: 'Physics' },
    tags: ['Physics 101', 'Assignment', 'Due Friday'],
  },
  {
    id: 'notif-ai-1',
    type: 'ai_study',
    title: '5-Day Study Streak! 🎯 Daily Reading Goal Progress (22/30 mins)',
    message: 'You have read for 22 minutes today! Read for 8 more minutes to achieve your daily target, maintain your 5-day streak, and unlock the "Knowledge Voyager" badge.',
    timestamp: '2 hours ago',
    createdAt: Date.now() - 2 * 60 * 60 * 1000,
    isRead: false,
    priority: 'normal',
    author: {
      name: 'Edu AI Study Coach',
      role: 'AI Tutor',
      badge: 'Smart Mentor',
    },
    actionLabel: 'Continue Reading',
    actionView: 'library',
    tags: ['Daily Streak', 'Goal Progress', 'Habits'],
  },
  {
    id: 'notif-teach-2',
    type: 'teacher',
    title: 'Teacher Feedback: Chemistry Lab Report Graded (Score: 94/100)',
    message: 'Mrs. Wanjiku: "Outstanding methodology in analyzing reaction kinetics and equilibrium constants. Check your annotated feedback sheet in your Workspace."',
    timestamp: '4 hours ago',
    createdAt: Date.now() - 4 * 60 * 60 * 1000,
    isRead: false,
    priority: 'high',
    author: {
      name: 'Mrs. Wanjiku',
      role: 'Teacher',
      badge: 'Chemistry Dept',
    },
    actionLabel: 'View Workspace Notes',
    actionView: 'workspace',
    tags: ['Grades', 'Chemistry', 'Lab Report'],
  },
  {
    id: 'notif-peer-1',
    type: 'peer',
    title: 'Study Group Invite: "KCSE Revision & Calculus Circle"',
    message: 'Grace Otieno and 4 classmates invited you to collaborate on shared textbook highlights, summary flashcards, and group KCSE past paper practice drills.',
    timestamp: '6 hours ago',
    createdAt: Date.now() - 6 * 60 * 60 * 1000,
    isRead: true,
    priority: 'normal',
    author: {
      name: 'Grace Otieno',
      role: 'Classmate',
      badge: 'Study Lead',
    },
    actionLabel: 'Open Community Circle',
    actionView: 'community',
    tags: ['Study Group', 'Peer Notes', 'KCSE'],
  },
  {
    id: 'notif-plat-2',
    type: 'platform',
    title: 'Platform Maintenance Notice: Seamless Cloud Sync & Speed Upgrade',
    message: 'Cloud backup latency was reduced by 60%. All your offline downloads, bookmarks, and notebook scratchpads sync seamlessly across mobile and desktop.',
    timestamp: 'Yesterday',
    createdAt: Date.now() - 24 * 60 * 60 * 1000,
    isRead: true,
    priority: 'low',
    author: {
      name: 'Edu AI Platform Operations',
      role: 'Platform',
      badge: 'System Service',
    },
    tags: ['Cloud Sync', 'Performance', 'Storage'],
  },
  {
    id: 'notif-teach-3',
    type: 'teacher',
    title: 'Biology Class Announcement: Mitosis & Meiosis Concept Maps Added',
    message: 'Mr. Omondi: "I have uploaded diagrammatic flowcharts for cell division to assist with tomorrow morning\'s quick pop quiz. Please review chapter 3."',
    timestamp: 'Yesterday',
    createdAt: Date.now() - 28 * 60 * 60 * 1000,
    isRead: true,
    priority: 'normal',
    author: {
      name: 'Mr. Omondi',
      role: 'Teacher',
      badge: 'Biology Faculty',
    },
    actionLabel: 'Review in Library',
    actionView: 'library',
    tags: ['Biology', 'Class Notes'],
  },
  {
    id: 'notif-ai-2',
    type: 'ai_study',
    title: 'Targeted Review: Calculus Derivatives Spaced Repetition',
    message: 'Your AI Tutor detected challenging concepts in chain-rule applications. We prepared a 4-minute interactive conceptual flashcard breakdown.',
    timestamp: '2 days ago',
    createdAt: Date.now() - 48 * 60 * 60 * 1000,
    isRead: true,
    priority: 'normal',
    author: {
      name: 'Edu AI Tutor',
      role: 'AI Tutor',
      badge: 'Adaptive Learning',
    },
    actionLabel: 'Ask AI Tutor',
    actionView: 'ai-tutor',
    tags: ['Mathematics', 'Adaptive Review', 'Flashcards'],
  },
  {
    id: 'notif-peer-2',
    type: 'peer',
    title: 'Peer Discussion: Question on Thermodynamics Entropy Problem',
    message: 'Brian Mwangi replied to your note thread on Chapter 6 Heat Engines: "Here is the step-by-step Carnot efficiency derivation."',
    timestamp: '3 days ago',
    createdAt: Date.now() - 72 * 60 * 60 * 1000,
    isRead: true,
    priority: 'low',
    author: {
      name: 'Brian Mwangi',
      role: 'Classmate',
      badge: 'Peer Tutor',
    },
    actionLabel: 'Open Student Chat',
    actionView: 'chat',
    tags: ['Thermodynamics', 'Discussion'],
  },
];

const STORAGE_KEY = 'edu_ai_notifications_v3';

export function getStoredNotifications(): AppNotification[] {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY);
    if (!raw) {
      safeStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_NOTIFICATIONS));
      return INITIAL_NOTIFICATIONS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      safeStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_NOTIFICATIONS));
      return INITIAL_NOTIFICATIONS;
    }
    return parsed;
  } catch (e) {
    return INITIAL_NOTIFICATIONS;
  }
}

export function saveStoredNotifications(notifs: AppNotification[]) {
  try {
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(notifs));
    // Trigger custom event so header and other components update instantly
    window.dispatchEvent(new Event('notifications_updated'));
  } catch (e) {
    console.error('Failed to save notifications', e);
  }
}
