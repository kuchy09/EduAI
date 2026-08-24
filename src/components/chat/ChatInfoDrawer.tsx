import React from 'react';
import { 
  X, Phone, Video, Search, Bell, BellOff, 
  FileText, BookOpen, Image, ShieldCheck, 
  UserMinus, School, Sparkles, MapPin, Mail
} from 'lucide-react';
import { ChatUser, Conversation, ChatMessage } from './types';

interface ChatInfoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  partner?: ChatUser;
  messages: ChatMessage[];
  onStartCall: (type: 'audio' | 'video') => void;
  onUnfriend?: (userId: string) => void;
}

export const ChatInfoDrawer: React.FC<ChatInfoDrawerProps> = ({
  isOpen,
  onClose,
  conversation,
  partner,
  messages,
  onStartCall,
  onUnfriend
}) => {
  if (!isOpen) return null;

  const isGroup = conversation.type === 'group';

  // Gather attachments from conversation
  const sharedBooks = messages.filter(m => m.attachment?.type === 'book');
  const sharedFiles = messages.filter(m => m.attachment?.type === 'file' || m.attachment?.type === 'voice' || m.attachment?.type === 'code');

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-xs transition-opacity"
      />

      {/* Drawer Container */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-80 md:w-80 lg:w-88 md:static md:z-auto border-l border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full shrink-0 select-none overflow-y-auto shadow-2xl md:shadow-none animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs z-10">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {isGroup ? 'Group Information' : 'Profile & Academic Details'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      {/* Main Identity Banner */}
      <div className="p-6 flex flex-col items-center text-center border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
        <div className="relative mb-3">
          {isGroup ? (
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-3xl shadow-md">
              {conversation.groupAvatar || '👥'}
            </div>
          ) : (
            <>
              <img 
                src={partner?.avatar} 
                alt={partner?.name} 
                className="w-20 h-20 rounded-full object-cover ring-4 ring-indigo-500/20 shadow-md"
              />
              <span className={`absolute bottom-0 right-0 w-4 h-4 ${partner?.status === 'online' ? 'bg-emerald-500' : 'bg-slate-400'} rounded-full ring-2 ring-white dark:ring-slate-900`} />
            </>
          )}
        </div>

        <h4 className="text-base font-bold text-slate-900 dark:text-white">
          {isGroup ? conversation.name : partner?.name}
        </h4>

        {!isGroup && partner && (
          <>
            <span className={`mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              partner.role === 'teacher' 
                ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700' 
                : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
            }`}>
              {partner.role} • Verified
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-[220px]">
              {partner.title}
            </p>
          </>
        )}

        {isGroup && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[240px]">
            {conversation.description || 'Active study group on the Edu AI platform.'}
          </p>
        )}

        {/* Quick Contact Actions */}
        {!isGroup && (
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => onStartCall('audio')}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xs">
                <Phone className="w-4 h-4" />
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Audio</span>
            </button>

            <button
              onClick={() => onStartCall('video')}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xs">
                <Video className="w-4 h-4" />
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Video</span>
            </button>
          </div>
        )}
      </div>

      {/* Academic Info & Subjects */}
      {!isGroup && partner && (
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <School className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="font-medium">{partner.institution}</span>
          </div>

          {partner.location && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{partner.location}</span>
            </div>
          )}

          {partner.email && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">{partner.email}</span>
            </div>
          )}

          {partner.bio && (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              "{partner.bio}"
            </div>
          )}

          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Focus Subjects
            </span>
            <div className="flex flex-wrap gap-1">
              {partner.subjects.map(s => (
                <span key={s} className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[11px] font-medium">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Shared Textbooks & Curriculum Modules */}
      {sharedBooks.length > 0 && (
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
              <span>Shared Books ({sharedBooks.length})</span>
            </span>
          </div>
          <div className="space-y-2">
            {sharedBooks.map((m, idx) => (
              <div key={idx} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center gap-2.5">
                <div className="w-8 h-10 bg-indigo-100 dark:bg-indigo-900 rounded flex items-center justify-center text-indigo-600 shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {m.attachment?.bookTitle}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {m.attachment?.bookAuthor}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shared Notes & Attachments */}
      {sharedFiles.length > 0 && (
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-500" />
              <span>Study Notes & Audio ({sharedFiles.length})</span>
            </span>
          </div>
          <div className="space-y-1.5">
            {sharedFiles.map((m, idx) => (
              <div key={idx} className="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center justify-between text-xs transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm">
                    {m.attachment?.type === 'voice' ? '🎙️' : '📄'}
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 truncate font-medium">
                    {m.attachment?.name || 'Attachment'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {m.attachment?.duration ? `${m.attachment.duration}s` : 'View'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Safety & Connection Settings */}
      {!isGroup && partner && onUnfriend && (
        <div className="p-4 mt-auto">
          <button
            onClick={() => onUnfriend(partner.id)}
            className="w-full py-2 px-3 rounded-xl border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <UserMinus className="w-4 h-4" />
            <span>Remove Connection</span>
          </button>
        </div>
      )}
    </div>
  </>
  );
};
