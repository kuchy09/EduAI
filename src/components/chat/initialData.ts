import { ChatUser, Conversation, ChatMessage, UserNote } from './types';

export const INITIAL_CURRENT_USER: ChatUser = {
  id: 'me',
  name: 'wolter_kuch',
  email: 'wolter.kuch@eduai.ac.ke',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  role: 'student',
  title: 'Senior High Student (Grade 12 CBC)',
  institution: 'Alliance High Academic Hub',
  status: 'online',
  lastSeen: 'Active now',
  subjects: ['Physics', 'Mathematics', 'Computer Science'],
  friendStatus: 'friends',
  bio: 'Passionate STEM student preparing for university engineering pathways.',
  location: 'Nairobi, Kenya'
};

export const INITIAL_NOTES: UserNote[] = [
  {
    id: 'note-me',
    userId: 'me',
    userName: 'Your note',
    userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    bubbleText: 'Make this space yours...',
    createdAt: 'Just now',
    location: 'Location off'
  }
];

export const INITIAL_USERS: ChatUser[] = [
  // 1. Marop Majok (from screenshot)
  {
    id: 'user-marop',
    name: 'Marop Majok',
    email: 'marop.majok@student.edu',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    role: 'student',
    title: 'Senior Secondary STEM Scholar',
    institution: 'Alliance High Academic Hub',
    status: 'online',
    lastSeen: 'Active now',
    subjects: ['Physics', 'Mathematics'],
    friendStatus: 'friends',
    bio: 'Focused on CBC STEM preparation and university engineering admissions.',
    location: 'Nairobi, Kenya'
  },
  // 2. Ifrah (from screenshot)
  {
    id: 'user-ifrah',
    name: 'Ifrah',
    email: 'ifrah@student.edu',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    role: 'student',
    title: 'Senior High Biology & Chemistry',
    institution: 'Moi Girls National Academy',
    status: 'online',
    lastSeen: 'Active 20m ago',
    subjects: ['Biology', 'Chemistry'],
    friendStatus: 'friends',
    bio: 'Biochemistry student. Loving the Edu AI reader highlights.',
    location: 'Eldoret, Kenya'
  },
  // 3. Saphira (from screenshot)
  {
    id: 'user-saphira',
    name: 'Saphira',
    email: 'saphira@student.edu',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    role: 'student',
    title: 'Literature & Social Sciences',
    institution: 'St. Jude Academy',
    status: 'offline',
    lastSeen: 'Active Monday',
    subjects: ['Literature', 'History', 'English'],
    friendStatus: 'friends',
    bio: 'Avid book lover and essayist.',
    location: 'Mombasa, Kenya'
  },
  // 4. Mðøssŷ Qħøm (from screenshot)
  {
    id: 'user-moossy',
    name: 'Mðøssŷ Qħøm',
    email: 'moossy.qhom@student.edu',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    role: 'student',
    title: 'Pure Mathematics & Logic Track',
    institution: 'Nairobi Academic Senior Secondary',
    status: 'away',
    lastSeen: 'Active Monday',
    subjects: ['Mathematics', 'Computer Science'],
    friendStatus: 'friends',
    bio: 'Coding daily & mastering pure algorithms.',
    location: 'Nairobi, Kenya'
  },
  // 5. Jabra (from screenshot)
  {
    id: 'user-jabra',
    name: 'Jabra',
    email: 'jabra@student.edu',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    role: 'student',
    title: 'Economics & Computing Track',
    institution: 'Strathmore Secondary Hub',
    status: 'online',
    lastSeen: 'Active Sunday',
    subjects: ['Economics', 'ICT', 'Business'],
    friendStatus: 'friends',
    bio: 'Tech enthusiast & future fintech developer.',
    location: 'Nairobi, Kenya'
  },
  // 6. Maggy (from screenshot)
  {
    id: 'user-maggy',
    name: 'Maggy',
    email: 'maggy@student.edu',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    role: 'student',
    title: 'Creative Arts & Literature Track',
    institution: 'Kenya National Academy',
    status: 'online',
    lastSeen: 'Active Sunday',
    subjects: ['Art', 'French', 'Literature'],
    friendStatus: 'friends',
    bio: 'Art and design enthusiast. Active in study circles.',
    location: 'Nakuru, Kenya'
  },
  // 7. Ibrahim Talu (from screenshot)
  {
    id: 'user-ibrahim',
    name: 'Ibrahim Talu',
    email: 'ibrahim.talu@student.edu',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    role: 'student',
    title: 'Physics & Natural Sciences Track',
    institution: 'Alliance High Academic Hub',
    status: 'away',
    lastSeen: 'Active Sunday',
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    friendStatus: 'friends',
    bio: 'Preparing for national engineering competitions.',
    location: 'Nairobi, Kenya'
  },
  // Meta / Edu AI Assistant
  {
    id: 'user-meta-ai',
    name: 'Edu AI Assistant',
    email: 'ai.tutor@eduai.ac.ke',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    role: 'teacher',
    title: '24/7 Intelligent Academic Mentor',
    institution: 'Edu AI Cognitive Cloud',
    status: 'online',
    lastSeen: 'Always active',
    subjects: ['All CBC Subjects', 'Exam Prep', 'Research Summaries'],
    friendStatus: 'friends',
    bio: 'Ask me anything about your textbooks, math formulas, or study notes!',
    location: 'Cloud AI'
  },
  // Teachers
  {
    id: 'teacher-1',
    name: 'Dr. Sarah Mwangi',
    email: 'sarah.mwangi@eduai.ac.ke',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    role: 'teacher',
    title: 'Lead Physics & Natural Sciences Educator',
    institution: 'National Science Academy',
    status: 'online',
    lastSeen: 'Active now',
    subjects: ['Physics', 'Advanced Science', 'Mathematics'],
    friendStatus: 'friends',
    bio: '15+ years coaching students for national physics olympiads & CBC curriculum development.',
    location: 'Nairobi, Kenya'
  },
  {
    id: 'teacher-2',
    name: 'Mr. David Ochieng',
    email: 'david.ochieng@eduai.ac.ke',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
    role: 'teacher',
    title: 'Head of Mathematics & Algorithms',
    institution: 'Alliance High Academic Hub',
    status: 'online',
    lastSeen: 'Active 10m ago',
    subjects: ['Mathematics', 'Calculus', 'Statistics'],
    friendStatus: 'friends',
    bio: 'Specialist in pure mathematics, algorithmic proofs, and CBC Kenya exam prep.',
    location: 'Nakuru, Kenya'
  }
];

