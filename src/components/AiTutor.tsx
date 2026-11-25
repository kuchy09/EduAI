import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Plus, MessageSquare, Trash2, Menu, Calendar, 
  Sparkles, Clock, Copy, Check, Volume2, VolumeX, Lightbulb, 
  HelpCircle, Compass, BookOpen, Layers, ArrowUp, Zap, ChevronDown,
  Mic, MicOff, FileText, X, AudioLines, Square, Pencil, RotateCcw
} from 'lucide-react';
import { AstroidIcon } from './icons/AstroidIcon';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { safeStorage } from '../lib/safeStorage';
import {
  getAiChatsStorageKey,
  getAiLastActiveStorageKey,
  getAiDeletedStorageKey,
  mergeAiChatSessions,
  mergeDeletedAiSessionsMap,
  computeAiSyncDigest,
  pushAccountSyncPatch,
  flushPendingAccountSync,
  hydrateAccountSync,
  ACCOUNT_SYNC_EVENT,
} from '../lib/accountSyncService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
  source?: 'tutor' | 'reader' | 'edulab';
  messages: Message[];
}

interface AiTutorProps {
  user: any;
  profile?: any;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onSidebarStateChange?: (open: boolean) => void;
}

export function AiTutor({ user, profile, isSidebarOpen, onToggleSidebar, onSidebarStateChange }: AiTutorProps) {
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState<'gemini' | 'anthropic'>('gemini');
  const [speedMode, setSpeedMode] = useState<'fast' | 'deep'>('fast');
  const abortControllerRef = useRef<AbortController | null>(null);
  const [learningActive] = useState(() => {
    try {
      return JSON.parse(safeStorage.getItem('privacy_data') ?? 'true');
    } catch {
      return true;
    }
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(false);
  const onSidebarStateChangeRef = useRef(onSidebarStateChange);
  onSidebarStateChangeRef.current = onSidebarStateChange;
  const lastReportedOpenRef = useRef<boolean | null>(null);

  // Sync with prop when changed from outside
  useEffect(() => {
    if (typeof isSidebarOpen === 'boolean') {
      if (window.innerWidth < 768) {
        setIsMobileSidebarOpen(isSidebarOpen);
        setIsDesktopSidebarOpen(false);
      } else {
        setIsDesktopSidebarOpen(isSidebarOpen);
        setIsMobileSidebarOpen(false);
      }
    }
  }, [isSidebarOpen]);

  // Listen to custom event from fallback toggle triggers
  useEffect(() => {
    const handleToggle = () => {
      if (window.innerWidth < 768) {
        setIsMobileSidebarOpen(prev => !prev);
      } else {
        setIsDesktopSidebarOpen(prev => !prev);
      }
    };
    window.addEventListener('toggle-sage-sidebar', handleToggle);
    return () => window.removeEventListener('toggle-sage-sidebar', handleToggle);
  }, []);

  // Broadcast state change back to Header & App only when isOpen actually changes
  useEffect(() => {
    const isOpen = isMobileSidebarOpen || isDesktopSidebarOpen;
    if (lastReportedOpenRef.current === isOpen) return;
    lastReportedOpenRef.current = isOpen;
    window.dispatchEvent(new CustomEvent('sage-sidebar-state-change', { detail: { isOpen } }));
    onSidebarStateChangeRef.current?.(isOpen);
  }, [isMobileSidebarOpen, isDesktopSidebarOpen]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [liveStreamingText, setLiveStreamingText] = useState<string>('');
  const [liveThoughtText, setLiveThoughtText] = useState<string>('');
  const [isThoughtOpen, setIsThoughtOpen] = useState<boolean>(true);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editInputText, setEditInputText] = useState<string>('');
  const [historySearch, setHistorySearch] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File Upload State
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    size: string;
    content?: string;
    type: string;
  } | null>(null);

  // Web Speech API Voice Input State
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      setSpeechSupported(true);
      try {
        const recognizer = new SpeechRecognitionClass();
        recognizer.continuous = false;
        recognizer.interimResults = false;
        recognizer.lang = 'en-US';

        recognizer.onresult = (event: any) => {
          const transcript = event.results?.[0]?.[0]?.transcript;
          if (transcript) {
            setInput(prev => (prev ? `${prev.trim()} ${transcript}` : transcript));
          }
          setIsListening(false);
        };

        recognizer.onerror = (err: any) => {
          console.warn('SpeechRecognition error:', err);
          setIsListening(false);
        };

        recognizer.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognizer;
      } catch (err) {
        console.warn('Speech recognition init error:', err);
      }
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!speechSupported || !recognitionRef.current) {
      console.warn('Speech recognition is not available in this browser environment.');
      return;
    }
    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Speech recognition start error:', err);
        setIsListening(false);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeFormatted = file.size < 1024 
      ? `${file.size} B` 
      : file.size < 1024 * 1024 
      ? `${(file.size / 1024).toFixed(1)} KB` 
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

    if (
      file.type.startsWith('text/') || 
      file.name.endsWith('.txt') || 
      file.name.endsWith('.md') || 
      file.name.endsWith('.csv') || 
      file.name.endsWith('.json')
    ) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const textContent = (event.target?.result as string) || '';
        setAttachedFile({
          name: file.name,
          size: sizeFormatted,
          content: textContent.slice(0, 8000),
          type: file.type || 'text/plain'
        });
      };
      reader.readAsText(file);
    } else {
      setAttachedFile({
        name: file.name,
        size: sizeFormatted,
        type: file.type || 'document'
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    inputRef.current?.focus();
  };

  // Auto-resize textarea to fit text dynamically up to 100px max height (Manus AI / Cursor style)
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    // Reset height to auto to measure scrollHeight accurately
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;

    if (scrollHeight > 100) {
      textarea.style.height = '100px';
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.height = `${Math.max(scrollHeight, 40)}px`;
      textarea.style.overflowY = 'hidden';
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Interactive Voice Chat with Sage (Talk Back & Interactive Loop) State
  const [isVoiceChatOpen, setIsVoiceChatOpen] = useState(false);
  const [voiceChatStatus, setVoiceChatStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [voiceLiveTranscript, setVoiceLiveTranscript] = useState('');
  const [voiceLastAiReply, setVoiceLastAiReply] = useState('');
  const voiceRecognitionRef = useRef<any>(null);

  // Speak Sage's voice aloud and resume listening once speech completes
  const speakSageVoice = (text: string, onComplete?: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setVoiceChatStatus('listening');
      startVoiceChatListening();
      return;
    }

    window.speechSynthesis.cancel();
    setVoiceChatStatus('speaking');

    // Clean text of markdown, latex, and URLs for natural audio speech
    const cleanSpeech = text
      .replace(/[*_#`~[\]]/g, '')
      .replace(/\$\$[\s\S]*?\$\$/g, ' mathematical formula ')
      .replace(/\$[^$]*\$/g, ' formula ')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanSpeech || "I am ready for your next question.");
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';

    utterance.onend = () => {
      setVoiceChatStatus('listening');
      startVoiceChatListening();
      if (onComplete) onComplete();
    };

    utterance.onerror = () => {
      setVoiceChatStatus('listening');
      startVoiceChatListening();
    };

    window.speechSynthesis.speak(utterance);
  };

  // Start listening for user speech in Interactive Voice Chat
  const startVoiceChatListening = () => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      console.warn("Speech recognition is not supported in this browser.");
      return;
    }

    try {
      if (voiceRecognitionRef.current) {
        voiceRecognitionRef.current.abort();
      }

      const recognizer = new SpeechRecognitionClass();
      recognizer.continuous = false;
      recognizer.interimResults = true;
      recognizer.lang = 'en-US';

      recognizer.onstart = () => {
        setVoiceChatStatus('listening');
      };

      recognizer.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        const text = final || interim;
        setVoiceLiveTranscript(text);
      };

      recognizer.onend = () => {
        setVoiceLiveTranscript(prev => {
          if (prev && prev.trim().length > 1) {
            handleVoiceChatMessage(prev.trim());
          } else {
            setVoiceChatStatus('listening');
          }
          return '';
        });
      };

      recognizer.onerror = (err: any) => {
        console.warn('Voice chat recognition error:', err);
        setVoiceChatStatus('listening');
      };

      voiceRecognitionRef.current = recognizer;
      recognizer.start();
    } catch (e) {
      console.warn('Failed to start voice chat listening:', e);
    }
  };

  // Handle sending and receiving speech in interactive voice chat
  const handleVoiceChatMessage = async (userPrompt: string) => {
    if (!userPrompt || !activeSession) return;

    setVoiceChatStatus('thinking');
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: userPrompt };

    const nowIso = new Date().toISOString();
    const targetSessionId =
      activeSession.id === 'default_session' ? `chat_${Date.now()}` : activeSession.id;
    if (targetSessionId !== activeSession.id) {
      setActiveSessionId(targetSessionId);
    }
    setSessions(prev => prev.map(s => {
      if (s.id === activeSession.id) {
        return {
          ...s,
          id: targetSessionId,
          title: s.title === 'Introduction with Sage' || s.title === 'New Conversation' ? userPrompt.slice(0, 25) : s.title,
          updatedAt: nowIso,
          messages: [...s.messages, userMessage]
        };
      }
      return s;
    }));

    try {
      const allowDataCollection = JSON.parse(safeStorage.getItem('privacy_data') ?? 'true');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userPrompt,
          provider: provider,
          speedMode: 'fast',
          stream: false,
          history: [...messages, userMessage].slice(-6).map(m => ({ role: m.role, content: m.content })),
          allowDataCollection
        })
      });

      if (response.ok) {
        const data = await response.json();
        const replyText = data.reply || "I'm listening and ready to help. What would you like to explore next?";
        setVoiceLastAiReply(replyText);

        const replyIso = new Date().toISOString();
        setSessions(prev => prev.map(s => {
          if (s.id === targetSessionId || s.id === activeSession.id) {
            return {
              ...s,
              updatedAt: replyIso,
              messages: [...s.messages, { id: Date.now().toString() + 'ai', role: 'assistant', content: replyText }]
            };
          }
          return s;
        }));

        // Sage TALKS BACK aloud to user!
        speakSageVoice(replyText);
      } else {
        const errData = await response.json().catch(() => ({}));
        const errMessage = errData.error || "I encountered an issue processing that. Please try asking again.";
        setVoiceLastAiReply(errMessage);
        speakSageVoice(errMessage);
      }
    } catch {
      const networkError = "I'm having trouble connecting to the network right now. Please try again.";
      setVoiceLastAiReply(networkError);
      speakSageVoice(networkError);
    }
  };

  // Launch Interactive Voice Chat Session
  const handleOpenVoiceChat = () => {
    setIsVoiceChatOpen(true);
    if (input.trim()) {
      const promptToUse = input.trim();
      setInput('');
      handleVoiceChatMessage(promptToUse);
    } else {
      const greeting = `Hello ${firstName}! I'm Sage. What would you like to discuss today? I'm listening.`;
      setVoiceLastAiReply(greeting);
      speakSageVoice(greeting);
    }
  };

  // End Interactive Voice Chat Session
  const handleCloseVoiceChat = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (voiceRecognitionRef.current) {
      try {
        voiceRecognitionRef.current.abort();
      } catch (_) {}
    }
    setIsVoiceChatOpen(false);
    setVoiceChatStatus('idle');
    setVoiceLiveTranscript('');
  };

  const firstName =
    (profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Learner').split(' ')[0];
  const fieldOfStudy = profile?.field_of_study || user?.user_metadata?.field_of_study || 'Education';
  const subjects =
    (Array.isArray(profile?.subjects) ? profile.subjects.join(', ') : profile?.subjects) ||
    (Array.isArray(user?.user_metadata?.subjects)
      ? user.user_metadata.subjects.join(', ')
      : user?.user_metadata?.subjects) ||
    'core concepts';

  const buildDefaultSession = (): ChatSession => ({
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
  });

  const [deletedSessions, setDeletedSessions] = useState<Record<string, string>>(() =>
    safeStorage.getJSON<Record<string, string>>(getAiDeletedStorageKey(user?.id), {})
  );

  // Load chat sessions from user-scoped localStorage or default to single greeting session
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const del = safeStorage.getJSON<Record<string, string>>(getAiDeletedStorageKey(user?.id), {});
    const parsed = safeStorage.getJSON<ChatSession[]>(getAiChatsStorageKey(user?.id), []);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const merged = mergeAiChatSessions(parsed, [], del);
      if (merged.length > 0) return merged;
    }
    return [buildDefaultSession()];
  });

  // Track the ID of the active conversation thread
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const savedLastActive = safeStorage.getItem(getAiLastActiveStorageKey(user?.id));
    return savedLastActive || 'default_session';
  });

  // Tracks which user/guest scope has completed initial localStorage hydration so state transitions never overwrite another scope
  const [hydratedScope, setHydratedScope] = useState<string>(() => user?.id || 'guest');

  const lastSyncedDigestRef = useRef<string>('');
  const lastRemotePullAtRef = useRef<number>(0);

  // Hydrate latest Sage AI conversations on mount, user change, sync event, and window focus/visibility
  useEffect(() => {
    const scopeKey = user?.id || 'guest';
    const chatsKey = getAiChatsStorageKey(user?.id);
    const activeKey = getAiLastActiveStorageKey(user?.id);
    const delKey = getAiDeletedStorageKey(user?.id);

    const savedDeleted = safeStorage.getJSON<Record<string, string>>(delKey, {});
    const savedSessions = safeStorage.getJSON<ChatSession[]>(chatsKey, []);
    const savedActive = safeStorage.getItem(activeKey);

    setDeletedSessions(savedDeleted);
    setSessions(() => {
      const merged = mergeAiChatSessions(savedSessions, [], savedDeleted);
      return merged.length > 0 ? merged : [buildDefaultSession()];
    });
    if (savedActive) {
      setActiveSessionId(savedActive);
    } else if (savedSessions.length > 0 && savedSessions[0]?.id) {
      setActiveSessionId(savedSessions[0].id);
    } else {
      setActiveSessionId('default_session');
    }
    setHydratedScope(scopeKey);

    const handleExternalUpdated = (e: any) => {
      if (e?.detail?.userId && scopeKey !== e.detail.userId) return;
      const latestSaved = safeStorage.getJSON<ChatSession[]>(chatsKey, []);
      const latestDel = safeStorage.getJSON<Record<string, string>>(delKey, {});
      setDeletedSessions(latestDel);
      setSessions(prev => {
        const merged = mergeAiChatSessions(prev, latestSaved, latestDel);
        return merged.length > 0 ? merged : [buildDefaultSession()];
      });
    };

    const handleSyncUpdated = (e: any) => {
      if (e?.detail?.userId && user?.id && e.detail.userId !== user.id) return;
      const syncData = e?.detail?.sync;
      if (!syncData) return;

      const cloudDeleted = syncData.deletedAiSessions || {};
      const cloudSessions = Array.isArray(syncData.aiChatSessions) ? syncData.aiChatSessions : [];
      const cloudActive = syncData.activeAiSessionId;

      const localDeleted = safeStorage.getJSON<Record<string, string>>(delKey, {});
      const nextDeleted = mergeDeletedAiSessionsMap(localDeleted, cloudDeleted);

      setDeletedSessions(nextDeleted);
      setSessions(prev => {
        const merged = mergeAiChatSessions(prev, cloudSessions, nextDeleted);
        const finalSessions = merged.length > 0 ? merged : [buildDefaultSession()];
        const resolvedActive =
          (cloudActive && finalSessions.some((s: any) => s.id === cloudActive) && cloudActive) ||
          (finalSessions.some((s: any) => s.id === savedActive) && savedActive) ||
          finalSessions[0]?.id ||
          'default_session';

        lastSyncedDigestRef.current = computeAiSyncDigest(
          finalSessions,
          nextDeleted,
          resolvedActive
        );
        return finalSessions;
      });

      if (cloudActive || cloudSessions.length > 0 || savedSessions.length > 0) {
        setActiveSessionId(prevActive => {
          const currentLocal = safeStorage.getJSON<ChatSession[]>(chatsKey, []);
          const currentMerged = mergeAiChatSessions(currentLocal, cloudSessions, nextDeleted);
          const prevSession = currentMerged.find((s: any) => s.id === prevActive);
          const prevIsDefaultBlank =
            !prevSession || (prevSession.id === 'default_session' && (prevSession.messages?.length || 0) <= 1);
          if (cloudActive && currentMerged.some((s: any) => s.id === cloudActive) && prevIsDefaultBlank) {
            return cloudActive;
          }
          if (!prevSession && currentMerged[0]?.id) {
            return currentMerged[0].id;
          }
          return prevActive;
        });
      }
    };

    window.addEventListener(ACCOUNT_SYNC_EVENT, handleSyncUpdated);
    window.addEventListener('sage-ai-chats-updated', handleExternalUpdated);

    const pullRemoteLatest = (force = false) => {
      if (!user?.id) return;
      const now = Date.now();
      if (!force && now - lastRemotePullAtRef.current < 5000) return;
      lastRemotePullAtRef.current = now;
      void hydrateAccountSync(user);
    };

    pullRemoteLatest(true);

    const handleFocus = () => pullRemoteLatest(false);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        pullRemoteLatest(false);
      } else if (user?.id) {
        void flushPendingAccountSync(user.id);
      }
    };
    const handlePageHide = () => {
      if (user?.id) {
        void flushPendingAccountSync(user.id);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener(ACCOUNT_SYNC_EVENT, handleSyncUpdated);
      window.removeEventListener('sage-ai-chats-updated', handleExternalUpdated);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      if (user?.id) {
        void flushPendingAccountSync(user.id);
      }
    };
  }, [user?.id]);

  // Sync sessions, deletions & active thread to localStorage & cross-device cloud whenever updated
  useEffect(() => {
    const scopeKey = user?.id || 'guest';
    if (hydratedScope !== scopeKey) {
      return;
    }

    safeStorage.setJSON(getAiChatsStorageKey(user?.id), sessions);
    safeStorage.setJSON(getAiDeletedStorageKey(user?.id), deletedSessions);
    safeStorage.setItem(getAiLastActiveStorageKey(user?.id), activeSessionId);

    if (!user?.id) return;

    const currentDigest = computeAiSyncDigest(sessions, deletedSessions, activeSessionId);
    if (currentDigest === lastSyncedDigestRef.current) {
      return;
    }

    const hasMeaningfulHistory =
      sessions.some(
        (s) => s.id !== 'default_session' || (Array.isArray(s.messages) && s.messages.length > 1)
      ) ||
      sessions.length > 1 ||
      Object.keys(deletedSessions).length > 0;

    if (hasMeaningfulHistory) {
      lastSyncedDigestRef.current = currentDigest;
      pushAccountSyncPatch(
        user.id,
        {
          aiChatSessions: sessions,
          activeAiSessionId: activeSessionId,
          deletedAiSessions: deletedSessions,
        },
        undefined,
        { immediate: !isGenerating }
      );
    }
  }, [sessions, activeSessionId, deletedSessions, user?.id, isGenerating, hydratedScope]);

  // Support prefill prompts from platform search or contextual deep dives
  useEffect(() => {
    const prefill = safeStorage.getItem('ai_tutor_prefill');
    if (prefill) {
      setInput(prefill);
      safeStorage.removeItem('ai_tutor_prefill');
    }
  }, []);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0] || null;
  const messages = activeSession ? activeSession.messages : [];

  // Create a brand new session thread
  const handleStartNewChat = () => {
    const newId = Date.now().toString();
    const nowIso = new Date().toISOString();
    const newSessionState: ChatSession = {
      id: newId,
      title: 'New Conversation',
      createdAt: new Date().toLocaleDateString(),
      updatedAt: nowIso,
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

  // Delete a previous message thread (and record tombstone so other devices remove it too)
  const handleDeleteChat = (sessionIdToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent select row propagation

    const deletedAtIso = new Date().toISOString();
    setDeletedSessions(prev => ({
      ...prev,
      [sessionIdToDelete]: deletedAtIso,
    }));

    const remaining = sessions.filter(s => s.id !== sessionIdToDelete);
    if (remaining.length === 0) {
      const fallbackId = Date.now().toString();
      setSessions([
        {
          id: fallbackId,
          title: 'Introduction with Sage',
          createdAt: new Date().toLocaleDateString(),
          updatedAt: deletedAtIso,
          messages: [
            {
              id: '1',
              role: 'assistant',
              content: `Hello ${firstName}! I'm Sage AI. Ready to explore study sessions!`,
            }
          ]
        }
      ]);
      setActiveSessionId(fallbackId);
    } else {
      setSessions(remaining);
      if (activeSessionId === sessionIdToDelete) {
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

  // Helper to determine if a specific user inquiry is not answered or resulted in an error
  const isInputUnanswered = (msgIndex: number): boolean => {
    const nextMsg = messages[msgIndex + 1];
    if (!nextMsg) return true; // Last user message without a response
    if (nextMsg.role !== 'assistant') return true;
    if (!nextMsg.content || nextMsg.content.trim().length === 0) return true;
    const content = nextMsg.content.toLowerCase();
    if (
      content.includes('sorry, i encountered an error') ||
      content.includes('network error') ||
      content.includes('*(error:') ||
      content.includes('settings > secrets') ||
      content.includes('timed out') ||
      nextMsg.id.endsWith('err') ||
      nextMsg.id.endsWith('err2')
    ) {
      return true;
    }
    return false;
  };

  // Retry generating an answer for a specific user prompt
  const handleRetryPrompt = (promptText: string, msgIndex: number) => {
    if (isGenerating || !promptText.trim() || !activeSession) return;
    const baseMessages = messages.slice(0, msgIndex + 1);
    const nowIso = new Date().toISOString();
    setSessions(prev => prev.map(s => {
      if (s.id === activeSession.id) {
        return {
          ...s,
          updatedAt: nowIso,
          messages: baseMessages
        };
      }
      return s;
    }));
    handleSubmit(undefined, promptText.trim(), {
      skipAppendUserMessage: true,
      historyMessages: baseMessages.slice(0, -1),
    });
  };

  // Edit user input and re-submit
  const handleSaveEditAndRetry = (msgId: string, newText: string, msgIndex: number) => {
    const trimmed = newText.trim();
    if (!trimmed || isGenerating || !activeSession) return;

    setEditingMsgId(null);
    setEditInputText('');

    const updatedBase = messages.slice(0, msgIndex + 1).map((m) =>
      m.id === msgId ? { ...m, content: trimmed } : m
    );
    const nowIso = new Date().toISOString();

    setSessions(prev => prev.map(s => {
      if (s.id === activeSession.id) {
        return {
          ...s,
          updatedAt: nowIso,
          messages: updatedBase
        };
      }
      return s;
    }));

    handleSubmit(undefined, trimmed, {
      skipAppendUserMessage: true,
      historyMessages: updatedBase.slice(0, -1),
    });
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (liveStreamingText.trim() && activeSession) {
      const textToSave = liveStreamingText.trim();
      const nowIso = new Date().toISOString();
      setSessions(prev => prev.map(s => {
        if (s.id === activeSession.id) {
          return {
            ...s,
            updatedAt: nowIso,
            messages: [
              ...s.messages,
              {
                id: Date.now().toString() + 'ai',
                role: 'assistant',
                content: textToSave
              }
            ]
          };
        }
        return s;
      }));
    }
    setLiveStreamingText('');
    setLiveThoughtText('');
    setIsGenerating(false);
  };

  const handleSubmit = async (
    e?: React.FormEvent,
    directPrompt?: string,
    options?: { skipAppendUserMessage?: boolean; historyMessages?: Message[] }
  ) => {
    if (e) e.preventDefault();
    const rawPrompt = (directPrompt || input).trim();
    if ((!rawPrompt && !attachedFile) || !activeSession || isGenerating) return;

    let promptToSend = rawPrompt;
    if (attachedFile) {
      if (attachedFile.content) {
        promptToSend = `[Attached File: ${attachedFile.name}]\n\`\`\`\n${attachedFile.content}\n\`\`\`\n\n${rawPrompt || 'Please analyze this uploaded document and explain its key takeaways.'}`;
      } else {
        promptToSend = `[Attached File: ${attachedFile.name} (${attachedFile.size})]\n\n${rawPrompt || 'Please explain and provide study notes on this uploaded document.'}`;
      }
      setAttachedFile(null);
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!options?.skipAppendUserMessage) {
      setInput('');
    }
    setLiveStreamingText('');
    setLiveThoughtText('');
    setIsGenerating(true);

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: promptToSend };
    const startIso = new Date().toISOString();
    const targetSessionId =
      activeSession.id === 'default_session' ? `chat_${Date.now()}` : activeSession.id;

    if (!options?.skipAppendUserMessage) {
      if (targetSessionId !== activeSession.id) {
        setActiveSessionId(targetSessionId);
      }
      // Add user message to active session list, promote default_session to a unique immutable ID, and rename if needed
      setSessions(prev => prev.map(s => {
        if (s.id === activeSession.id) {
          let updatedTitle = s.title;
          if (s.title === 'Introduction with Sage' || s.title === 'New Conversation') {
            updatedTitle = promptToSend.length > 28 ? promptToSend.substring(0, 25) + '...' : promptToSend;
          }
          return {
            ...s,
            id: targetSessionId,
            title: updatedTitle,
            updatedAt: startIso,
            messages: [...s.messages, userMessage]
          };
        }
        return s;
      }));
    }

    const assistantMsgId = Date.now().toString() + 'ai';
    const historyToSend = (options?.historyMessages ?? messages).slice(-8).map(m => ({ role: m.role, content: m.content }));

    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, 60000);

    try {
      const allowDataCollection = JSON.parse(safeStorage.getItem('privacy_data') ?? 'true');
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: promptToSend,
          provider: provider,
          speedMode: speedMode,
          stream: true,
          history: historyToSend,
          allowDataCollection
        })
      });

      const contentType = response.headers.get('content-type') || '';
      const replyIso = new Date().toISOString();
      if (response.ok && contentType.includes('text/event-stream') && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';
        let accumulatedThought = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.thought) {
                accumulatedThought += parsed.thought;
                setLiveThoughtText(accumulatedThought);
              }
              if (parsed.text) {
                accumulated += parsed.text;
                setLiveStreamingText(accumulated);
              } else if (parsed.error) {
                accumulated += accumulated.trim() ? `\n\n*(Error: ${parsed.error})*` : String(parsed.error);
                setLiveStreamingText(accumulated);
              }
            } catch {
              // Partial line or JSON parse failure
            }
          }
        }

        // Flush any trailing line left in buffer
        const trailing = buffer.trim();
        if (trailing.startsWith('data:')) {
          const dataStr = trailing.slice(5).trim();
          if (dataStr && dataStr !== '[DONE]') {
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) accumulated += parsed.text;
              else if (parsed.error) accumulated += accumulated.trim() ? `\n\n*(Error: ${parsed.error})*` : String(parsed.error);
            } catch {}
          }
        }

        setSessions(prev => prev.map(s => {
          if (s.id === targetSessionId || s.id === activeSession.id) {
            return {
              ...s,
              updatedAt: new Date().toISOString(),
              messages: [
                ...s.messages,
                accumulated.trim()
                  ? {
                      id: assistantMsgId,
                      role: 'assistant',
                      content: accumulated.trim()
                    }
                  : {
                      id: Date.now().toString() + 'err',
                      role: 'assistant',
                      content: 'Sorry, I encountered an error receiving a response. Please click Retry.'
                    }
              ]
            };
          }
          return s;
        }));
      } else if (response.ok) {
        const data = await response.json();
        setSessions(prev => prev.map(s => {
          if (s.id === targetSessionId || s.id === activeSession.id) {
            return {
              ...s,
              updatedAt: replyIso,
              messages: [
                ...s.messages,
                { 
                  id: assistantMsgId, 
                  role: 'assistant', 
                  content: data.reply || '' 
                }
              ]
            };
          }
          return s;
        }));
      } else {
        const errorData = await response.json().catch(() => ({}));
        setSessions(prev => prev.map(s => {
          if (s.id === targetSessionId || s.id === activeSession.id) {
            return {
              ...s,
              updatedAt: replyIso,
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
    } catch (err: any) {
      if (err?.name === 'AbortError' && !didTimeout) {
        return;
      }
      setSessions(prev => prev.map(s => {
        if (s.id === targetSessionId || s.id === activeSession.id) {
          return {
            ...s,
            updatedAt: new Date().toISOString(),
            messages: [
              ...s.messages,
              { 
                id: Date.now().toString() + 'err2', 
                role: 'assistant', 
                content: didTimeout
                  ? 'Sorry, the request timed out before Sage finished responding. Please click Retry.'
                  : 'Sorry, I encountered a network error. Please try again.'
              }
            ]
          };
        }
        return s;
      }));
    } finally {
      window.clearTimeout(timeoutId);
      abortControllerRef.current = null;
      setLiveStreamingText('');
      setLiveThoughtText('');
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

  const filteredSessions = sessions.filter((sessionItem) => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return true;
    return (
      String(sessionItem.title || '').toLowerCase().includes(q) ||
      (Array.isArray(sessionItem.messages) &&
        sessionItem.messages.some((m) => String(m?.content || '').toLowerCase().includes(q)))
    );
  });

  const sidebarPanelContent = (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#161616]/75 dark:backdrop-blur-xl border-r border-slate-200/60 dark:border-white/10 font-sans select-none sidebar-pane">
      <div className="px-4 pb-4 pt-16 sm:pt-[72px] border-b border-slate-200/50 dark:border-white/10 shrink-0 space-y-2.5">
        <button
          onClick={handleStartNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 dark:bg-indigo-600/80 hover:bg-slate-800 dark:hover:bg-indigo-600 text-white font-semibold text-sm rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat Session</span>
        </button>

        {sessions.length > 3 && (
          <input
            type="text"
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            placeholder="Search chat history..."
            aria-label="Search chat history"
            className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
        <div className="flex items-center justify-between gap-2 px-2 pb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Chat History</span>
          </span>
          <span className="font-mono text-[11px]">{filteredSessions.length}</span>
        </div>

        {filteredSessions.map((sessionItem) => {
          const isActive = sessionItem.id === activeSessionId;
          const originLabel =
            sessionItem.source === 'reader' || sessionItem.id.startsWith('reader_')
              ? 'Book Reader'
              : sessionItem.source === 'edulab' || sessionItem.id.startsWith('edulab_')
              ? 'EduLab'
              : null;

          return (
            <div
              key={sessionItem.id}
              onClick={() => {
                setActiveSessionId(sessionItem.id);
                setIsMobileSidebarOpen(false);
              }}
              className={`group relative flex items-center gap-3 px-3 py-3 rounded-2xl cursor-pointer transition-all border ${
                isActive
                  ? 'bg-white dark:bg-[#1e1e1e] border-slate-200/80 dark:border-[#2f2f2f] shadow-sm text-slate-900 dark:text-[#EDEDED] font-semibold'
                  : 'bg-transparent border-transparent text-slate-600 dark:text-[#A0A0A0] hover:bg-slate-200/50 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-[#EDEDED]'
              }`}
            >
              <div className={`p-2 rounded-xl shrink-0 transition-colors ${
                isActive 
                  ? 'bg-brand-600 text-white shadow-xs' 
                  : 'bg-slate-100 dark:bg-[#202020] text-slate-500 dark:text-[#8E8E93] group-hover:text-brand-600 dark:group-hover:text-[#EDEDED]'
              }`}>
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              
              <div className="flex-1 min-w-0 pr-7">
                <p className="text-xs font-medium truncate leading-normal" title={sessionItem.title}>
                  {sessionItem.title}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-[#8E8E93] mt-0.5 truncate">
                  <Calendar className="w-2.5 h-2.5 shrink-0" />
                  <span>{sessionItem.createdAt}</span>
                  {originLabel && (
                    <>
                      <span>·</span>
                      <span className="text-indigo-500 dark:text-indigo-400 font-semibold">{originLabel}</span>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={(e) => handleDeleteChat(sessionItem.id, e)}
                className="absolute right-2 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg opacity-75 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-all cursor-pointer"
                title="Delete from Chat History"
                aria-label="Delete conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-200/50 dark:border-white/10 shrink-0 bg-slate-100/40 dark:bg-[#141414] text-[11px] text-slate-400 dark:text-[#8E8E93] flex items-center justify-between">
        <span>Saved Until You Delete</span>
        <span className="font-bold text-slate-500 dark:text-[#D1D1D6]">Sage AI Core</span>
      </div>
    </div>
  );

  return (
    <div className="flex h-full w-full bg-slate-50 dark:bg-[#121212] relative overflow-hidden font-sans main-canvas-bg">
      
      {/* Desktop Sidebar Panel */}
      <div 
        className={`hidden md:flex flex-col h-full shrink-0 border-slate-200/70 dark:border-white/10 transition-all duration-300 ease-in-out ${
          isDesktopSidebarOpen ? 'w-72 border-r' : 'w-0 border-none overflow-hidden'
        }`}
      >
        <div className="w-72 h-full flex flex-col">
          {sidebarPanelContent}
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
              className="md:hidden fixed top-0 bottom-0 left-0 w-72 h-full bg-white dark:bg-[#161616]/85 dark:backdrop-blur-2xl z-50 shadow-2xl border-r border-slate-200 dark:border-white/10 sidebar-pane"
            >
              {sidebarPanelContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Study Companion Panel - Cool, Smooth & Modern Box */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#121212] relative overflow-hidden main-canvas-bg">

        {/* Message Container Scroller */}
        <div className="flex-1 overflow-y-auto pt-16 sm:pt-20 pb-48 px-4 md:px-10 scroll-smooth relative">
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
                  <h3 className="text-xl font-bold font-display text-slate-900 dark:text-[#EDEDED]">
                    What would you like to master today?
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-[#A0A0A0] leading-relaxed">
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
                      className="text-left p-4 rounded-2xl bg-white dark:bg-[#181818] border border-slate-200/80 dark:border-[#282828] hover:border-brand-400 dark:hover:border-white/20 shadow-xs hover:shadow-md transition-all group flex flex-col justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#222222] group-hover:bg-brand-50 dark:group-hover:bg-brand-950/60 transition-colors">
                          {item.icon}
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-[#EDEDED] group-hover:text-brand-600 dark:group-hover:text-indigo-400 transition-colors">
                          {item.title}
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-[#A0A0A0] leading-relaxed">
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
                    <div className="group relative max-w-[85%] sm:max-w-[78%] flex flex-col items-end">
                      {editingMsgId === msg.id ? (
                        /* Inline Edit Mode */
                        <div className="w-full min-w-[260px] sm:min-w-[340px] bg-white dark:bg-[#1C1C1E] border border-brand-500 dark:border-brand-500 rounded-3xl p-3.5 shadow-xl shadow-brand-500/10 space-y-2.5">
                          <textarea
                            value={editInputText}
                            onChange={(e) => setEditInputText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSaveEditAndRetry(msg.id, editInputText, index);
                              } else if (e.key === 'Escape') {
                                setEditingMsgId(null);
                              }
                            }}
                            className="w-full bg-slate-50 dark:bg-[#282828] border border-slate-200 dark:border-[#383838] rounded-2xl p-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none min-h-[70px] scrollbar-thin"
                            autoFocus
                            rows={3}
                          />
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-slate-400">Esc to cancel • Enter to save</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingMsgId(null)}
                                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEditAndRetry(msg.id, editInputText, index)}
                                disabled={!editInputText.trim() || isGenerating}
                                className="px-3 py-1.5 text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                              >
                                Save & Retry
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Standard User Message Bubble + Action Icons Container */
                        <>
                          <div className="bg-gradient-to-br from-indigo-600 via-brand-600 to-purple-700 text-white px-5 py-3.5 rounded-3xl rounded-tr-sm text-[14.5px] sm:text-[15px] leading-relaxed break-words shadow-md shadow-brand-600/15 border border-white/15">
                            {msg.content}
                          </div>

                          {/* Action Toolbar: Retry (if unanswered or re-ask), Copy, Edit Pen */}
                          <div className="flex items-center gap-1 mt-1.5 px-1 select-none">
                            {/* Retry Icon - highlighted if unanswered, accessible on every input container */}
                            {isInputUnanswered(index) ? (
                              <button
                                type="button"
                                onClick={() => handleRetryPrompt(msg.content, index)}
                                disabled={isGenerating}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                                title="This inquiry is not answered yet. Click to retry generating response."
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Retry</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRetryPrompt(msg.content, index)}
                                disabled={isGenerating}
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
                                title="Retry / Re-ask this question"
                                aria-label="Retry inquiry"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Copy Icon */}
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg.id, msg.content)}
                              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer active:scale-95"
                              title="Copy input text"
                              aria-label="Copy input"
                            >
                              {copiedMsgId === msg.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Edit Pen Icon */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMsgId(msg.id);
                                setEditInputText(msg.content);
                              }}
                              disabled={isGenerating}
                              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
                              title="Edit input text"
                              aria-label="Edit input"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 sm:gap-4 w-full">
                      {/* AI Avatar */}
                      <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-brand-600 via-indigo-600 to-purple-600 flex items-center justify-center shrink-0 text-white shadow-sm shadow-brand-500/20 mt-1">
                        <AstroidIcon className="w-4 h-4" />
                      </div>

                      {/* AI Message Card */}
                      <div className="flex-1 min-w-0 bg-white dark:bg-[#181818] rounded-3xl p-5 sm:p-6 border border-slate-200/70 dark:border-[#282828] shadow-xs space-y-3">
                        <div className="gemini-markdown text-slate-800 dark:text-[#EDEDED] text-[14.5px] sm:text-[15px] leading-relaxed select-text overflow-x-auto">
                          <ReactMarkdown 
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>

                        {/* Action Bar: Copy & Speak TTS */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/10 text-slate-400 dark:text-[#8E8E93]">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleCopyMessage(msg.id, msg.content)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-[#222222] text-slate-500 dark:text-[#A0A0A0] hover:text-slate-800 dark:hover:text-[#EDEDED] transition-colors cursor-pointer"
                              title="Copy response to clipboard"
                            >
                              {copiedMsgId === msg.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied</span>
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
                                  ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 font-bold'
                                  : 'hover:bg-slate-100 dark:hover:bg-[#222222] text-slate-500 dark:text-[#A0A0A0] hover:text-slate-800 dark:hover:text-[#EDEDED]'
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

                          <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] uppercase tracking-wider font-semibold">
                            Sage Tutor
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))
            )}

            {/* Live Real-Time Streaming Assistant Response */}
            {isGenerating && (
              <motion.div 
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 sm:gap-4 w-full"
              >
                {/* AI Avatar */}
                <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-brand-600 via-indigo-600 to-purple-600 flex items-center justify-center shrink-0 text-white shadow-sm shadow-brand-500/20 mt-1">
                  <AstroidIcon className="w-4 h-4 animate-spin-slow" />
                </div>

                {/* Live Stream Card */}
                <div className="flex-1 min-w-0 bg-white dark:bg-[#181818] rounded-3xl p-5 sm:p-6 border border-brand-500/30 dark:border-indigo-500/30 shadow-md shadow-brand-500/5 space-y-3">
                  {/* Live Thinking Accordion (streaming thoughts as it reasons) */}
                  {liveThoughtText && (
                    <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/30 overflow-hidden text-xs">
                      <button
                        type="button"
                        onClick={() => setIsThoughtOpen(prev => !prev)}
                        className="w-full flex items-center justify-between px-3.5 py-2 text-indigo-700 dark:text-indigo-300 font-semibold cursor-pointer hover:bg-indigo-100/50 dark:hover:bg-indigo-900/40 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                          <span>Sage's Reasoning {liveStreamingText ? '(completed)' : '(thinking in real-time...)'}</span>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isThoughtOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isThoughtOpen && (
                        <div className="px-3.5 pb-2.5 pt-1 text-slate-600 dark:text-slate-300 font-mono text-[11px] leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap select-text">
                          {liveThoughtText}
                          {!liveStreamingText && (
                            <span className="inline-block w-1.5 h-3 ml-0.5 bg-indigo-500 animate-pulse rounded-full align-middle" />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Live Text Body (Streaming Word-by-Word in real time) */}
                  {liveStreamingText ? (
                    <div className="gemini-markdown text-slate-800 dark:text-[#EDEDED] text-[14.5px] sm:text-[15px] leading-relaxed select-text overflow-x-auto">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {liveStreamingText}
                      </ReactMarkdown>
                      <span className="inline-block w-1.5 h-4 ml-1 bg-brand-500 animate-pulse rounded-full align-middle shadow-xs shadow-brand-500" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 py-1 text-xs font-semibold text-slate-500 dark:text-[#D1D1D6]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span>
                        {liveThoughtText 
                          ? 'Formulating response from reasoning...' 
                          : speedMode === 'fast' 
                          ? 'Sage is answering instantly...' 
                          : 'Sage is thinking deeply...'}
                      </span>
                    </div>
                  )}

                  {/* Live streaming status tag */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/10 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5 text-brand-600 dark:text-brand-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-ping" />
                      Streaming live
                    </span>
                    <span>{speedMode === 'fast' ? 'Fast Mode' : 'Deep Think'}</span>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Floating Controls & Input Dock */}
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent dark:from-[#121212] dark:via-[#121212]/95 pt-8 pb-5 px-3 sm:px-6 z-20 pointer-events-none">
          <div className="max-w-3xl mx-auto flex flex-col items-center pointer-events-auto space-y-2.5">
            
            {/* Quick Prompt Helper Chips */}
            <div className="w-full flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide px-1">
              {quickPromptChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectStarterPrompt(chip.prompt)}
                  className="whitespace-nowrap px-3 py-1 text-[11px] font-semibold bg-white/90 dark:bg-[#181818] hover:bg-brand-50 dark:hover:bg-[#242424] hover:text-brand-700 dark:hover:text-[#EDEDED] text-slate-600 dark:text-[#D1D1D6] rounded-full border border-slate-200/80 dark:border-[#282828] shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Input Capsule Box - Sleek Manus AI / Cursor style messaging bar */}
            <form 
              onSubmit={(e) => handleSubmit(e)}
              className="relative flex flex-col w-full bg-white dark:bg-[#181818] border border-slate-200/90 dark:border-[#282828] shadow-xl shadow-slate-200/50 dark:shadow-black/60 rounded-2xl sm:rounded-3xl p-2 sm:p-2.5 focus-within:border-brand-500 dark:focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all backdrop-blur-xl"
            >
              {/* Hidden File Input for Plus button */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept=".pdf,.txt,.md,.doc,.docx,.csv,.json,.epub,image/*"
              />

              {/* Attached File Preview Badge (if any) */}
              {attachedFile && (
                <div className="flex items-center justify-between px-3 py-1.5 mx-1 mb-2 bg-brand-50 dark:bg-brand-950/60 border border-brand-200/80 dark:border-brand-800/80 rounded-xl text-xs text-brand-800 dark:text-brand-300">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                    <span className="font-semibold truncate max-w-[200px] sm:max-w-md">{attachedFile.name}</span>
                    <span className="text-[10px] text-brand-600/70 dark:text-brand-400/70 shrink-0">({attachedFile.size})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedFile(null)}
                    className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 p-1 rounded-lg transition-colors cursor-pointer"
                    title="Remove attached file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Auto-expanding text area that cleanly wraps text */}
              <div className="w-full relative px-1 sm:px-1.5 pt-0.5">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isListening ? "Listening... speak now" : "Ask Sage AI about concepts, formulas, book summaries..."}
                  className="w-full bg-transparent border-none focus:ring-0 focus:outline-none p-1 text-slate-900 dark:text-[#EDEDED] placeholder:text-slate-400 dark:placeholder:text-[#7A7A7A] text-sm font-medium leading-relaxed resize-none min-h-[40px] max-h-[100px] scrollbar-thin transition-[height] duration-75 block"
                  style={{ maxHeight: '100px' }}
                />
              </div>

              {/* Bottom Action Bar: Plus Attach on Left, Model + Mic + Send on Right */}
              <div className="flex items-center justify-between pt-1.5 px-0.5 mt-0.5 border-t border-slate-100/80 dark:border-[#282828]">
                {/* Plus icon on the left for uploading a file */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1.5 text-slate-500 dark:text-[#A0A0A0] hover:text-brand-600 dark:hover:text-[#EDEDED] hover:bg-slate-100 dark:hover:bg-[#222222] rounded-xl transition-all cursor-pointer active:scale-95 text-xs font-medium"
                    title="Upload a file or document"
                    aria-label="Upload file"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline text-xs">Attach</span>
                  </button>
                </div>

                {/* Controls on the Right: Speed Mode, Model Selector, Voice Mic, Send / Stop */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* Speed Mode Toggle (Fast vs Deep Think) */}
                  <button
                    type="button"
                    onClick={() => setSpeedMode(prev => prev === 'fast' ? 'deep' : 'fast')}
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-xl px-2.5 py-1.5 transition-all cursor-pointer border ${
                      speedMode === 'fast'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                        : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20'
                    }`}
                    title={speedMode === 'fast' ? "Fast Mode: Minimal thinking delay, instantaneous streamed response (Click to switch to Deep Think)" : "Deep Think Mode: Extended step-by-step reasoning (Click to switch to Fast Mode)"}
                  >
                    {speedMode === 'fast' ? (
                      <>
                        <Zap className="w-3.5 h-3.5 fill-current text-amber-500" />
                        <span>Fast</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Deep</span>
                      </>
                    )}
                  </button>

                  {/* Model Selector Mini Toggle */}
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as 'gemini' | 'anthropic')}
                    className="text-[11px] font-semibold bg-slate-100 dark:bg-[#202020] text-slate-600 dark:text-[#EDEDED] rounded-xl px-2.5 py-1.5 outline-none border border-transparent dark:border-[#282828] hover:border-slate-200 dark:hover:border-white/20 cursor-pointer transition-colors"
                    title="Choose AI Model"
                  >
                    <option value="gemini">Gemini 4 Flash</option>
                    <option value="anthropic">Claude 3.7</option>
                  </select>

                  {/* Microphone icon on the right for voice input */}
                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    className={`p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer shrink-0 ${
                      isListening
                        ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30 ring-2 ring-rose-400/50'
                        : 'text-slate-500 dark:text-[#A0A0A0] hover:text-brand-600 dark:hover:text-[#EDEDED] hover:bg-slate-100 dark:hover:bg-[#222222] active:scale-95'
                    }`}
                    title={isListening ? "Listening... click to stop recording" : "Voice input (Speech to text)"}
                    aria-label={isListening ? "Stop voice input" : "Start voice input"}
                  >
                    {isListening ? (
                      <MicOff className="w-4 h-4 text-white" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </button>

                  {/* Interactive Voice Chat with Sage Button (Sage talks back & interacts) */}
                  <motion.button 
                    whileTap={{ scale: 0.92 }}
                    type="button"
                    onClick={handleOpenVoiceChat}
                    className="p-1.5 sm:p-2 bg-gradient-to-tr from-purple-600 via-indigo-600 to-brand-600 hover:from-purple-500 hover:to-brand-500 text-white rounded-xl transition-all shadow-sm shadow-purple-500/20 flex items-center justify-center shrink-0 cursor-pointer active:scale-95 group"
                    title="Interactive Voice Chat with Sage (Sage talks back)"
                    aria-label="Start Voice Chat with Sage"
                  >
                    <AudioLines className="w-4 h-4 text-purple-100 group-hover:scale-110 transition-transform" />
                  </motion.button>

                  {/* Send / Stop Button */}
                  {isGenerating ? (
                    <motion.button 
                      whileTap={{ scale: 0.92 }}
                      type="button"
                      onClick={handleStopGeneration}
                      className="p-1.5 sm:p-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-all shadow-sm shadow-rose-500/20 flex items-center justify-center shrink-0 cursor-pointer active:scale-95 animate-pulse"
                      title="Stop response generation"
                      aria-label="Stop response generation"
                    >
                      <Square className="w-4 h-4 fill-current" />
                    </motion.button>
                  ) : (
                    <motion.button 
                      whileTap={{ scale: 0.92 }}
                      type="submit"
                      disabled={!input.trim() && !attachedFile}
                      className="p-1.5 sm:p-2 bg-gradient-to-tr from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 disabled:opacity-40 disabled:hover:from-brand-600 disabled:hover:to-indigo-600 text-white rounded-xl transition-all shadow-sm shadow-brand-500/20 flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
                      title="Send message (Enter)"
                      aria-label="Send message"
                    >
                      <Send className="w-4 h-4" />
                    </motion.button>
                  )}
                </div>
              </div>
            </form>

            <div className="w-full flex justify-between items-center px-2 text-[10px] text-slate-400 font-semibold">
              <span>{messages.length} messages in conversation</span>
              <span>LaTeX math formulas & markdown supported</span>
            </div>

          </div>
        </div>

      </div>

      {/* Interactive Voice Chat with Sage Overlay Modal */}
      <AnimatePresence>
        {isVoiceChatOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-2xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center overflow-hidden"
            >
              {/* Close Button top-right */}
              <button
                type="button"
                onClick={handleCloseVoiceChat}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                title="End Voice Chat"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold mb-4">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live Interactive Voice • Sage AI</span>
              </div>

              {/* Pulsing Visualizer Sound Orb */}
              <div className="relative w-40 h-40 sm:w-48 sm:h-48 my-2 flex items-center justify-center">
                {/* Background Ambient Glow */}
                <div 
                  className={`absolute inset-0 rounded-full blur-2xl transition-all duration-500 ${
                    voiceChatStatus === 'speaking'
                      ? 'bg-gradient-to-tr from-purple-500/40 via-indigo-500/40 to-brand-500/40 scale-125'
                      : voiceChatStatus === 'listening'
                      ? 'bg-gradient-to-tr from-emerald-500/35 via-teal-500/35 to-cyan-500/35 scale-110'
                      : 'bg-brand-500/20 scale-100'
                  }`} 
                />

                {/* Animated Pulsing Outer Rings */}
                {voiceChatStatus === 'speaking' && (
                  <>
                    <div className="absolute inset-0 rounded-full border-2 border-indigo-400/30 animate-ping" />
                    <div className="absolute -inset-4 rounded-full border border-purple-400/20 animate-pulse" />
                  </>
                )}
                {voiceChatStatus === 'listening' && (
                  <div className="absolute -inset-3 rounded-full border-2 border-emerald-400/40 animate-pulse" />
                )}

                {/* Core Glowing Orb */}
                <div 
                  className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center shadow-xl transition-all duration-300 ${
                    voiceChatStatus === 'speaking'
                      ? 'bg-gradient-to-tr from-purple-600 via-indigo-600 to-brand-500 shadow-indigo-500/50 scale-105'
                      : voiceChatStatus === 'listening'
                      ? 'bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-600 shadow-emerald-500/40 scale-100'
                      : 'bg-gradient-to-tr from-slate-700 to-slate-800 shadow-slate-900 scale-95'
                  }`}
                >
                  {voiceChatStatus === 'speaking' ? (
                    <Volume2 className="w-10 h-10 text-white animate-pulse" />
                  ) : voiceChatStatus === 'listening' ? (
                    <Mic className="w-10 h-10 text-white animate-bounce" />
                  ) : (
                    <Sparkles className="w-10 h-10 text-brand-300 animate-spin" />
                  )}

                  {/* Simulated wave bars inside orb when speaking */}
                  {voiceChatStatus === 'speaking' && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="w-1 h-3 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-2 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              </div>

              {/* Status Indicator */}
              <div className="space-y-1 mb-4">
                <h4 className="text-lg font-bold text-white capitalize">
                  {voiceChatStatus === 'speaking'
                    ? 'Sage is Speaking...'
                    : voiceChatStatus === 'thinking'
                    ? 'Sage is Thinking...'
                    : 'Listening to You...'}
                </h4>
                <p className="text-xs text-slate-400">
                  {voiceChatStatus === 'listening'
                    ? 'Speak naturally. Sage will answer out loud.'
                    : voiceChatStatus === 'speaking'
                    ? 'Listening will automatically resume when Sage finishes.'
                    : 'Crafting the clearest educational response...'}
                </p>
              </div>

              {/* Live Transcript / Subtitle Bubble */}
              <div className="w-full bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 min-h-[85px] max-h-[140px] overflow-y-auto mb-6 text-left scrollbar-thin">
                {voiceLiveTranscript ? (
                  <div className="text-sm text-emerald-300">
                    <span className="text-[10px] text-emerald-500 uppercase tracking-wider block font-bold mb-1">You:</span>
                    "{voiceLiveTranscript}"
                  </div>
                ) : voiceLastAiReply ? (
                  <div className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                    <span className="text-[10px] text-brand-400 uppercase tracking-wider block font-bold mb-1">Sage:</span>
                    {voiceLastAiReply}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic text-center pt-4">
                    Ready to converse. Say hello or ask any study question!
                  </p>
                )}
              </div>

              {/* Action Controls Toolbar */}
              <div className="flex items-center gap-3">
                {voiceChatStatus === 'speaking' ? (
                  <button
                    type="button"
                    onClick={() => {
                      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                      setVoiceChatStatus('listening');
                      startVoiceChatListening();
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 text-rose-400" />
                    <span>Interrupt / Speak Next</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (voiceChatStatus === 'listening') {
                        setVoiceChatStatus('idle');
                        if (voiceRecognitionRef.current) voiceRecognitionRef.current.abort();
                      } else {
                        startVoiceChatListening();
                      }
                    }}
                    className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      voiceChatStatus === 'listening'
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>{voiceChatStatus === 'listening' ? 'Listening Active' : 'Start Mic'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCloseVoiceChat}
                  className="px-4 py-2 bg-rose-600/90 hover:bg-rose-500 text-white rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-rose-600/30"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>End Voice Chat</span>
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
