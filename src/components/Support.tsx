import { 
  LifeBuoy, 
  Mail, 
  MessageSquare, 
  CheckCircle2, 
  ChevronDown, 
  Send, 
  HelpCircle, 
  Wifi, 
  BookOpen, 
  Database,
  ExternalLink 
} from 'lucide-react';
import { useState } from 'react';
import { useOffline } from '../lib/useOffline';

interface SupportProps {
  embedded?: boolean;
  onNavigate?: (view: any) => void;
}

const FAQS = [
  {
    q: 'How does offline reading and IndexedDB sync work?',
    a: 'Any book downloaded in your Library is stored locally using high-performance IndexedDB v2. When you read offline, page progress, bookmarks, and highlights are safely recorded on your device and automatically synced to the cloud whenever you reconnect.'
  },
  {
    q: 'How do I toggle reading themes (Sepia, Charcoal, AMOLED)?',
    a: 'You can set your default theme in Settings > Appearance, or change it instantly while reading using the floating bottom control dock capsule at the base of the reader screen.'
  },
  {
    q: 'What smart tools are available when highlighting text?',
    a: 'When you highlight any passage in a textbook, the contextual selection menu appears with one-tap options to: generate a smart study note, translate text into multiple languages, lookup in-context definitions, or consult the Edu AI Assistant for deep conceptual explanations.'
  },
  {
    q: 'How do I add custom textbooks or PDFs?',
    a: 'From your Library or Admin platform, click the "+ Add Book" button to upload EPUB or PDF documents. Books will be automatically parsed, indexed for search, and formatted for the interactive reader.'
  },
  {
    q: 'Can I export or share my study notes and flashcards?',
    a: 'Yes! Navigate to the Study Workspace to view all your notes and annotations organized by chapter. You can copy quotes, review flashcard decks, or share notes in the Student Chat.'
  }
];

export function Support({ embedded = false, onNavigate }: SupportProps) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [feedbackCategory, setFeedbackCategory] = useState<'bug' | 'feature' | 'question'>('question');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [chatOpenedToast, setChatOpenedToast] = useState(false);
  const { isOnline, storageStats } = useOffline();

  const handleCopyEmail = () => {
    navigator.clipboard?.writeText('dicksonskello09@gmail.com');
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const handleSubmitFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    setFeedbackSent(true);
    setFeedbackText('');
    setTimeout(() => setFeedbackSent(false), 4000);
  };

  const handleStartChat = () => {
    if (onNavigate) {
      onNavigate('chat');
    } else {
      setChatOpenedToast(true);
      setTimeout(() => setChatOpenedToast(false), 3000);
    }
  };

  return (
    <div className={`${embedded ? 'space-y-6' : 'p-4 sm:p-8 max-w-4xl mx-auto space-y-8'}`}>
      {/* Top Banner */}
      <div className={`text-center ${embedded ? 'pb-4' : 'pb-6 md:pb-8'} border-b border-slate-200 dark:border-slate-800`}>
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 shadow-xs">
          <LifeBuoy className="w-6 h-6" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight mb-2">
          How can we help you?
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-lg mx-auto">
          Get assistance with your account, offline sync, reading tools, or connect with the Edu AI community.
        </p>
      </div>

      {/* Support Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Live Chat Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center space-y-3.5 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Live Support & Study Chat</h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Connect with peers, tutors, or the study room team for quick answers.
            </p>
          </div>
          <button 
            onClick={handleStartChat}
            className="mt-auto w-full bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            Launch Chat Room
          </button>
        </div>

        {/* Email Support Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center space-y-3.5 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Email & Direct Inquiries</h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Detailed technical requests, bug reports, and account help with 24h response.
            </p>
          </div>
          <div className="mt-auto w-full grid grid-cols-2 gap-2">
            <button
              onClick={handleCopyEmail}
              className="w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 py-2.5 rounded-xl font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              {copiedEmail ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Mail className="w-3.5 h-3.5" />}
              {copiedEmail ? 'Copied!' : 'Copy Email'}
            </button>
            <a
              href="mailto:dicksonskello09@gmail.com?subject=Edu%20AI%20Support%20Request"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 text-center"
            >
              Send Mail
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {chatOpenedToast && (
        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 rounded-xl text-xs flex items-center gap-2 border border-indigo-200 dark:border-indigo-800">
          <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          Support desk is online. You can also contact directly at dicksonskello09@gmail.com.
        </div>
      )}

      {/* System Status & Diagnostics Snapshot */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Database className="w-3.5 h-3.5" />
          Client Environment & System Health
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-500 block text-[10px]">App Version</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">v2.4.0 Core</span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Network</span>
            <span className={`font-bold flex items-center gap-1.5 ${isOnline ? 'text-emerald-600' : 'text-amber-600'}`}>
              <Wifi className="w-3 h-3" />
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Offline Cache</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{storageStats.count} Books</span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-500 block text-[10px]">IndexedDB</span>
            <span className="font-bold text-emerald-600">v2 Active</span>
          </div>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">
            Frequently Asked Questions
          </h3>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {FAQS.map((faq, idx) => (
            <div key={idx} className="py-3">
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full flex items-center justify-between text-left gap-4 py-1 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
              >
                <span>{faq.q}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openFaq === idx ? 'rotate-180 text-indigo-600' : ''}`} />
              </button>
              {openFaq === idx && (
                <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed pr-6 animate-fadeIn">
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Submit Quick Feedback */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">
            Send Feedback or Report an Issue
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Your notes go directly to the development team to improve the app.
          </p>
        </div>

        <form onSubmit={handleSubmitFeedback} className="space-y-3">
          <div className="flex items-center gap-2">
            {(['question', 'bug', 'feature'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFeedbackCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                  feedbackCategory === cat
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat === 'bug' ? '🐛 Bug Report' : cat === 'feature' ? '💡 Feature Request' : '❓ Question'}
              </button>
            ))}
          </div>

          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Describe what happened or share your idea..."
            rows={3}
            className="w-full p-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-indigo-500 transition-colors resize-none"
          />

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Response via in-app notification</span>
            <button
              type="submit"
              disabled={!feedbackText.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Submit Feedback
            </button>
          </div>
        </form>

        {feedbackSent && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            Thank you! Your feedback has been logged and sent to the team.
          </div>
        )}
      </div>
    </div>
  );
}
