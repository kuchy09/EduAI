export type UserRole = 'teacher' | 'student' | 'educator';

export type FriendStatus = 'friends' | 'pending_sent' | 'pending_received' | 'none';

export interface ChatUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  title: string;
  institution: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: string;
  subjects: string[];
  friendStatus: FriendStatus;
  bio: string;
  phone?: string;
  location?: string;
}

export interface UserNote {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  bubbleText: string;
  musicOrSubject?: string;
  audioTrack?: string;
  createdAt: string;
  location?: string;
}

export type ConversationType = 'direct' | 'group';

export type GroupRoleType = 'teacher-to-teacher' | 'teacher-to-student' | 'student-to-student' | 'study-group';

export interface ChatAttachment {
  type: 'book' | 'image' | 'voice' | 'file' | 'code' | 'note';
  url?: string;
  name?: string;
  size?: string;
  bookId?: string;
  bookTitle?: string;
  bookAuthor?: string;
  bookCover?: string;
  duration?: number; // in seconds for voice notes
  transcript?: string; // Web Speech API live transcription
  language?: string;
  codeSnippet?: string;
  noteId?: string;
  noteTakeaways?: string[];
  notePermission?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  senderAvatar?: string;
  content: string;
  createdAt: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  seenAt?: string;
  reactions?: Record<string, string[]>; // emoji -> array of user IDs
  attachment?: ChatAttachment;
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
  };
}

export interface Conversation {
  id: string;
  type: ConversationType;
  participants: string[]; // user IDs
  name?: string; // for group chats
  groupAvatar?: string;
  groupRoleType?: GroupRoleType;
  description?: string;
  lastMessage?: ChatMessage;
  unreadCount: number;
  isPinned?: boolean;
  isMuted?: boolean;
  updatedAt: string;
}

export interface CallSession {
  isActive: boolean;
  type: 'audio' | 'video';
  partner: ChatUser | null;
  startTime: number;
  isMuted: boolean;
  isVideoOff: boolean;
  status: 'ringing' | 'connected' | 'ended';
}

export type SharedNotePermission = 'private' | 'individual' | 'group' | 'public';

export interface NoteCollaborator {
  userId: string;
  userName: string;
  userRole?: UserRole;
  userAvatar?: string;
  permission: 'view' | 'edit' | 'admin';
  addedAt: string;
}

export interface SharedBookNote {
  id: string;
  title: string;
  bookId: string;
  bookTitle: string;
  bookAuthor?: string;
  bookCover?: string;
  chapterOrPage?: string;
  keyTakeaways: string[]; // Bulleted key takeaways
  content: string; // Markdown notes / synthesis
  tags: string[];
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  authorAvatar?: string;
  conversationId?: string; // Associated chat conversation / study room
  permissionType: SharedNotePermission;
  // Specific allowed user IDs (individual permission)
  allowedUserIds: string[];
  // Specific allowed group/conversation IDs (group permission)
  allowedGroupIds: string[];
  // Collaborators with edit or view access
  collaborators: NoteCollaborator[];
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
}
