import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { 
  Send, 
  Sparkles, 
  X, 
  Minus, 
  Maximize2, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Copy, 
  Check, 
  BookOpen, 
  HelpCircle, 
  Lightbulb, 
  Move, 
  Mic, 
  MicOff,
  ChevronDown,
  Square,
  Pencil
} from 'lucide-react';
import { AstroidIcon } from './icons/AstroidIcon';
import { Book } from '../types';
import { triggerCapsuleFeedback } from '../lib/feedback';
import { safeStorage } from '../lib/safeStorage';
import {
  getReaderChatStorageKey,
  mergeChatMessagesArray,
  pushAccountSyncPatch,
  flushPendingAccountSync,
  hydrateAccountSync,
  recordExternalSageChatSession,
  ACCOUNT_SYNC_EVENT,
} from '../lib/accountSyncService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ReaderAiHoverTutorProps {
  book: Book;
  pageNumber: number;
  numPages: number | null;
  theme: 'sepia' | 'dark' | 'amoled';
  isOpen: boolean;
  onToggleOpen: () => void;
  selectedText: string | null;
  onClearSelectedText: () => void;
  onOpenFullAi: () => void;
  user?: any;
}

export function ReaderAiHoverTutor({
  book,
  pageNumber,
  numPages,
  theme,
  isOpen,
  onToggleOpen,
  selectedText,
  onClearSelectedText,
  onOpenFullAi,
  user,
}: ReaderAiHoverTutorProps) {
  const buildWelcomeMessages = (): Message[] => {
    const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Learner';
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: `Hello ${firstName}! I'm **Sage AI**, your dedicated reading tutor for *${book.title}*.\n\nAsk me any question about page **${pageNumber}**, formulas, or complex concepts and I'll explain them right here so you never have to leave your reading!`
      }
    ];
  };

  const skipCloudPushRef = useRef(true);

  const [messages, setMessages] = useState<Message[]>(() => {
    const scopedKey = getReaderChatStorageKey(book.id, user?.id);
    const scopedSaved = safeStorage.getJSON<Message[]>(scopedKey, []);
    if (Array.isArray(scopedSaved) && scopedSaved.length > 0) return scopedSaved;

    const legacySaved = safeStorage.getJSON<Message[]>(`sage_reader_chat_${book.id}`, []);
    if (Array.isArray(legacySaved) && legacySaved.length > 0) return legacySaved;

    return buildWelcomeMessages();
  });

  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [liveStreamingText, setLiveStreamingText] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Hydrate when book, user, or cross-device sync changes
  useEffect(() => {
    const scopedKey = getReaderChatStorageKey(book.id, user?.id);
    const scopedSaved = safeStorage.getJSON<Message[]>(scopedKey, []);
    if (Array.isArray(scopedSaved) && scopedSaved.length > 0) {
      skipCloudPushRef.current = true;
      setMessages(scopedSaved);
    }

    const handleSyncUpdated = (e: any) => {
      if (e?.detail?.userId && user?.id && e.detail.userId !== user.id) return;
      const cloudMsgs = e?.detail?.sync?.readerChats?.[book.id];
      if (Array.isArray(cloudMsgs) && cloudMsgs.length > 0) {
        skipCloudPushRef.current = true;
        setMessages((prev) => mergeChatMessagesArray(prev, cloudMsgs));
      }
    };

    window.addEventListener(ACCOUNT_SYNC_EVENT, handleSyncUpdated);
    if (user?.id && isOpen) {
      void hydrateAccountSync(user);
    }

    return () => {
      window.removeEventListener(ACCOUNT_SYNC_EVENT, handleSyncUpdated);
      if (user?.id) {
        void flushPendingAccountSync(user.id);
      }
    };
  }, [book.id, user?.id, isOpen]);

  // Track active reader thread suffix so clicking "New Conversation" never erases earlier reader chats from Chat History
  const [threadIdSuffix, setThreadIdSuffix] = useState<string>('');

  // Sync messages to user-scoped storage, cloud per book, and unified Sage Chat History
  useEffect(() => {
    const scopedKey = getReaderChatStorageKey(book.id, user?.id);
    safeStorage.setJSON(scopedKey, messages);

    if (skipCloudPushRef.current) {
      skipCloudPushRef.current = false;
      return;
    }

    const hasUserActivity = messages.some((m) => m.role === 'user');
    if (hasUserActivity) {
      recordExternalSageChatSession(user?.id, {
        id: threadIdSuffix ? `reader_${book.id}_${threadIdSuffix}` : `reader_${book.id}`,
        title: `Book: ${book.title}`,
        source: 'reader',
        updatedAt: new Date().toISOString(),
        messages,
      });
    }

    if (user?.id && hasUserActivity) {
      pushAccountSyncPatch(
        user.id,
        { readerChats: { [book.id]: messages } },
        undefined,
        { immediate: !isGenerating }
      );
    }
  }, [messages, book.id, book.title, user?.id, isGenerating, threadIdSuffix]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isGenerating, isOpen]);

  // Handle selected text input
  useEffect(() => {
    if (selectedText && selectedText.trim().length > 0) {
      // Focus and set prompt context
      setInput(`Explain this excerpt from page ${pageNumber}: "${selectedText.trim()}"`);
      inputRef.current?.focus();
    }
  }, [selectedText, pageNumber]);

  // Initialize Web Speech Recognition if available
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognizer = new SpeechRecognition();
      recognizer.continuous = false;
      recognizer.interimResults = false;
      recognizer.lang = 'en-US';

      recognizer.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
        setIsListening(false);
      };

      recognizer.onerror = () => setIsListening(false);
      recognizer.onend = () => setIsListening(false);

      recognitionRef.current = recognizer;
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!speechSupported || !recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Speech recognition error:', err);
        setIsListening(false);
      }
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      triggerCapsuleFeedback({ pitch: 720, volume: 0.12, hapticDuration: 10 });
    } catch (err) {
      console.warn('Copy failed', err);
    }
  };

  const handleSpeak = (id: string, text: string) => {
    if (!('speechSynthesis' in window)) return;

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text
      .replace(/[*_#`~[\]]/g, '')
      .replace(/\$\$[\s\S]*?\$\$/g, ' mathematical formula ')
      .replace(/\$[^$]*\$/g, ' formula ')
      .replace(/\n+/g, ' ');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
    triggerCapsuleFeedback({ pitch: 600, volume: 0.14, hapticDuration: 12 });
  };

  const handleResetChat = () => {
    triggerCapsuleFeedback({ pitch: 480, volume: 0.15, hapticDuration: 15 });
    // Preserve any previous conversation in unified Chat History before starting a fresh popup thread
    if (messages.some((m) => m.role === 'user')) {
      recordExternalSageChatSession(user?.id, {
        id: threadIdSuffix ? `reader_${book.id}_${threadIdSuffix}` : `reader_${book.id}`,
        title: `Book: ${book.title}`,
        source: 'reader',
        updatedAt: new Date().toISOString(),
        messages,
      });
    }
    const nextSuffix = String(Date.now());
    setThreadIdSuffix(nextSuffix);
    const freshMessages: Message[] = [
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Started a fresh conversation thread (previous messages remain saved in Chat History). What would you like to explore on page **${pageNumber}** of *${book.title}*?`
      }
    ];
    skipCloudPushRef.current = true;
    setMessages(freshMessages);
  };

  const isInputUnanswered = (msgIndex: number): boolean => {
    const nextMsg = messages[msgIndex + 1];
    if (!nextMsg) return true;
    if (nextMsg.role !== 'assistant') return true;
    if (!nextMsg.content || nextMsg.content.trim().length === 0) return true;
    const content = nextMsg.content.toLowerCase();
    return content.includes('error') || nextMsg.id.includes('err');
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (liveStreamingText.trim()) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + '_ai',
          role: 'assistant',
          content: liveStreamingText.trim(),
        },
      ]);
    }
    setLiveStreamingText('');
    setIsGenerating(false);
  };

  const handleSubmit = async (directPrompt?: string) => {
    const promptToSend = (directPrompt || input).trim();
    if (!promptToSend || isGenerating) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    triggerCapsuleFeedback({ pitch: 680, volume: 0.15, hapticDuration: 14 });
    setInput('');
    setLiveStreamingText('');
    if (selectedText) onClearSelectedText();
    setIsGenerating(true);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: promptToSend,
    };

    setMessages((prev) => [...prev, userMsg]);

    const assistantMsgId = Date.now().toString() + '_ai';

    try {
      const allowDataCollection = JSON.parse(localStorage.getItem('privacy_data') ?? 'true');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: promptToSend,
          provider: 'qwen3',
          speedMode: 'fast',
          stream: true,
          allowDataCollection,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          bookContext: {
            title: book.title,
            author: book.author,
            page: pageNumber,
            numPages: numPages || undefined,
            description: book.description,
            selectedText: selectedText || undefined
          }
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('text/event-stream') && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';

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
            if (dataStr === '[DONE]') break;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                accumulated += parsed.text;
                setLiveStreamingText(accumulated);
              } else if (parsed.error) {
                accumulated += `\n\n*(Error: ${parsed.error})*`;
                setLiveStreamingText(accumulated);
              }
            } catch {
              // Partial JSON chunk
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
              else if (parsed.error) accumulated += `\n\n*(Error: ${parsed.error})*`;
            } catch {}
          }
        }

        setMessages((prev) => [
          ...prev,
          accumulated.trim()
            ? {
                id: assistantMsgId,
                role: 'assistant',
                content: accumulated.trim(),
              }
            : {
                id: Date.now().toString() + '_err',
                role: 'assistant',
                content: 'Sorry, I encountered an error receiving a response. Please click Retry.',
              },
        ]);
      } else if (response.ok) {
        const data = await response.json();
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            content: data.reply || 'I analyzed the book context for you.',
          },
        ]);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + '_err',
            role: 'assistant',
            content: errorData.error || `Could not complete AI request (HTTP ${response.status}). Please retry.`,
          },
        ]);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + '_net_err',
          role: 'assistant',
          content: 'Could not reach the AI Tutor service. Please check your connection and retry.',
        },
      ]);
    } finally {
      abortControllerRef.current = null;
      setLiveStreamingText('');
      setIsGenerating(false);
    }
  };

  const quickPrompts = [
    { label: `💡 Summarize p. ${pageNumber}`, text: `Summarize the main concepts and takeaways of page ${pageNumber} in 3 crisp bullet points.` },
    { label: '📐 Formulas & Key Terms', text: `What are the crucial formulas, definitions, and technical terms introduced in this section of ${book.title}?` },
    { label: '❓ Quiz Me on This', text: `Give me 2 quick multiple-choice or short-answer check questions based on the concepts on page ${pageNumber}.` },
    { label: '🌱 Simple Analogy', text: `Explain the main concept on page ${pageNumber} using a simple, intuitive real-world analogy.` },
  ];

  // Card theme styling
  const cardThemeClasses = 
    theme === 'amoled'
      ? 'bg-black/95 text-white border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.85)]'
      : theme === 'dark'
      ? 'bg-[#121620]/95 text-slate-100 border-slate-700/80 shadow-[0_20px_50px_rgba(0,0,0,0.65)]'
      : 'bg-[#FAF7F0]/95 text-stone-900 border-[#E5DECD] shadow-[0_20px_45px_rgba(40,30,20,0.18)]';

  const innerBubbleAi = 
    theme === 'amoled'
      ? 'bg-[#141414] text-white border border-white/10'
      : theme === 'dark'
      ? 'bg-[#1E2536] text-slate-100 border border-slate-700/60'
      : 'bg-white text-stone-800 border border-stone-200/80 shadow-xs';

  return (
    <>
      {/* 1. Minimized Floating Capsule / Badge Trigger (When closed or minimized) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="fixed bottom-24 right-5 sm:right-8 z-40"
          >
            <button
              onClick={() => {
                triggerCapsuleFeedback({ pitch: 700, volume: 0.15, hapticDuration: 12 });
                onToggleOpen();
              }}
              className="group relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-full liquid-glass-dock hover:scale-105 active:scale-95 transition-all shadow-xl cursor-pointer border border-brand-400/40 dark:border-brand-500/30 text-stone-800 dark:text-stone-100"
              title="Open Sage AI Reading Tutor"
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-brand-500/30">
                  <AstroidIcon className="w-4 h-4 animate-spin-slow" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
              </div>

              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold font-display text-brand-700 dark:text-brand-300">Sage AI Tutor</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-brand-500/15 text-brand-700 dark:text-brand-300 font-semibold">
                    p.{pageNumber}
                  </span>
                </div>
                <span className="text-[10px] text-stone-500 dark:text-stone-400 leading-tight">
                  Hovering · Ask any question
                </span>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Full Hovering Tutor Card Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            drag
            dragMomentum={false}
            dragElastic={0.06}
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className={`fixed bottom-20 right-4 sm:right-8 z-40 w-[calc(100vw-32px)] sm:w-[380px] max-h-[580px] flex flex-col rounded-3xl backdrop-blur-2xl border ${cardThemeClasses} overflow-hidden font-sans select-none`}
            style={{
              touchAction: 'none'
            }}
          >
            {/* Specular Highlight Strip */}
            <div className="absolute top-0 inset-x-6 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/30 to-transparent pointer-events-none" />

            {/* Header: Draggable Grip + Mascot + Actions */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200/50 dark:border-white/10 bg-white/20 dark:bg-black/20 cursor-grab active:cursor-grabbing">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-sm">
                    <AstroidIcon className="w-3.5 h-3.5" />
                  </div>
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-white dark:border-slate-900 animate-pulse" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs sm:text-sm font-display tracking-tight truncate">Sage AI Tutor</span>
                    <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Grounded
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-500 dark:text-stone-400 truncate max-w-[190px]">
                    {book.title} · Page {pageNumber}{numPages ? ` of ${numPages}` : ''}
                  </p>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Reset / New Chat */}
                <button
                  onClick={handleResetChat}
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors cursor-pointer"
                  title="Reset conversation for this book"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                {/* Open Full Sage AI Page */}
                <button
                  onClick={() => {
                    localStorage.setItem('ai_tutor_prefill', `Regarding "${book.title}" (Page ${pageNumber}): `);
                    onOpenFullAi();
                  }}
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors cursor-pointer"
                  title="Open full Sage AI page"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>

                {/* Minimize Button */}
                <button
                  onClick={() => {
                    triggerCapsuleFeedback({ pitch: 500, volume: 0.1, hapticDuration: 8 });
                    onToggleOpen();
                  }}
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors cursor-pointer"
                  title="Minimize hover tutor"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Context Notice / Highlight Chip (if user selected text) */}
            {selectedText && (
              <div className="px-3.5 py-2 bg-brand-500/10 dark:bg-brand-500/15 border-b border-brand-500/20 flex items-center justify-between text-[11px] gap-2">
                <div className="flex items-center gap-1.5 min-w-0 text-brand-700 dark:text-brand-300">
                  <Sparkles className="w-3 h-3 shrink-0 animate-pulse" />
                  <span className="truncate italic">"{selectedText}"</span>
                </div>
                <button
                  onClick={onClearSelectedText}
                  className="p-0.5 rounded hover:bg-brand-500/20 text-brand-600 dark:text-brand-300"
                  title="Clear excerpt"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 max-h-[340px] text-xs sm:text-[13px] leading-relaxed select-text">
              {messages.map((msg, index) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  {msg.role === 'user' ? (
                    <div className="flex flex-col items-end max-w-[88%] group">
                      <div className="bg-gradient-to-r from-brand-600 to-indigo-600 text-white px-3.5 py-2 rounded-2xl rounded-tr-xs shadow-sm leading-relaxed">
                        {msg.content}
                      </div>
                      <div className="flex items-center gap-1 mt-1 px-1">
                        {isInputUnanswered(index) ? (
                          <button
                            type="button"
                            onClick={() => handleSubmit(msg.content)}
                            disabled={isGenerating}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-lg transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                            title="Retry generating response"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Retry</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSubmit(msg.content)}
                            disabled={isGenerating}
                            className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                            title="Retry prompt"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                          title="Copy input text"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInput(msg.content);
                            inputRef.current?.focus();
                          }}
                          disabled={isGenerating}
                          className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                          title="Edit input text in composer"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={`p-3 rounded-2xl rounded-tl-xs max-w-[95%] space-y-2 ${innerBubbleAi}`}>
                      <div className="gemini-markdown overflow-x-auto select-text">
                        <ReactMarkdown 
                          remarkPlugins={[remarkMath]} 
                          rehypePlugins={[rehypeKatex]}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>

                      {/* Action buttons (Copy + Speak) */}
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-stone-200/40 dark:border-white/5 text-stone-400">
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-[10px] font-medium transition-colors"
                          title="Copy response"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-600 font-bold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleSpeak(msg.id, msg.content)}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-[10px] font-medium transition-colors"
                          title="Listen to explanation"
                        >
                          {speakingId === msg.id ? (
                            <>
                              <VolumeX className="w-3 h-3 text-brand-600 animate-pulse" />
                              <span className="text-brand-600 font-bold">Stop</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3" />
                              <span>Listen</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isGenerating && (
                <div className={`p-3 rounded-2xl rounded-tl-xs max-w-[85%] text-xs space-y-2 ${innerBubbleAi}`}>
                  {liveStreamingText ? (
                    <div className="gemini-markdown leading-relaxed select-text">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {liveStreamingText}
                      </ReactMarkdown>
                      <span className="inline-block w-1.5 h-3 ml-1 bg-brand-500 animate-pulse rounded-full align-middle shadow-xs" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-brand-600 animate-ping" />
                      <span className="text-stone-500 dark:text-stone-400 italic">
                        Sage is analyzing page {pageNumber}...
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestions Carousel */}
            <div className="px-3 pt-2 pb-1 border-t border-stone-200/50 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] overflow-x-auto no-scrollbar flex items-center gap-1.5">
              {quickPrompts.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSubmit(qp.text)}
                  disabled={isGenerating}
                  className="whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-medium bg-white/60 dark:bg-white/5 hover:bg-brand-500/10 dark:hover:bg-brand-500/20 text-stone-600 dark:text-stone-300 hover:text-brand-700 dark:hover:text-brand-300 border border-stone-200/60 dark:border-white/10 transition-all shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {qp.label}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="p-3 bg-white/40 dark:bg-black/30 border-t border-stone-200/50 dark:border-white/10 flex items-center gap-2"
            >
              <div className="flex-1 relative flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Ask Sage anything about p. ${pageNumber}...`}
                  className="w-full pl-3 pr-8 py-2 text-xs rounded-xl bg-white/80 dark:bg-slate-900/80 border border-stone-200 dark:border-slate-700 text-stone-800 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all"
                />

                {speechSupported && (
                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    className={`absolute right-2 p-1 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors ${
                      isListening ? 'text-red-500 animate-pulse' : ''
                    }`}
                    title={isListening ? 'Listening...' : 'Voice prompt'}
                  >
                    {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>

              {isGenerating ? (
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white active:scale-95 transition-all shadow-sm cursor-pointer shrink-0 animate-pulse"
                  title="Stop generating"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="p-2 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white hover:opacity-95 active:scale-95 disabled:opacity-40 transition-all shadow-sm cursor-pointer shrink-0"
                  title="Send inquiry"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
