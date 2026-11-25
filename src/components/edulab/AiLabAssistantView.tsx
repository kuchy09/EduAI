import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Plus,
  AlertTriangle,
  FlaskConical,
  Loader2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { safeStorage } from '../../lib/safeStorage';
import { recordExternalSageChatSession } from '../../lib/accountSyncService';
import {
  LabExperimentId,
  LabTrialRecord,
  PRACTICALS_CATALOG,
} from './edulabTypes';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AiLabAssistantViewProps {
  user?: any;
  activePracticalId: LabExperimentId;
  trials: LabTrialRecord[];
}

const STARTER_PROMPTS = [
  'Why does increasing temperature double the rate of CO₂ gas evolution in the marble chips experiment?',
  'Explain how to identify Cu²⁺, Fe²⁺, and Zn²⁺ cations using aqueous NaOH and NH₃.',
  'How do I calculate total resistance and branch currents in a parallel DC circuit?',
  'Walk me through solving unknown molarity in a 25 cm³ acid–base titration.',
];

export function AiLabAssistantView({
  user,
  activePracticalId,
  trials,
}: AiLabAssistantViewProps) {
  const userKey = user?.id || 'guest';
  const labChatsStorageKey = `edulab_ai_chats_v1_${userKey}`;

  const [selectedPracticalId, setSelectedPracticalId] =
    useState<LabExperimentId | 'general'>(activePracticalId);
  const [threadSuffixByKey, setThreadSuffixByKey] = useState<
    Record<string, string>
  >({});
  const [chatsByContext, setChatsByContext] = useState<
    Record<string, ChatTurn[]>
  >(() => safeStorage.getJSON<Record<string, ChatTurn[]>>(labChatsStorageKey, {}));
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = safeStorage.getJSON<Record<string, ChatTurn[]>>(
      labChatsStorageKey,
      {}
    );
    setChatsByContext(saved);
  }, [labChatsStorageKey]);

  const messages = chatsByContext[selectedPracticalId] || [];

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages.length, isLoading]);

  const contextMeta =
    selectedPracticalId === 'general'
      ? null
      : PRACTICALS_CATALOG.find((p) => p.id === selectedPracticalId) || null;

  const recentContextTrials =
    selectedPracticalId === 'general'
      ? trials.slice(0, 3)
      : trials.filter((t) => t.experiment === selectedPracticalId).slice(0, 3);

  const persistLabMessages = (
    contextId: LabExperimentId | 'general',
    nextTurns: ChatTurn[],
    overrideSuffix?: string
  ) => {
    setChatsByContext((prev) => {
      const updated = { ...prev, [contextId]: nextTurns };
      safeStorage.setJSON(labChatsStorageKey, updated);
      return updated;
    });

    const suffix = overrideSuffix ?? threadSuffixByKey[contextId];
    const meta =
      contextId === 'general'
        ? null
        : PRACTICALS_CATALOG.find((p) => p.id === contextId) || null;

    if (nextTurns.some((m) => m.role === 'user')) {
      recordExternalSageChatSession(user?.id, {
        id: suffix ? `edulab_${contextId}_${suffix}` : `edulab_${contextId}`,
        title: `EduLab: ${meta?.label || 'General Science Lab'}`,
        source: 'edulab',
        updatedAt: new Date().toISOString(),
        messages: nextTurns,
      });
    }
  };

  const handleStartNewThread = () => {
    if (messages.some((m) => m.role === 'user')) {
      persistLabMessages(selectedPracticalId, messages);
    }
    const nextSuffix = String(Date.now());
    setThreadSuffixByKey((prev) => ({
      ...prev,
      [selectedPracticalId]: nextSuffix,
    }));
    setChatsByContext((prev) => {
      const updated = { ...prev, [selectedPracticalId]: [] };
      safeStorage.setJSON(labChatsStorageKey, updated);
      return updated;
    });
    setErrorMsg(null);
  };

  const sendMessage = async (textOverride?: string) => {
    const promptText = (textOverride ?? input).trim();
    if (!promptText || isLoading) return;

    const targetContext = selectedPracticalId;
    setErrorMsg(null);
    if (!textOverride) setInput('');

    const nowMs = Date.now();
    const userTurn: ChatTurn = {
      id: `${nowMs}`,
      role: 'user',
      content: promptText,
    };

    const existingTurns = chatsByContext[targetContext] || [];
    const nextMessages = [...existingTurns, userTurn];
    persistLabMessages(targetContext, nextMessages);
    setIsLoading(true);

    try {
      const trialContextSummary =
        recentContextTrials.length > 0
          ? `Recent student bench readings: ${recentContextTrials
              .map(
                (t) =>
                  `[${t.inputsSummary} -> Primary: ${t.primaryReading}, Derived: ${t.derivedMetric}]`
              )
              .join(' ; ')}`
          : 'No bench trials recorded for this module yet.';

      const bookContext = contextMeta
        ? {
            title: `EduLab Practical: ${contextMeta.title}`,
            author: contextMeta.code,
            selectedText: `Governing Law: ${contextMeta.formula}. Objective: ${contextMeta.objective}. ${trialContextSummary}`,
          }
        : {
            title: 'EduLab Multi-Science Virtual Laboratory (Chemistry, Physics, Biology)',
            author: 'KCSE / CBC Practical Curriculum',
            selectedText: trialContextSummary,
          };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          history: existingTurns.slice(-8).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          provider: 'gemini',
          speedMode: 'fast',
          stream: false,
          bookContext,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error || `AI Lab Assistant request failed (${res.status}).`
        );
      }

      if (!data?.reply) {
        throw new Error('Model returned an empty response. Please try again.');
      }

      const aiTurn: ChatTurn = {
        id: `${Date.now()}ai`,
        role: 'assistant',
        content: String(data.reply),
      };
      persistLabMessages(targetContext, [...nextMessages, aiTurn]);
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          'Unable to reach the AI Lab Assistant server endpoint.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Context Attachment Sidebar */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-display font-bold text-slate-900 dark:text-white">
              Practical Context
            </h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Select a practical experiment to ground the AI Lab Assistant in its equations and your logged bench trials. All chats are saved to Chat History.
          </p>

          <select
            value={selectedPracticalId}
            onChange={(e) =>
              setSelectedPracticalId(e.target.value as LabExperimentId | 'general')
            }
            aria-label="Select practical context"
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="general">General Lab Inquiry (All Sciences)</option>
            {PRACTICALS_CATALOG.map((prac) => (
              <option key={prac.id} value={prac.id}>
                [{prac.category.toUpperCase()}] {prac.label}
              </option>
            ))}
          </select>

          {contextMeta && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 space-y-1.5">
              <p className="text-[11px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {contextMeta.code}
              </p>
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                {contextMeta.title}
              </p>
              <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 break-words">
                {contextMeta.formula}
              </p>
            </div>
          )}

          <div className="pt-1 space-y-1.5">
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Suggested Lab Prompts
            </p>
            {STARTER_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendMessage(q)}
                disabled={isLoading}
                className="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.04] text-xs text-slate-700 dark:text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Conversation Console */}
      <div className="lg:col-span-8 bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col h-[580px]">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-500" />
            <div>
              <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                AI Lab Assistant
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {contextMeta
                  ? `Grounded on ${contextMeta.label} · Saved in Chat History`
                  : 'Grounded across Chemistry, Physics & Biology · Saved in Chat History'}
              </p>
            </div>
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleStartNewThread}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 whitespace-nowrap shrink-0 cursor-pointer"
              title="Start a fresh lab thread (previous conversation remains saved in Chat History)"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Thread</span>
            </button>
          )}
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-5 space-y-4"
        >
          {messages.length === 0 && !errorMsg && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-2">
              <Sparkles className="w-7 h-7 text-indigo-500" />
              <p className="text-sm font-display font-bold text-slate-900 dark:text-white">
                Ask about apparatus, calculations, or sources of error
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Your lab partner helps verify volumetric molarity steps, qualitative ion confirmatory equations, circuit analysis, and biology microscopy magnification.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 prose prose-sm dark:prose-invert max-w-none'
                }`}
              >
                {msg.role === 'user' ? (
                  <span>{msg.content}</span>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="px-4 py-3 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span>Analyzing practical inquiry...</span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">AI Lab Assistant Error</p>
                <p className="mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="p-3.5 border-t border-slate-200 dark:border-white/10 flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a practical question (e.g., How do I calculate titre average?)..."
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
