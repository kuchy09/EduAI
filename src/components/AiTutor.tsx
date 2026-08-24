import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Plus, MessageSquare, Trash2, Menu, Calendar, 
  Sparkles, Clock, Copy, Check, Volume2, VolumeX, Lightbulb, 
  HelpCircle, Compass, BookOpen, Layers, ArrowUp, Zap, ChevronDown
} from 'lucide-react';
import { AstroidIcon } from './icons/AstroidIcon';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: Message[];
}

interface AiTutorProps {
  user: any;
}

export function AiTutor({ user }: AiTutorProps) {
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState<'gemini' | 'anthropic'>('gemini');
  const [learningActive] = useState(() => JSON.parse(localStorage.getItem('privacy_data') ?? 'true'));
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Learner';
  const fieldOfStudy = user?.user_metadata?.field_of_study || 'Education';
  const subjects = user?.user_metadata?.subjects || 'core concepts';

  // Load chat sessions from localStorage or default to single greeting session
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem(`sage_ai_chats_${user?.id || 'guest'}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error("Error parsing saved sage AI chats:", e);
      }
    }

    // Default welcoming session
    return [
      {
        id: 'default_session',
        title: 'Introduction with Sage',
        createdAt: new Date().toLocaleDateString(),
        messages: [
          {
            id: '1',
            role: 'assistant',
            content: `Hello ${firstName}! I'm Sage AI. I'm ready to help you explore ${fieldOfStudy}. I notice you're interested in ${subjects}. ${learningActive ? 'I am also tuning my advice to fit your personal study patterns.' : ''} Do you have any questions about your current study material?`,
          }
        ]
      }
    ];
  });

  // Track the ID of the active conversation thread
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const savedLastActive = localStorage.getItem(`sage_ai_last_active_${user?.id || 'guest'}`);
    return savedLastActive || (sessions[0]?.id || 'default_session');
  });

  // Sync sessions list to localStorage whenever updated
  useEffect(() => {
    localStorage.setItem(`sage_ai_chats_${user?.id || 'guest'}`, JSON.stringify(sessions));
  }, [sessions, user?.id]);

  // Sync last active ID to localStorage
  useEffect(() => {
    localStorage.setItem(`sage_ai_last_active_${user?.id || 'guest'}`, activeSessionId);
  }, [activeSessionId, user?.id]);

  // Support prefill prompts from platform search or contextual deep dives
  useEffect(() => {
    const prefill = localStorage.getItem('ai_tutor_prefill');
    if (prefill) {
      setInput(prefill);
      localStorage.removeItem('ai_tutor_prefill');
    }
  }, []);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0] || null;
  const messages = activeSession ? activeSession.messages : [];

  // Create a brand new session thread
  const handleStartNewChat = () => {
    const newId = Date.now().toString();
    const newSessionState: ChatSession = {
      id: newId,
      title: 'New Conversation',
      createdAt: new Date().toLocaleDateString(),
      messages: [
        {
          id: '1',
          role: 'assistant',
          content: `Hello ${firstName}! I'm Sage AI. What topic from your school syllabus or books would you like to dive into today?`,
        }
      ]
    };
    setSessions(prev => [newSessionState, ...prev]);
    setActiveSessionId(newId);
    setIsMobileSidebarOpen(false);
  };

  // Delete a previous message thread
  const handleDeleteChat = (sessionIdToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent select row propagation
    
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== sessionIdToDelete);
      
      // If list is completely empty, insert a blank default slate
      if (filtered.length === 0) {
        const fallbackId = Date.now().toString();
        return [
          {
            id: fallbackId,
            title: 'Introduction with Sage',
            createdAt: new Date().toLocaleDateString(),
            messages: [
              {
                id: '1',
                role: 'assistant',
                content: `Hello ${firstName}! I'm Sage AI. Ready to explore study sessions!`,
              }
            ]
          }
        ];
      }
      return filtered;
    });

    if (activeSessionId === sessionIdToDelete) {
      const remaining = sessions.filter(s => s.id !== sessionIdToDelete);
      if (remaining.length > 0) {
        setActiveSessionId(remaining[0].id);
      }
    }
  };

  // Scroll to bottom helper
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages.length, isGenerating]);

  // Copy text helper
  const handleCopyMessage = async (msgId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(null), 2000);
    } catch (err) {
      console.warn("Failed to copy text:", err);
    }
  };

  // Speech TTS helper
  const handleSpeakMessage = (msgId: string, text: string) => {
    if (!('speechSynthesis' in window)) return;

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean markdown symbols for cleaner speech
    const cleanText = text
      .replace(/[*_#`~[\]]/g, '')
      .replace(/\$\$[\s\S]*?\$\$/g, ' mathematical formula ')
      .replace(/\$[^$]*\$/g, ' formula ')
      .replace(/\n+/g, ' ');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleSelectStarterPrompt = (promptText: string) => {
    setInput(promptText);
    inputRef.current?.focus();
  };

  const handleSubmit = async (e?: React.FormEvent, directPrompt?: string) => {
    if (e) e.preventDefault();
    const promptToSend = (directPrompt || input).trim();
    if (!promptToSend || !activeSession || isGenerating) return;

    setInput('');
    setIsGenerating(true);

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: promptToSend };
    
    // Add user message to active session list and rename session from default if needed
    setSessions(prev => prev.map(s => {
      if (s.id === activeSession.id) {
        let updatedTitle = s.title;
        if (s.title === 'Introduction with Sage' || s.title === 'New Conversation') {
          updatedTitle = promptToSend.length > 28 ? promptToSend.substring(0, 25) + '...' : promptToSend;
        }
        return {
          ...s,
          title: updatedTitle,
          messages: [...s.messages, userMessage]
        };
      }
      return s;
    }));

    try {
      const allowDataCollection = JSON.parse(localStorage.getItem('privacy_data') ?? 'true');
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToSend,
          provider: provider,
          history: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          allowDataCollection
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSessions(prev => prev.map(s => {
          if (s.id === activeSession.id) {
            return {
              ...s,
              messages: [
                ...s.messages,
                { 
                  id: Date.now().toString() + 'ai', 
                  role: 'assistant', 
                  content: data.reply 
                }
              ]
            };
          }
          return s;
        }));
      } else {
        const errorData = await response.json().catch(() => ({}));
        setSessions(prev => prev.map(s => {
          if (s.id === activeSession.id) {
            return {
              ...s,
              messages: [
                ...s.messages,
                { 
                  id: Date.now().toString() + 'err', 
                  role: 'assistant', 
                  content: errorData.error || 'Sorry, I encountered an error. Please try again.' 
                }
              ]
            };
          }
          return s;
        }));
      }
    } catch {
      setSessions(prev => prev.map(s => {
        if (s.id === activeSession.id) {
          return {
            ...s,
            messages: [
              ...s.messages,
              { 
                id: Date.now().toString() + 'err2', 
                role: 'assistant', 
                content: 'Sorry, I encountered a network error. Please try again.' 
              }
            ]
          };
        }
        return s;
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  const quickPromptChips = [
    { label: "✨ Explain Simply", prompt: "Explain this concept in simple, intuitive terms with an analogy:" },
    { label: "📐 Solve with LaTeX", prompt: "Provide a detailed step-by-step mathematical derivation using LaTeX notation for:" },
    { label: "💡 Real-World Example", prompt: "Give me 2 vivid real-world industry applications for:" },
    { label: "❓ Test My Knowledge", prompt: "Quiz me with 3 conceptual check questions to test my understanding of:" },
    { label: "📝 Summarize Key Points", prompt: "Summarize the essential takeaways and formulas for:" },
  ];

  const starterSuggestions = [
    {
      icon: <Sparkles className="w-4 h-4 text-amber-500" />,
      title: "Intuitive Metaphors",
      desc: "Explain complex physics or engineering with vivid analogies",
      prompt: `Can you explain the difference between Affordances and Signifiers from "Design of Everyday Things" with clear everyday examples?`
    },
    {
      icon: <Zap className="w-4 h-4 text-indigo-500" />,
      title: "Step-by-Step Derivation",
      desc: "Derive key formulas and mathematical equations using LaTeX",
      prompt: "Show the step-by-step derivation of the Quadratic Formula using completing the square with clean LaTeX formulas."
    },
    {
      icon: <BookOpen className="w-4 h-4 text-emerald-500" />,
      title: "Study Material Breakdown",
      desc: `Explore concepts tuned for ${fieldOfStudy}`,
      prompt: `What are the core foundational pillars every beginner in ${fieldOfStudy} must master first?`
    },
    {
      icon: <HelpCircle className="w-4 h-4 text-purple-500" />,
      title: "Active Recall Practice",
      desc: "Generate 3 quick practice questions to test retention",
      prompt: `Give me 3 active recall test questions on ${subjects || 'fundamental principles'} with hints and answers.`
    }
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-r border-slate-200/60 dark:border-slate-800 font-sans select-none">
      <div className="p-4 border-b border-slate-200/50 dark:border-slate-800 shrink-0">
        <button
          onClick={handleStartNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 dark:bg-brand-600 hover:bg-slate-800 dark:hover:bg-brand-500 text-white font-semibold text-sm rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat Session</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
        <div className="flex items-center gap-2 px-2 pb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <Clock className="w-3.5 h-3.5" />
          <span>Your Conversations</span>
        </div>

        {sessions.map((sessionItem) => {
          const isActive = sessionItem.id === activeSessionId;
          return (
            <div
              key={sessionItem.id}
              onClick={() => {
                setActiveSessionId(sessionItem.id);
                setIsMobileSidebarOpen(false);
              }}
              className={`group relative flex items-center gap-3 px-3 py-3 rounded-2xl cursor-pointer transition-all border ${
                isActive
                  ? 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 shadow-sm text-slate-900 dark:text-white font-semibold'
                  : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <div className={`p-2 rounded-xl shrink-0 transition-colors ${
                isActive 
                  ? 'bg-brand-600 text-white shadow-xs' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:text-brand-600'
              }`}>
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              
              <div className="flex-1 min-w-0 pr-6">
                <p className="text-xs font-medium truncate leading-normal" title={sessionItem.title}>
                  {sessionItem.title}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                  <Calendar className="w-2.5 h-2.5 shrink-0" />
                  <span>{sessionItem.createdAt}</span>
                </div>
              </div>

              <button
                onClick={(e) => handleDeleteChat(sessionItem.id, e)}
                className="absolute right-2 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all cursor-pointer"
                title="Delete convo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-200/50 dark:border-slate-800 shrink-0 bg-slate-100/40 dark:bg-slate-900/60 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Continuous Auto-Save</span>
        <span className="font-bold text-slate-500 dark:text-slate-400">Edu AI Core</span>
      </div>
    </div>
  );

  return (
    <div className="flex h-full w-full bg-slate-50 dark:bg-slate-950 relative overflow-hidden font-sans">
      
      {/* Desktop Sidebar Panel */}
      <div 
        className={`hidden md:flex flex-col h-full shrink-0 border-slate-200/70 dark:border-slate-800 transition-all duration-300 ease-in-out ${
          isDesktopSidebarOpen ? 'w-72 border-r' : 'w-0 border-none overflow-hidden'
        }`}
      >
        <div className="w-72 h-full flex flex-col">
          <SidebarContent />
        </div>
      </div>

      {/* Mobile Drawer (Absolute overlay sliding panel) */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-slate-900/50 z-40 backdrop-blur-xs"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            <motion.div
              initial={{ translateX: '-100%' }}
              animate={{ translateX: '0%' }}
              exit={{ translateX: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="md:hidden fixed top-0 bottom-0 left-0 w-72 h-full bg-white dark:bg-slate-900 z-50 shadow-2xl"
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Study Companion Panel - Cool, Smooth & Modern Box */}
      <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-slate-50/90 via-white to-slate-50/70 dark:from-slate-900/90 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden">
        
        {/* Navigation Heading Banner */}
        <div className="liquid-glass-card liquid-glass-specular flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200/60 dark:border-white/10 shrink-0 z-10 sticky top-0 shadow-xs backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 transition-colors cursor-pointer"
              title="Show chats"
            >
              <Menu className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsDesktopSidebarOpen(!isDesktopSidebarOpen)}
              className="hidden md:flex p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 transition-colors cursor-pointer"
              title="Toggle sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
                  <AstroidIcon className="w-5 h-5" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
              </div>
              
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white text-sm leading-none font-display">Sage AI</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200/60 dark:border-brand-800/60">
                    Tutor
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 block truncate max-w-[140px] sm:max-w-[240px] mt-0.5">
                  {activeSession?.title || 'Active thread'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2 text-[11px] font-medium px-3 py-1.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-600 dark:text-slate-300 rounded-full border border-slate-200/80 dark:border-slate-700 shadow-xs">
              <div className={`w-2 h-2 rounded-full ${learningActive ? 'bg-indigo-500 shadow-xs' : 'bg-slate-300'}`}></div>
              <span>{learningActive ? 'Adaptive Context' : 'Private'}</span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-700 dark:text-slate-200 rounded-full border border-slate-200/80 dark:border-slate-700 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="hidden sm:inline">{provider === 'gemini' ? 'Gemini 3.6 Flash' : 'Claude 3.7'}</span>
              <span className="sm:hidden">{provider === 'gemini' ? 'Gemini' : 'Claude'}</span>
            </div>
          </div>
        </div>

        {/* Message Container Scroller */}
        <div className="flex-1 overflow-y-auto pt-6 pb-48 px-4 md:px-10 scroll-smooth relative">
          <div className="max-w-3xl mx-auto space-y-7 flex flex-col">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-brand-500/25">
                    <AstroidIcon className="w-8 h-8" />
                  </div>
                  <div className="absolute inset-0 bg-brand-400 rounded-3xl blur-xl opacity-30 -z-10 animate-pulse" />
                </div>

                <div className="text-center max-w-md space-y-1.5">
                  <h3 className="text-xl font-bold font-display text-slate-900 dark:text-white">
                    What would you like to master today?
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    Ask any question, derive mathematical formulas with LaTeX, or select an interactive starter below:
                  </p>
                </div>

                {/* Interactive Starter Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl mt-2">
                  {starterSuggestions.map((item, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectStarterPrompt(item.prompt)}
                      className="text-left p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 hover:border-brand-400 dark:hover:border-brand-500 shadow-xs hover:shadow-md transition-all group flex flex-col justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-700 group-hover:bg-brand-50 dark:group-hover:bg-brand-950/60 transition-colors">
                          {item.icon}
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                          {item.title}
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {item.desc}
                      </p>
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, index) => (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(index * 0.05, 0.3) }}
                  key={msg.id}
                  className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'user' ? (
                    <div className="group relative max-w-[85%] sm:max-w-[78%]">
                      <div className="bg-gradient-to-br from-indigo-600 via-brand-600 to-purple-700 text-white px-5 py-3.5 rounded-3xl rounded-tr-sm text-[14.5px] sm:text-[15px] leading-relaxed break-words shadow-md shadow-brand-600/15 border border-white/15">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 sm:gap-4 w-full">
                      {/* AI Avatar */}
                      <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-brand-600 via-indigo-600 to-purple-600 flex items-center justify-center shrink-0 text-white shadow-sm shadow-brand-500/20 mt-1">
                        <AstroidIcon className="w-4 h-4" />
                      </div>

                      {/* AI Message Card */}
                      <div className="flex-1 min-w-0 bg-white dark:bg-slate-800/90 rounded-3xl p-5 sm:p-6 border border-slate-200/70 dark:border-slate-700/80 shadow-xs space-y-3">
                        <div className="gemini-markdown text-slate-800 dark:text-slate-100 text-[14.5px] sm:text-[15px] leading-relaxed select-text overflow-x-auto">
                          <ReactMarkdown 
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>

                        {/* Action Bar: Copy & Speak TTS */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700/60 text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleCopyMessage(msg.id, msg.content)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                              title="Copy response to clipboard"
                            >
                              {copiedMsgId === msg.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  <span className="text-emerald-600 font-bold">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => handleSpeakMessage(msg.id, msg.content)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                                speakingMsgId === msg.id
                                  ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-300 font-bold'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                              }`}
                              title={speakingMsgId === msg.id ? "Stop voice playback" : "Listen with speech audio"}
                            >
                              {speakingMsgId === msg.id ? (
                                <>
                                  <VolumeX className="w-3.5 h-3.5 text-brand-600 animate-pulse" />
                                  <span>Stop</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 className="w-3.5 h-3.5" />
                                  <span>Listen</span>
                                </>
                              )}
                            </button>
                          </div>

                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                            Sage Tutor
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))
            )}

            {/* Live Generating Animation Indicator */}
            {isGenerating && (
              <motion.div 
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 sm:gap-4 w-full"
              >
                <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-600 flex items-center justify-center shrink-0 text-white shadow-sm animate-pulse mt-1">
                  <AstroidIcon className="w-4 h-4" />
                </div>
                <div className="bg-white dark:bg-slate-800/90 rounded-2xl px-5 py-4 border border-slate-200/70 dark:border-slate-700/80 shadow-xs flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Sage AI is thinking...
                  </span>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Floating Controls & Input Dock */}
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent dark:from-slate-950 dark:via-slate-950/95 pt-8 pb-5 px-3 sm:px-6 z-20 pointer-events-none">
          <div className="max-w-3xl mx-auto flex flex-col items-center pointer-events-auto space-y-2.5">
            
            {/* Quick Prompt Helper Chips */}
            <div className="w-full flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide px-1">
              {quickPromptChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectStarterPrompt(chip.prompt)}
                  className="whitespace-nowrap px-3 py-1 text-[11px] font-semibold bg-white/90 dark:bg-slate-800/90 hover:bg-brand-50 dark:hover:bg-brand-950/50 hover:text-brand-700 dark:hover:text-brand-300 text-slate-600 dark:text-slate-300 rounded-full border border-slate-200/80 dark:border-slate-700/80 shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Input Capsule Box */}
            <form 
              onSubmit={(e) => handleSubmit(e)}
              className="relative flex items-center w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 shadow-lg shadow-slate-200/50 dark:shadow-black/40 rounded-3xl p-1.5 sm:p-2 focus-within:border-brand-500 dark:focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all backdrop-blur-xl"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Sage AI about concepts, formulas, book summaries..."
                className="w-full bg-transparent border-none focus:ring-0 focus:outline-none pl-4 pr-24 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-sm font-medium"
              />

              <div className="absolute right-2 flex items-center gap-1.5">
                {/* Model Selector Mini Toggle */}
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as 'gemini' | 'anthropic')}
                  className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl px-2 py-1.5 outline-none border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors hidden sm:block"
                  title="Choose AI Model"
                >
                  <option value="gemini">Gemini 3.6 Flash</option>
                  <option value="anthropic">Claude 3.7</option>
                </select>

                <motion.button 
                  whileTap={{ scale: 0.92 }}
                  type="submit"
                  disabled={!input.trim() || isGenerating}
                  className="p-2.5 bg-gradient-to-tr from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 disabled:opacity-40 disabled:hover:from-brand-600 disabled:hover:to-indigo-600 text-white rounded-2xl transition-all shadow-md shadow-brand-500/20 flex items-center justify-center shrink-0 cursor-pointer"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </motion.button>
              </div>
            </form>

            <div className="w-full flex justify-between items-center px-2 text-[10px] text-slate-400 font-semibold">
              <span>{messages.length} messages in conversation</span>
              <span>LaTeX math formulas & markdown supported</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
