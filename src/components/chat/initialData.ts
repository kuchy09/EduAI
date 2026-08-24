import { ChatUser, Conversation, ChatMessage } from './types';

export const INITIAL_CURRENT_USER: ChatUser = {
  id: 'me',
  name: 'Dickson Skello',
  email: 'dicksonskello09@gmail.com',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  role: 'student',
  title: 'Senior High Student (Grade 12 CBC)',
  institution: 'Nairobi Academic Senior Secondary',
  status: 'online',
  lastSeen: 'Active now',
  subjects: ['Physics', 'Mathematics', 'Computer Science'],
  friendStatus: 'friends',
  bio: 'Passionate STEM student preparing for university engineering pathways.',
  location: 'Nairobi, Kenya'
};

export const INITIAL_USERS: ChatUser[] = [
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
  },
  {
    id: 'teacher-3',
    name: 'Prof. Grace Wanjiru',
    email: 'grace.wanjiru@eduai.ac.ke',
    avatar: 'https://images.unsplash.com/photo-1580894732444-8ecded7900cd?w=150&auto=format&fit=crop&q=80',
    role: 'teacher',
    title: 'Senior Literature & Linguistics Teacher',
    institution: 'St. Jude Academy',
    status: 'offline',
    lastSeen: 'Active 2h ago',
    subjects: ['Literature', 'English', 'Communication'],
    friendStatus: 'pending_received',
    bio: 'Guiding students through critical literary essays, drama analysis, and creative writing.',
    location: 'Mombasa, Kenya'
  },
  {
    id: 'teacher-4',
    name: 'Mr. Patrick Mutua',
    email: 'patrick.mutua@eduai.ac.ke',
    avatar: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=150&auto=format&fit=crop&q=80',
    role: 'teacher',
    title: 'Computer Studies & ICT Faculty Lead',
    institution: 'Strathmore Secondary Hub',
    status: 'online',
    lastSeen: 'Active now',
    subjects: ['Computer Science', 'Cybersecurity', 'ICT'],
    friendStatus: 'none',
    bio: 'Passionate about coding bootcamps, algorithms, and cybersecurity fundamentals.',
    location: 'Nairobi, Kenya'
  },

  // Students
  {
    id: 'student-1',
    name: 'Elena Rodriguez',
    email: 'elena.rodriguez@student.edu',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    role: 'student',
    title: 'Grade 12 STEM Scholar',
    institution: 'Nairobi Academic Senior Secondary',
    status: 'online',
    lastSeen: 'Active now',
    subjects: ['Physics', 'Chemistry', 'Calculus'],
    friendStatus: 'friends',
    bio: 'Study buddy for STEM subjects. Working through Paul Dirac Modern Physics.',
    location: 'Nairobi, Kenya'
  },
  {
    id: 'student-2',
    name: 'Alex Chen',
    email: 'alex.chen@student.edu',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    role: 'student',
    title: 'Computer Science Major Track',
    institution: 'Nairobi Academic Senior Secondary',
    status: 'online',
    lastSeen: 'Active now',
    subjects: ['Algorithms', 'Software Engineering', 'Math'],
    friendStatus: 'friends',
    bio: 'Coding daily in TypeScript & Python. Love solving algorithmic problems.',
    location: 'Nairobi, Kenya'
  },
  {
    id: 'student-3',
    name: 'Faith Kiprono',
    email: 'faith.kiprono@student.edu',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    role: 'student',
    title: 'Grade 11 Senior Secondary Student',
    institution: 'Moi Girls National Academy',
    status: 'offline',
    lastSeen: 'Active 35m ago',
    subjects: ['Biology', 'Chemistry', 'Agriculture'],
    friendStatus: 'friends',
    bio: 'Aiming for Biomedical Sciences. Dedicated note-taker and study group organizer.',
    location: 'Eldoret, Kenya'
  },
  {
    id: 'student-4',
    name: 'Samuel Wanjala',
    email: 'samuel.wanjala@student.edu',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    role: 'student',
    title: 'Grade 12 Pure Science Student',
    institution: 'Lenana High School',
    status: 'away',
    lastSeen: 'Active 1h ago',
    subjects: ['Physics', 'Mathematics', 'Geography'],
    friendStatus: 'pending_sent',
    bio: 'Pre-engineering student. Keen on kinematics and vector mathematics.',
    location: 'Nairobi, Kenya'
  },
  {
    id: 'student-5',
    name: 'Zahra Omar',
    email: 'zahra.omar@student.edu',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    role: 'student',
    title: 'Grade 10 CBC Learner',
    institution: 'Coast Academy',
    status: 'offline',
    lastSeen: 'Active yesterday',
    subjects: ['Integrated Science', 'ICT', 'French'],
    friendStatus: 'none',
    bio: 'Exploring junior high to senior transition topics and language learning.',
    location: 'Mombasa, Kenya'
  },
  {
    id: 'student-6',
    name: 'Dut Nyok',
    email: 'dut.nyok@student.edu',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    role: 'student',
    title: 'Grade 12 STEM & Computing Scholar',
    institution: 'Alliance High Academic Hub',
    status: 'online',
    lastSeen: 'Active now',
    subjects: ['Physics', 'Computer Science', 'Mathematics', 'Robotics'],
    friendStatus: 'none',
    bio: 'Passionate STEM scholar, competitive programmer, and avid physics reader on Edu AI. Exploring quantum mechanics and Python algorithms. Open to peer study sessions!',
    location: 'Nairobi, Kenya'
  }
];

