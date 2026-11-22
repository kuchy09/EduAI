export type UserRole = 'teacher' | 'student' | 'educator' | 'admin';

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

export interface FriendRequestRecord {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'declined';
  note?: string;
  createdAt: string;
  updatedAt: string;
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
  duration?: number;
  transcript?: string;
  language?: string;
  codeSnippet?: string;
  noteId?: string;
  noteTakeaways?: string[];
  notePermission?: string;
}

export interface ChatMessage {
  id: string;
  clientMessageId?: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  senderAvatar?: string;
  content: string;
  createdAt: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  seenAt?: string;
  reactions?: Record<string, string[]>;
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
  participants: string[];
  name?: string;
  groupAvatar?: string;
  groupRoleType?: GroupRoleType;
  subjectTag?: string;
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
  keyTakeaways: string[];
  content: string;
  tags: string[];
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  authorAvatar?: string;
  conversationId?: string;
  permissionType: SharedNotePermission;
  allowedUserIds: string[];
  allowedGroupIds: string[];
  collaborators: NoteCollaborator[];
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityReply {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  authorAvatar?: string;
  title: string;
  content: string;
  tags: string[];
  likedBy: string[];
  replies: CommunityReply[];
  createdAt: string;
}
