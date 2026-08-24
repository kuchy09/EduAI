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
  location: 'Location off'
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
  },
  {
    id: 'note-1',
    userId: 'user-itz-mulla',
    userName: 'Itz mulla',
    userAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    bubbleText: 'Amazing week ❤️',
    musicOrSubject: 'Leavin',
    audioTrack: 'Rod Wave',
    createdAt: '2h ago',
    location: 'Nairobi'
  },
  {
    id: 'note-2',
    userId: 'user-majak',
    userName: 'Majak',
    userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    bubbleText: 'Physics past papers 💯',
    musicOrSubject: 'Study Grind',
    createdAt: '4h ago',
    location: 'Nakuru'
  },
  {
    id: 'note-3',
    userId: 'user-awien',
    userName: 'awien.diar',
    userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    bubbleText: 'Reading Dirac Modern Physics 📚',
    createdAt: '5h ago',
    location: 'Mombasa'
  }
];

export const INITIAL_USERS: ChatUser[] = [
  // Contacts from screenshot
  {
    id: 'user-itz-mulla',
    name: 'Itz mulla',
    email: 'itz.mulla@student.edu',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    role: 'student',
    title: 'Grade 12 STEM & Computing Scholar',
    institution: 'Alliance High Academic Hub',
    status: 'online',
    lastSeen: 'Active now',
    subjects: ['Physics', 'Robotics', 'Computer Science'],
    friendStatus: 'friends',
    bio: 'Music enthusiast & avid physics problem solver.',
    location: 'Nairobi, Kenya'
  },
  {
    id: 'user-awien',
    name: 'awien.diar',
    email: 'awien.diar@student.edu',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    role: 'student',
    title: 'Senior High Biology & Chemistry',
    institution: 'Moi Girls National Academy',
    status: 'online',
    lastSeen: 'Active 20m ago',
    subjects: ['Biology', 'Chemistry'],
    friendStatus: 'friends',
    bio: 'Passionate about medicine & biochemistry.',
    location: 'Eldoret, Kenya'
  },
  {
    id: 'user-majak',
    name: 'Majak',
    email: 'majak@student.edu',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    role: 'student',
    title: 'Grade 12 Pure Mathematics Track',
    institution: 'Nairobi Academic Senior Secondary',
    status: 'offline',
    lastSeen: 'Active 1d ago',
    subjects: ['Mathematics', 'Physics', 'Algorithms'],
    friendStatus: 'friends',
    bio: 'Coding daily & mastering calculus.',
    location: 'Nairobi, Kenya'
  },
  {
    id: 'user-nba',
    name: 'NEVER BROKE AGAIN',
    email: 'nba@student.edu',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'student',
    title: 'Economics & Business Studies Scholar',
    institution: 'Strathmore Secondary Hub',
    status: 'away',
    lastSeen: 'Active 3h ago',
    subjects: ['Economics', 'Business Studies'],
    friendStatus: 'friends',
    bio: 'Future entrepreneur & financial analyst.',
    location: 'Nairobi, Kenya'
  },
  {
    id: 'user-mrw',
    name: 'mrw_mb251',
    email: 'mrw.mb251@student.edu',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    role: 'student',
    title: 'Creative Arts & Literature',
    institution: 'St. Jude Academy',
    status: 'offline',
    lastSeen: 'Active 40w ago',
    subjects: ['Literature', 'French', 'Art'],
    friendStatus: 'friends',
    bio: 'J\'aime follow please • French learner & artist.',
    location: 'Mombasa, Kenya'
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

  // Other Students
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
    friendStatus: 'pending_received',
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
    friendStatus: 'friends',
    bio: 'Passionate STEM scholar, competitive programmer, and avid physics reader on Edu AI.',
    location: 'Nairobi, Kenya'
  }
];