export const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {
  // 1. Marop Majok
  'conv-marop': [
    {
      id: 'm-marop-1',
      conversationId: 'conv-marop',
      senderId: 'user-marop',
      senderName: 'Marop Majok',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
      content: 'Hey Wolter, are you free this afternoon?',
      createdAt: '12:34 PM',
      status: 'delivered'
    },
    {
      id: 'm-marop-2',
      conversationId: 'conv-marop',
      senderId: 'user-marop',
      senderName: 'Marop Majok',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
      content: 'Bro have you started process',
      createdAt: '12:36 PM',
      status: 'delivered'
    }
  ],

  // 2. Ifrah
  'conv-ifrah': [
    {
      id: 'm-ifrah-1',
      conversationId: 'conv-ifrah',
      senderId: 'me',
      senderName: 'wolter_kuch',
      senderRole: 'student',
      content: 'Did you get the revised biology study guide?',
      createdAt: 'Yesterday 4:15 PM',
      status: 'read'
    },
    {
      id: 'm-ifrah-2',
      conversationId: 'conv-ifrah',
      senderId: 'user-ifrah',
      senderName: 'Ifrah',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      content: 'Yes',
      createdAt: 'Yesterday',
      status: 'delivered'
    }
  ],

  // 3. Saphira
  'conv-saphira': [
    {
      id: 'm-saphira-1',
      conversationId: 'conv-saphira',
      senderId: 'me',
      senderName: 'wolter_kuch',
      senderRole: 'student',
      content: 'Sorry for the late reply on the essay feedback!',
      createdAt: 'Monday 2:10 PM',
      status: 'read'
    },
    {
      id: 'm-saphira-2',
      conversationId: 'conv-saphira',
      senderId: 'user-saphira',
      senderName: 'Saphira',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
      content: "It's okay",
      createdAt: 'Monday',
      status: 'read'
    }
  ],

  // 4. Mðøssŷ Qħøm
  'conv-moossy': [
    {
      id: 'm-moossy-1',
      conversationId: 'conv-moossy',
      senderId: 'me',
      senderName: 'wolter_kuch',
      senderRole: 'student',
      content: 'Brody',
      createdAt: 'Monday',
      status: 'delivered'
    }
  ],

  // 5. Jabra
  'conv-jabra': [
    {
      id: 'm-jabra-1',
      conversationId: 'conv-jabra',
      senderId: 'user-jabra',
      senderName: 'Jabra',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
      content: 'Check out the new textbook chapters on macroeconomics!',
      createdAt: 'Sunday 6:30 PM',
      status: 'delivered'
    },
    {
      id: 'm-jabra-2',
      conversationId: 'conv-jabra',
      senderId: 'user-jabra',
      senderName: 'Jabra',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
      content: '😍',
      createdAt: 'Sunday',
      status: 'delivered'
    }
  ],

  // 6. Maggy
  'conv-maggy': [
    {
      id: 'm-maggy-1',
      conversationId: 'conv-maggy',
      senderId: 'me',
      senderName: 'wolter_kuch',
      senderRole: 'student',
      content: 'Can you join the study group call now?',
      createdAt: 'Sunday 8:12 PM',
      status: 'read'
    },
    {
      id: 'm-maggy-2',
      conversationId: 'conv-maggy',
      senderId: 'user-maggy',
      senderName: 'Maggy',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      content: 'Nah niko in hurry',
      createdAt: 'Sunday',
      status: 'delivered'
    }
  ],

  // 7. Ibrahim Talu
  'conv-ibrahim': [
    {
      id: 'm-ibrahim-1',
      conversationId: 'conv-ibrahim',
      senderId: 'user-ibrahim',
      senderName: 'Ibrahim Talu',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      content: 'Thanks for sending over the calculus formulas.',
      createdAt: 'Sunday 9:45 PM',
      status: 'delivered'
    },
    {
      id: 'm-ibrahim-2',
      conversationId: 'conv-ibrahim',
      senderId: 'user-ibrahim',
      senderName: 'Ibrahim Talu',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      content: 'Will review them first thing in the morning.',
      createdAt: 'Sunday 9:46 PM',
      status: 'delivered'
    },
    {
      id: 'm-ibrahim-3',
      conversationId: 'conv-ibrahim',
      senderId: 'user-ibrahim',
      senderName: 'Ibrahim Talu',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      content: 'Have a blessed night',
      createdAt: 'Sunday',
      status: 'delivered'
    }
  ],

  // Meta / Edu AI
  'conv-meta-ai': [
    {
      id: 'm-meta-1',
      conversationId: 'conv-meta-ai',
      senderId: 'user-meta-ai',
      senderName: 'Edu AI Assistant',
      senderRole: 'teacher',
      senderAvatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
      content: 'Hello Wolter! 👋 How can I help with your studies today? You can ask for textbook summaries, quiz practice, or concept explanations.',
      createdAt: 'Just now',
      status: 'read'
    }
  ],

  // Teacher Dr. Sarah Mwangi
  'conv-teacher-1': [
    {
      id: 'm1-1',
      conversationId: 'conv-teacher-1',
      senderId: 'teacher-1',
      senderName: 'Dr. Sarah Mwangi',
      senderRole: 'teacher',
      senderAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      content: 'Hello Wolter! Outstanding work on your Physics Chapter 3 mechanics test.',
      createdAt: 'Yesterday',
      status: 'read'
    }
  ]
};

