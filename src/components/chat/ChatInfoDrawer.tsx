import React from 'react';
import { 
  X, Phone, Video, Users, UserPlus,
  FileText, BookOpen,
  UserMinus, School, Sparkles, MapPin, Mail
} from 'lucide-react';
import { ChatUser, Conversation, ChatMessage } from './types';
import { AvatarBadge } from './AvatarBadge';

interface ChatInfoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  partner?: ChatUser;
  allUsers?: ChatUser[];
  messages: ChatMessage[];
  onStartCall: (type: 'audio' | 'video') => void;
  onUnfriend?: (userId: string) => void;
  onOpenSharedNotes?: () => void;
  onAddGroupMember?: (conversationId: string, memberId: string) => void;
}

export const ChatInfoDrawer: React.FC<ChatInfoDrawerProps> = ({
  isOpen,
  onClose,
  conversation,
  partner,
  allUsers = [],
  messages,
  onStartCall,
  onUnfriend,
  onOpenSharedNotes,
  onAddGroupMember,
}) => {
  if (!isOpen) return null;

  const isGroup = conversation.type === 'group';

  // Gather attachments from conversation
  const sharedNotes = messages.filter(m => m.attachment?.type === 'note');
  const sharedBooks = messages.filter(m => m.attachment?.type === 'book');
  const sharedFiles = messages.filter(m => m.attachment?.type === 'file' || m.attachment?.type === 'voice' || m.attachment?.type === 'code');

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-[105] md:hidden backdrop-blur-xs transition-opacity"
      />

      {/* Drawer Container */}
      <div className="fixed inset-y-0 right-0 z-[110] w-full sm:w-80 md:w-80 lg:w-88 md:static md:z-auto border-l border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full shrink-0 select-none overflow-y-auto shadow-2xl md:shadow-none animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-3.5 sm:px-4 pt-3.5 md:pt-[72px] pb-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs z-10">
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
            <div className="w-20 h-20 rounded-3xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Users className="w-9 h-9" />
            </div>
          ) : (
            <AvatarBadge
              name={partner?.name}
              avatarUrl={partner?.avatar}
              role={partner?.role}
              isOnline={partner?.status === 'online'}
              size="xl"
            />
          )}
        </div>

        <h4 className="text-base font-bold text-slate-900 dark:text-white">
          {isGroup ? conversation.name : partner?.name}
        </h4>

        {!isGroup && partner && (
          <>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              {partner.role === 'teacher' ? 'Faculty Educator' : 'Student'} · Verified
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-[220px]">
              {partner.title}
            </p>
          </>
        )}

        {isGroup && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[240px]">
            {conversation.description || 'Active study group on Edu AI.'}
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

      {/* Group Members Panel */}
      {isGroup && (
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              Members ({conversation.participants.length})
            </span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {conversation.participants.map((uid) => {
              const member = allUsers.find((u) => u.id === uid);
              const memberName = member?.name || (uid === partner?.id ? partner.name : 'Group Member');
              return (
                <div key={uid} className="flex items-center gap-2.5">
                  <AvatarBadge
                    name={memberName}
                    avatarUrl={member?.avatar}
                    role={member?.role}
                    isOnline={member?.status === 'online'}
                    size="xs"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{memberName}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {member?.role === 'teacher' ? 'Educator' : 'Student'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {onAddGroupMember && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              {allUsers.filter((u) => u.friendStatus === 'friends' && !conversation.participants.includes(u.id)).slice(0, 3).map((friend) => (
                <button
                  type="button"
                  key={friend.id}
                  onClick={() => onAddGroupMember(conversation.id, friend.id)}
                  className="w-full py-1.5 px-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-left text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="truncate">+ Add {friend.name}</span>
                  <UserPlus className="w-3.5 h-3.5 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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

          {partner.subjects && partner.subjects.length > 0 && (
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
          )}
        </div>
      )}

      {/* Shared Book Takeaways Section */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Shared Takeaways ({sharedNotes.length})</span>
          </span>
          {onOpenSharedNotes && (
            <button
              onClick={onOpenSharedNotes}
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              Open Hub
            </button>
          )}
        </div>
        {sharedNotes.length === 0 ? (
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center">
            <p className="text-[11px] text-slate-500">No takeaways posted in this chat yet.</p>
            {onOpenSharedNotes && (
              <button
                onClick={onOpenSharedNotes}
                className="mt-1.5 text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
              >
                + Share key takeaways
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {sharedNotes.map((m, idx) => (
              <div 
                key={idx} 
                onClick={onOpenSharedNotes}
                className="p-2 rounded-xl bg-indigo-50/50 dark:bg-slate-800/80 hover:bg-indigo-100/50 dark:hover:bg-slate-800 border border-indigo-100 dark:border-slate-700 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {m.attachment?.name || 'Shared Note'}
                  </p>
                  <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">
                    {m.attachment?.notePermission || 'Shared'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">
                  📖 {m.attachment?.bookTitle || 'Book'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

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