export const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {
  // Itz mulla
  'conv-itz-mulla': [
    {
      id: 'm-itz-1',
      conversationId: 'conv-itz-mulla',
      senderId: 'user-itz-mulla',
      senderName: 'Itz mulla',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
      content: 'Bro that physics theorem explanation on modern physics was super clean! 🔥',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7 * 15).toISOString(),
      status: 'read'
    },
    {
      id: 'm-itz-2',
      conversationId: 'conv-itz-mulla',
      senderId: 'user-itz-mulla',
      senderName: 'Itz mulla',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
      content: 'Reacted to your story: ❤️',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7 * 15 + 1000 * 60).toISOString(),
      status: 'read'
    }
  ],

  // awien.diar
  'conv-awien': [
    {
      id: 'm-awien-1',
      conversationId: 'conv-awien',
      senderId: 'user-awien',
      senderName: 'awien.diar',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      content: 'Hey! Are you studying for the biology mock exams?',
      createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      status: 'read'
    },
    {
      id: 'm-awien-2',
      conversationId: 'conv-awien',
      senderId: 'me',
      senderName: 'wolter_kuch',
      senderRole: 'student',
      content: 'Yes, just finishing biochemistry summaries. Sent you the notes file!',
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      status: 'sent'
    }
  ],

  // Majak
  'conv-majak': [
    {
      id: 'm-majak-1',
      conversationId: 'conv-majak',
      senderId: 'user-majak',
      senderName: 'Majak',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      content: 'Let me know when you want to review the calculus derivatives problem set.',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      status: 'read'
    },
    {
      id: 'm-majak-2',
      conversationId: 'conv-majak',
      senderId: 'me',
      senderName: 'wolter_kuch',
      senderRole: 'student',
      content: 'Seen',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
      status: 'read'
    }
  ],

  // NEVER BROKE AGAIN
  'conv-nba': [
    {
      id: 'm-nba-1',
      conversationId: 'conv-nba',
      senderId: 'user-nba',
      senderName: 'NEVER BROKE AGAIN',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      content: 'Yo check out this business economics study doc when you get a chance.',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
      status: 'read'
    },
    {
      id: 'm-nba-2',
      conversationId: 'conv-nba',
      senderId: 'me',
      senderName: 'wolter_kuch',
      senderRole: 'student',
      content: 'Sent',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 70).toISOString(),
      status: 'sent'
    }
  ],

  // mrw_mb251
  'conv-mrw': [
    {
      id: 'm-mrw-1',
      conversationId: 'conv-mrw',
      senderId: 'user-mrw',
      senderName: 'mrw_mb251',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
      content: 'J\'aime o follow please',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7 * 40).toISOString(),
      status: 'read'
    }
  ],

  // Conversation 1: Teacher to Student (Dr. Sarah Mwangi <-> wolter_kuch)
  'conv-teacher-1': [
    {
      id: 'm1-1',
      conversationId: 'conv-teacher-1',
      senderId: 'teacher-1',
      senderName: 'Dr. Sarah Mwangi',
      senderRole: 'teacher',
      senderAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      content: 'Hello! I reviewed your submission on the Kinematics problem set in Dirac\'s Modern Physics.',
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
      senderName: 'wolter_kuch',
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
      senderName: 'wolter_kuch',
      senderRole: 'student',
      content: 'Understood! I will finish the chapter exercises before office hours tomorrow. Thank you!',
      createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
      status: 'delivered'
    }
  ],

  // Conversation 2: Student to Student (Elena Rodriguez <-> wolter_kuch)
  'conv-student-1': [
    {
      id: 'm2-1',
      conversationId: 'conv-student-1',
      senderId: 'student-1',
      senderName: 'Elena Rodriguez',
      senderRole: 'student',
      senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      content: 'Hey! Are you joining the group study session for physics and algorithms tonight?',
      createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      status: 'read'
    },
    {
      id: 'm2-2',
      conversationId: 'conv-student-1',
      senderId: 'me',
      senderName: 'wolter_kuch',
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

  // Conversation 3: Student to Student (Alex Chen <-> wolter_kuch)
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
      senderName: 'wolter_kuch',
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
      senderName: 'wolter_kuch',
      senderRole: 'student',
      content: 'That would be super helpful Elena! Looking forward to today\'s review session.',
      createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
      status: 'read'
    }
  ]
};

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-itz-mulla',
    type: 'direct',
    participants: ['me', 'user-itz-mulla'],
    groupRoleType: 'student-to-student',
    unreadCount: 0,
    isPinned: true,
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7 * 15).toISOString(),
    lastMessage: INITIAL_MESSAGES['conv-itz-mulla'][INITIAL_MESSAGES['conv-itz-mulla'].length - 1]
  },
  {
    id: 'conv-awien',
    type: 'direct',
    participants: ['me', 'user-awien'],
    groupRoleType: 'student-to-student',
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    lastMessage: INITIAL_MESSAGES['conv-awien'][INITIAL_MESSAGES['conv-awien'].length - 1]
  },
  {
    id: 'conv-majak',
    type: 'direct',
    participants: ['me', 'user-majak'],
    groupRoleType: 'student-to-student',
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
    lastMessage: INITIAL_MESSAGES['conv-majak'][INITIAL_MESSAGES['conv-majak'].length - 1]
  },
  {
    id: 'conv-nba',
    type: 'direct',
    participants: ['me', 'user-nba'],
    groupRoleType: 'student-to-student',
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 70).toISOString(),
    lastMessage: INITIAL_MESSAGES['conv-nba'][INITIAL_MESSAGES['conv-nba'].length - 1]
  },
  {
    id: 'conv-mrw',
    type: 'direct',
    participants: ['me', 'user-mrw'],
    groupRoleType: 'student-to-student',
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7 * 40).toISOString(),
    lastMessage: INITIAL_MESSAGES['conv-mrw'][INITIAL_MESSAGES['conv-mrw'].length - 1]
  },
  {
    id: 'conv-teacher-1',
    type: 'direct',
    participants: ['me', 'teacher-1'],
    groupRoleType: 'teacher-to-student',
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    lastMessage: INITIAL_MESSAGES['conv-teacher-1'][INITIAL_MESSAGES['conv-teacher-1'].length - 1]
  },
  {
    id: 'conv-student-1',
    type: 'direct',
    participants: ['me', 'student-1'],
    groupRoleType: 'student-to-student',
    unreadCount: 1,
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
  }
];