export const INITIAL_CONVERSATIONS: Conversation[] = [
  // 1. Marop Majok (12:36 PM, Unread 2)
  {
    id: 'conv-marop',
    type: 'direct',
    participants: ['me', 'user-marop'],
    groupRoleType: 'student-to-student',
    unreadCount: 2,
    updatedAt: '12:36 PM',
    lastMessage: INITIAL_MESSAGES['conv-marop'][INITIAL_MESSAGES['conv-marop'].length - 1]
  },
  // 2. Ifrah (Yesterday, Unread 1)
  {
    id: 'conv-ifrah',
    type: 'direct',
    participants: ['me', 'user-ifrah'],
    groupRoleType: 'student-to-student',
    unreadCount: 1,
    updatedAt: 'Yesterday',
    lastMessage: INITIAL_MESSAGES['conv-ifrah'][INITIAL_MESSAGES['conv-ifrah'].length - 1]
  },
  // 3. Saphira (Monday)
  {
    id: 'conv-saphira',
    type: 'direct',
    participants: ['me', 'user-saphira'],
    groupRoleType: 'student-to-student',
    unreadCount: 0,
    updatedAt: 'Monday',
    lastMessage: INITIAL_MESSAGES['conv-saphira'][INITIAL_MESSAGES['conv-saphira'].length - 1]
  },
  // 4. Mðøssŷ Qħøm (Monday, Sent by me: ✓ Brody)
  {
    id: 'conv-moossy',
    type: 'direct',
    participants: ['me', 'user-moossy'],
    groupRoleType: 'student-to-student',
    unreadCount: 0,
    updatedAt: 'Monday',
    lastMessage: INITIAL_MESSAGES['conv-moossy'][INITIAL_MESSAGES['conv-moossy'].length - 1]
  },
  // 5. Jabra (Sunday, Unread 2)
  {
    id: 'conv-jabra',
    type: 'direct',
    participants: ['me', 'user-jabra'],
    groupRoleType: 'student-to-student',
    unreadCount: 2,
    updatedAt: 'Sunday',
    lastMessage: INITIAL_MESSAGES['conv-jabra'][INITIAL_MESSAGES['conv-jabra'].length - 1]
  },
  // 6. Maggy (Sunday, Unread 1)
  {
    id: 'conv-maggy',
    type: 'direct',
    participants: ['me', 'user-maggy'],
    groupRoleType: 'student-to-student',
    unreadCount: 1,
    updatedAt: 'Sunday',
    lastMessage: INITIAL_MESSAGES['conv-maggy'][INITIAL_MESSAGES['conv-maggy'].length - 1]
  },
  // 7. Ibrahim Talu (Sunday, Unread 3)
  {
    id: 'conv-ibrahim',
    type: 'direct',
    participants: ['me', 'user-ibrahim'],
    groupRoleType: 'student-to-student',
    unreadCount: 3,
    updatedAt: 'Sunday',
    lastMessage: INITIAL_MESSAGES['conv-ibrahim'][INITIAL_MESSAGES['conv-ibrahim'].length - 1]
  },
  // 8. Edu AI Assistant
  {
    id: 'conv-meta-ai',
    type: 'direct',
    participants: ['me', 'user-meta-ai'],
    groupRoleType: 'teacher-to-student',
    unreadCount: 0,
    updatedAt: 'Just now',
    lastMessage: INITIAL_MESSAGES['conv-meta-ai'][INITIAL_MESSAGES['conv-meta-ai'].length - 1]
  },
  // 9. Dr. Sarah Mwangi
  {
    id: 'conv-teacher-1',
    type: 'direct',
    participants: ['me', 'teacher-1'],
    groupRoleType: 'teacher-to-student',
    unreadCount: 0,
    updatedAt: 'Yesterday',
    lastMessage: INITIAL_MESSAGES['conv-teacher-1'][INITIAL_MESSAGES['conv-teacher-1'].length - 1]
  }
];