export const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {
  // Conversation 1: Teacher to Student (Dr. Sarah Mwangi <-> Dickson)
  'conv-teacher-1': [
    {
      id: 'm1-1',
      conversationId: 'conv-teacher-1',
      senderId: 'teacher-1',
      senderName: 'Dr. Sarah Mwangi',
      senderRole: 'teacher',
      senderAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      content: 'Hello Dickson! I reviewed your submission on the Kinematics problem set in Dirac\'s Modern Physics.',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
      status: 'read',
      reactions: { '👏': ['me'] }
    },
    {
      id: 'm1-2',
      conversationId: 'conv-teacher-1',
      senderId: 'teacher-1',
      senderName: 'Dr. Sarah Mwangi',
      senderRole: 'teacher',
      senderAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      content: 'Your mathematical derivation of relativistic momentum was spot-on! Take a look at Chapter 3 summary for next Tuesday.',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3.8).toISOString(),
      status: 'read',
      attachment: {
        type: 'book',
        bookId: '1',
        bookTitle: 'Advanced Science: Modern Physics',
        bookAuthor: 'Paul Dirac',
        bookCover: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&auto=format&fit=crop&q=80'
      }
    },
    {
      id: 'm1-3',
      conversationId: 'conv-teacher-1',
      senderId: 'me',
      senderName: 'Dickson Skello',
      senderRole: 'student',
      content: 'Thank you Dr. Sarah! I had a quick question regarding question 4B on wave-particle duality. Should we apply de Broglie\'s relation directly?',
      createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      status: 'read'
    },
    {
      id: 'm1-4',
      conversationId: 'conv-teacher-1',
      senderId: 'teacher-1',
      senderName: 'Dr. Sarah Mwangi',
      senderRole: 'teacher',
      senderAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      content: 'Yes! First compute the momentum p = h/λ, and make sure to convert velocity to SI units before calculating kinetic energy.',
      createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      status: 'read',
      reactions: { '💡': ['me'] }
    },
    {
      id: 'm1-5',
      conversationId: 'conv-teacher-1',
      senderId: 'me',
      senderName: 'Dickson Skello',
      senderRole: 'student',
      content: 'Understood! I will finish the chapter exercises before office hours tomorrow. Thank you!',
      createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
      status: 'delivered'
    }
  ],

  // Conversation 2: Student to Student (Elena Rodriguez <-> Dickson)
  'conv-student-1': [
    {
      id: 'm2-1',
      conversationId: 'conv-student-1',
      senderId: 'student-1',
      senderName: 'Elena Rodriguez',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      content: 'Hey Dickson! Are you joining the group study session for physics and algorithms tonight?',
      createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      status: 'read'
    },
    {
      id: 'm2-2',
      conversationId: 'conv-student-1',
      senderId: 'me',
      senderName: 'Dickson Skello',
      senderRole: 'student',
      content: 'Hey Elena! Yes definitely, I have my summary notes ready on Binary Search and QuickSort.',
      createdAt: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
      status: 'read',
      attachment: {
        type: 'book',
        bookId: '2',
        bookTitle: 'Algorithms & Data Structures',
        bookAuthor: 'Thomas H. Cormen',
        bookCover: 'https://images.unsplash.com/photo-1516116211227-bbc1562b322a?w=300&auto=format&fit=crop&q=80'
      }
    },
    {
      id: 'm2-3',
      conversationId: 'conv-student-1',
      senderId: 'student-1',
      senderName: 'Elena Rodriguez',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      content: 'Awesome! I recorded a brief 45-second explanation on the divide-and-conquer recurrence relation theorem.',
      createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
      status: 'read',
      attachment: {
        type: 'voice',
        name: 'Recurrence_Theorem_Overview.m4a',
        duration: 45,
        url: '#'
      }
    },
    {
      id: 'm2-4',
      conversationId: 'conv-student-1',
      senderId: 'student-1',
      senderName: 'Elena Rodriguez',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      content: 'Let\'s start the audio call around 7:00 PM if that works for you! 📚✨',
      createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      status: 'read',
      reactions: { '👍': ['me'], '❤️': ['me'] }
    }
  ],

  // Conversation 3: Student to Student (Alex Chen <-> Dickson)
  'conv-student-2': [
    {
      id: 'm3-1',
      conversationId: 'conv-student-2',
      senderId: 'student-2',
      senderName: 'Alex Chen',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      content: 'Hey man! Did you check out the new Kenyan CBC Grade 9 curriculum module in Edu AI?',
      createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      status: 'read'
    },
    {
      id: 'm3-2',
      conversationId: 'conv-student-2',
      senderId: 'me',
      senderName: 'Dickson Skello',
      senderRole: 'student',
      content: 'Yes! The interactive quizzes and AI explanations make studying way faster.',
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      status: 'read'
    },
    {
      id: 'm3-3',
      conversationId: 'conv-student-2',
      senderId: 'student-2',
      senderName: 'Alex Chen',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      content: 'Check this algorithm snippet for calculating Big-O tree depth in O(log n):',
      createdAt: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
      status: 'read',
      attachment: {
        type: 'code',
        language: 'typescript',
        name: 'binary_tree_depth.ts',
        codeSnippet: `function maxDepth(root: TreeNode | null): number {\n  if (!root) return 0;\n  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));\n}`
      }
    }
  ],

  // Conversation 4: Teacher to Teacher (Dr. Sarah Mwangi & Mr. David Ochieng)
  'conv-teacher-group': [
    {
      id: 'm4-1',
      conversationId: 'conv-teacher-group',
      senderId: 'teacher-2',
      senderName: 'Mr. David Ochieng',
      senderRole: 'teacher',
      senderAvatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
      content: 'Dr. Sarah, have you finalized the midterm exam rubric for the STEM Senior Secondary stream?',
      createdAt: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
      status: 'read'
    },
    {
      id: 'm4-2',
      conversationId: 'conv-teacher-group',
      senderId: 'teacher-1',
      senderName: 'Dr. Sarah Mwangi',
      senderRole: 'teacher',
      senderAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      content: 'Yes David! I aligned 40% of the questions with CBC practical competencies and problem solving.',
      createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
      status: 'read'
    },
    {
      id: 'm4-3',
      conversationId: 'conv-teacher-group',
      senderId: 'teacher-2',
      senderName: 'Mr. David Ochieng',
      senderRole: 'teacher',
      senderAvatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
      content: 'Excellent. The students have shown great engagement in the Edu AI interactive quizzes this term.',
      createdAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
      status: 'read',
      reactions: { '👏': ['teacher-1'] }
    }
  ],

  // Conversation 5: Multi-User Group / Study Classroom (CBC Senior STEM Study Circle)
  'conv-group-1': [
    {
      id: 'mg-1',
      conversationId: 'conv-group-1',
      senderId: 'teacher-1',
      senderName: 'Dr. Sarah Mwangi',
      senderRole: 'teacher',
      senderAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      content: 'Welcome everyone to the Senior STEM Academic Group! Feel free to post study questions and share textbook references.',
      createdAt: new Date(Date.now() - 1000 * 60 * 500).toISOString(),
      status: 'read'
    },
    {
      id: 'mg-2',
      conversationId: 'conv-group-1',
      senderId: 'student-3',
      senderName: 'Faith Kiprono',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
      content: 'Thank you Dr. Sarah! We are currently working on Chapter 4 review exercises.',
      createdAt: new Date(Date.now() - 1000 * 60 * 420).toISOString(),
      status: 'read'
    },
    {
      id: 'mg-3',
      conversationId: 'conv-group-1',
      senderId: 'student-1',
      senderName: 'Elena Rodriguez',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      content: 'I created a shared mind-map for organic chemistry reactions if anyone wants to check it out!',
      createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      status: 'read',
      reactions: { '❤️': ['me', 'student-3'], '🔥': ['me'] }
    },
    {
      id: 'mg-4',
      conversationId: 'conv-group-1',
      senderId: 'me',
      senderName: 'Dickson Skello',
      senderRole: 'student',
      content: 'That would be super helpful Elena! Looking forward to today\'s review session.',
      createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
      status: 'read'
    }
  ]
};

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-teacher-1',
    type: 'direct',
    participants: ['me', 'teacher-1'],
    groupRoleType: 'teacher-to-student',
    unreadCount: 0,
    isPinned: true,
    updatedAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    lastMessage: INITIAL_MESSAGES['conv-teacher-1'][INITIAL_MESSAGES['conv-teacher-1'].length - 1]
  },
  {
    id: 'conv-student-1',
    type: 'direct',
    participants: ['me', 'student-1'],
    groupRoleType: 'student-to-student',
    unreadCount: 1,
    isPinned: true,
    updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    lastMessage: INITIAL_MESSAGES['conv-student-1'][INITIAL_MESSAGES['conv-student-1'].length - 1]
  },
  {
    id: 'conv-group-1',
    type: 'group',
    name: 'CBC Senior STEM Study Circle',
    groupAvatar: '🔬',
    description: 'Collaborative study hub for Senior Secondary Physics, Chemistry & Math students and faculty mentors.',
    participants: ['me', 'teacher-1', 'student-1', 'student-2', 'student-3'],
    groupRoleType: 'study-group',
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    lastMessage: INITIAL_MESSAGES['conv-group-1'][INITIAL_MESSAGES['conv-group-1'].length - 1]
  },
  {
    id: 'conv-student-2',
    type: 'direct',
    participants: ['me', 'student-2'],
    groupRoleType: 'student-to-student',
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
    lastMessage: INITIAL_MESSAGES['conv-student-2'][INITIAL_MESSAGES['conv-student-2'].length - 1]
  },
  {
    id: 'conv-teacher-group',
    type: 'group',
    name: 'Faculty STEM & Curriculum Board',
    groupAvatar: '🎓',
    description: 'Teacher-to-Teacher collaboration for curriculum alignment, exam preparation, and CBC standardisation.',
    participants: ['me', 'teacher-1', 'teacher-2'],
    groupRoleType: 'teacher-to-teacher',
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    lastMessage: INITIAL_MESSAGES['conv-teacher-group'][INITIAL_MESSAGES['conv-teacher-group'].length - 1]
  }
];
