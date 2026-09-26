import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Smile, Paperclip, Mic, MicOff, BookOpen, 
  Code, Image as ImageIcon, X, Sparkles, Check, StopCircle,
  FileText, Volume2
} from 'lucide-react';
import { mockBooks } from '../../data';
import { ChatAttachment } from './types';

interface ChatInputProps {
  onSendMessage: (content: string, attachment?: ChatAttachment) => void;
  disabled?: boolean;
  disabledReason?: string;
  onSendFriendRequest?: () => void;
  onOpenSharedNotes?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  disabledReason,
  onSendFriendRequest,
  onOpenSharedNotes
}) => {
  const [text, setText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showBookPicker, setShowBookPicker] = useState(false);
  
  // Voice Note & Web Speech API States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [activeAttachment, setActiveAttachment] = useState<ChatAttachment | null>(null);

  const timerRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Check Web Speech API support
  const isSpeechRecognitionSupported = typeof window !== 'undefined' && 
    Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handleStartRecording = async () => {
    setIsRecording(true);
    setRecordingTime(0);
    setTranscript('');
    setInterimTranscript('');
    audioChunksRef.current = [];

    // 1. Timer for duration (up to 60s)
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= 60) {
          handleStopRecording(true);
          return 60;
        }
        return prev + 1;
      });
    }, 1000);

    // 2. Initialize Web Speech API SpeechRecognition
    if (isSpeechRecognitionSupported) {
      try {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = navigator.language || 'en-US';

        recognition.onresult = (event: any) => {
          let currentFinal = '';
          let currentInterim = '';

          for (let i = 0; i < event.results.length; i++) {
            const item = event.results[i];
            if (item.isFinal) {
              currentFinal += item[0].transcript + ' ';
            } else {
              currentInterim += item[0].transcript;
            }
          }

          if (currentFinal) {
            setTranscript(currentFinal.trim());
          }
          setInterimTranscript(currentInterim);
        };

        recognition.onerror = (err: any) => {
          console.warn('SpeechRecognition error:', err?.error || err);
        };

        recognition.onend = () => {
          // If still recording, restart recognition
          if (isRecording && recognitionRef.current) {
            try {
              recognition.start();
            } catch (_) {}
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('Could not initialize SpeechRecognition:', err);
      }
    }

    // 3. Initialize Audio MediaRecorder if mediaDevices is supported
    if (navigator?.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.start(100);
      } catch (err) {
        console.warn('Microphone audio stream capture unavailable or permission denied:', err);
      }
    }
  };

  const handleStopRecording = (send: boolean) => {
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);

    // Stop Web Speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }

    const finalCapturedText = (transcript + ' ' + interimTranscript).trim();
    const duration = Math.max(1, recordingTime);

    // Stop MediaRecorder and produce blob
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (send) {
      let audioBlobUrl: string | undefined = undefined;
      if (audioChunksRef.current.length > 0) {
        try {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          audioBlobUrl = URL.createObjectURL(blob);
        } catch (_) {}
      }

      const voiceAttachment: ChatAttachment = {
        type: 'voice',
        name: `Voice_Note_${Date.now()}.webm`,
        duration,
        transcript: finalCapturedText || undefined,
        url: audioBlobUrl
      };

      const messageContent = finalCapturedText 
        ? `🎙️ "${finalCapturedText}"` 
        : `🎙️ Voice Note (${duration}s)`;

      onSendMessage(messageContent, voiceAttachment);
    }

    // Reset state
    setRecordingTime(0);
    setTranscript('');
    setInterimTranscript('');
    audioChunksRef.current = [];
  };

  // Convert current speech transcript to text input instead of sending voice note
  const handleInsertAsText = () => {
    const finalCapturedText = (transcript + ' ' + interimTranscript).trim();
    if (finalCapturedText) {
      setText(prev => (prev ? `${prev} ${finalCapturedText}` : finalCapturedText));
    }
    handleStopRecording(false);
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!text.trim() && !activeAttachment) || disabled) return;

    onSendMessage(text.trim(), activeAttachment || undefined);
    setText('');
    setActiveAttachment(null);
    setShowEmojiPicker(false);
    setShowAttachMenu(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const emojis = ['👍', '❤️', '💡', '📚', '👏', '🔥', '✨', '🎓', '😮', '🙌', '💯', '🔬'];

  const liveSpeechText = (transcript + ' ' + interimTranscript).trim();

  if (disabled) {
    return (
      <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {disabledReason || 'You must be academic friends / connected to message directly.'}
        </p>
        {onSendFriendRequest && (
          <button
            onClick={onSendFriendRequest}
            className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Send Connection Request
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shrink-0 relative">
      {/* Active Attachment Preview Banner */}
      {activeAttachment && (
        <div className="mb-2 p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg">
              {activeAttachment.type === 'book' ? '📖' : activeAttachment.type === 'code' ? '💻' : '📎'}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-indigo-950 dark:text-indigo-200 truncate">
                {activeAttachment.bookTitle || activeAttachment.name || 'Attachment ready'}
              </p>
              <p className="text-[10px] text-indigo-700 dark:text-indigo-300">
                {activeAttachment.bookAuthor || activeAttachment.type}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveAttachment(null)}
            className="w-6 h-6 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Book Attachment Modal Picker */}
      {showBookPicker && (
        <div className="absolute bottom-16 left-2 right-2 sm:left-4 sm:right-auto sm:w-80 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-3 z-30 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700 mb-2">
            <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-indigo-500" /> Share Textbook
            </span>
            <button onClick={() => setShowBookPicker(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1.5">
            {mockBooks.slice(0, 6).map(book => (
              <div
                key={book.id}
                onClick={() => {
                  setActiveAttachment({
                    type: 'book',
                    bookId: book.id,
                    bookTitle: book.title,
                    bookAuthor: book.author,
                    bookCover: book.coverImage
                  });
                  setShowBookPicker(false);
                  setShowAttachMenu(false);
                }}
                className="p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-2.5 transition-colors"
              >
                <div className="w-7 h-9 bg-indigo-100 dark:bg-indigo-900 rounded flex items-center justify-center text-indigo-600 text-xs shrink-0">
                  📖
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{book.title}</p>
                  <p className="text-[10px] text-slate-500 truncate">{book.author}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-2 sm:left-12 max-w-[calc(100vw-24px)] sm:max-w-xs bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-2.5 z-30 flex items-center gap-1.5 flex-wrap">
          {emojis.map(emoji => (
            <button
              key={emoji}
              onClick={() => {
                setText(prev => prev + emoji);
                setShowEmojiPicker(false);
              }}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-base hover:scale-110 transition-transform cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Attachment Options Menu */}
      {showAttachMenu && (
        <div className="absolute bottom-16 left-2 sm:left-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-2 z-30 space-y-1 w-56 max-w-[calc(100vw-24px)]">
          {onOpenSharedNotes && (
            <button
              onClick={() => {
                setShowAttachMenu(false);
                onOpenSharedNotes();
              }}
              className="w-full px-3 py-2 rounded-xl bg-indigo-50/70 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-left text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="truncate">Collaborative Takeaway</span>
            </button>
          )}
          <button
            onClick={() => {
              setShowBookPicker(true);
              setShowAttachMenu(false);
            }}
            className="w-full px-3 py-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-700 text-left text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="truncate">Share Textbook</span>
          </button>
          <button
            onClick={() => {
              setActiveAttachment({
                type: 'code',
                language: 'typescript',
                name: 'math_formula.py',
                codeSnippet: '# Educational Python calculation\nimport math\n\ndef kinetic_energy(mass, velocity):\n    return 0.5 * mass * (velocity ** 2)'
              });
              setShowAttachMenu(false);
            }}
            className="w-full px-3 py-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-700 text-left text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <Code className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">Code / Math Snippet</span>
          </button>
          <button
            onClick={() => {
              setActiveAttachment({
                type: 'file',
                name: 'CBC_Physics_Form4_Notes.pdf',
                size: '2.4 MB'
              });
              setShowAttachMenu(false);
            }}
            className="w-full px-3 py-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-700 text-left text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <Paperclip className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="truncate">Attach Study Notes (PDF)</span>
          </button>
        </div>
      )}

      {/* Main Input Row: Real-time Web Speech Voice Note Recording or Standard Text Input */}
      {isRecording ? (
        <div className="bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-2.5 sm:p-3 min-w-0 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-3">
            {/* Live Recording Timer & Animated Waveform */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
              </span>
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 font-mono">
                {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}
              </span>

              {/* Live Audio Visualizer Bars */}
              <div className="flex items-center gap-0.5 h-4 px-1.5 py-0.5 bg-rose-100/70 dark:bg-rose-900/50 rounded-md">
                {[30, 85, 45, 95, 70, 40, 80, 100, 60, 90, 50, 75].map((h, i) => (
                  <span
                    key={i}
                    style={{ height: `${h}%` }}
                    className="w-0.5 bg-rose-600 dark:bg-rose-400 rounded-full animate-pulse"
                  />
                ))}
              </div>

              <span className="text-[10px] text-rose-700/80 dark:text-rose-300/80 font-medium hidden sm:inline">
                Web Speech Voice Note
              </span>
            </div>

            {/* Action Buttons: Cancel, Insert Text, Send Voice Note */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleStopRecording(false)}
                className="px-2.5 py-1 text-xs font-medium rounded-xl text-slate-600 dark:text-slate-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 cursor-pointer transition-colors"
                title="Cancel Recording"
              >
                Cancel
              </button>

              {liveSpeechText && (
                <button
                  onClick={handleInsertAsText}
                  className="px-2.5 py-1 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                  title="Use recognized speech as typed text"
                >
                  <FileText className="w-3 h-3 text-indigo-500" />
                  <span className="hidden md:inline">Use as Text</span>
                </button>
              )}

              <button
                onClick={() => handleStopRecording(true)}
                className="px-3 py-1 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-95"
                title="Send Voice Note"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </div>
          </div>

          {/* Web Speech API Live Transcription Preview Banner */}
          <div className="px-3 py-1.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-rose-100 dark:border-rose-950 flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5 text-rose-500 shrink-0 animate-pulse" />
            <p className="text-xs text-slate-700 dark:text-slate-300 italic truncate flex-1 min-w-0">
              {liveSpeechText ? (
                <span>“{liveSpeechText}”</span>
              ) : (
                <span className="opacity-60 not-italic">Listening... Speak now to transcribe your voice note</span>
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {/* Plus / Attach Action */}
          <button
            onClick={() => {
              setShowAttachMenu(prev => !prev);
              setShowEmojiPicker(false);
            }}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
              showAttachMenu 
                ? 'bg-indigo-600 text-white' 
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}
            title="Attach Textbook, Code or Notes"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Emoji Trigger */}
          <button
            onClick={() => {
              setShowEmojiPicker(prev => !prev);
              setShowAttachMenu(false);
            }}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors shrink-0 cursor-pointer"
            title="Add Reaction / Emoji"
          >
            <Smile className="w-4 h-4" />
          </button>

          {/* Text Input */}
          <div className="flex-1 min-w-0 relative">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-indigo-500/50 focus:bg-white dark:focus:bg-slate-800/90 rounded-2xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none transition-all shadow-inner"
            />
          </div>

          {/* Voice Record Action (Web Speech API) */}
          {!text.trim() && !activeAttachment ? (
            <button
              onClick={handleStartRecording}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 flex items-center justify-center transition-colors shrink-0 cursor-pointer group"
              title="Record Voice Note (Web Speech API)"
            >
              <Mic className="w-4 h-4 sm:w-4.5 sm:h-4.5 group-hover:scale-110 transition-transform text-indigo-600 dark:text-indigo-400" />
            </button>
          ) : (
            /* Send Button */
            <button
              onClick={() => handleSend()}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
              title="Send Message"
            >
              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
