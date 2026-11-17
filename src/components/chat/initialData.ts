import { ChatUser, Conversation, ChatMessage } from './types';

export const INITIAL_CURRENT_USER: ChatUser = {
  id: 'me',
  name: 'Edu AI Scholar',
  email: '',
  avatar: '',
  role: 'student',
  title: 'Academic Scholar',
  institution: 'Edu AI Learning Network',
  status: 'online',
  lastSeen: 'Active now',
  subjects: ['Mathematics', 'Physics', 'Computer Science'],
  friendStatus: 'none',
  bio: 'Learning and collaborating on Edu AI.',
};

export const INITIAL_USERS: ChatUser[] = [];

export const INITIAL_CONVERSATIONS: Conversation[] = [];

export const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {};
