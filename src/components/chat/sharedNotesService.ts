// Shared Book Notes service for Edu AI Chat and Study Collaboration
import { SharedBookNote, SharedNotePermission, NoteCollaborator, ChatUser } from './types';
import { supabase } from '../../lib/supabase';

const STORAGE_KEY = 'eduai_chat_shared_book_notes';

// Seed demo shared notes with realistic textbook takeaways and permissions
export const INITIAL_SHARED_NOTES: SharedBookNote[] = [
  {
    id: 'note-quantum-01',
    title: 'Quantum Electrodynamics & Feynman Diagrams Takeaways',
    bookId: '1',
    bookTitle: 'Advanced Science: Modern Physics',
    bookAuthor: 'Paul Dirac',
    bookCover: '',
    chapterOrPage: 'Chapter 4: Perturbation Theory & QED (pp. 142–168)',
    keyTakeaways: [
      'Virtual photons mediate the electromagnetic force between leptons with momentum exchange $q^2$.',
      'Feynman vertex factors introduce coupling constant $\\alpha \\approx 1/137$, dictating transition probabilities.',
      'Renormalization resolves ultraviolet divergences by redefining bare mass and charge at observed energy scales.',
      'Symmetry conservation: Charge conjugation (C), Parity (P), and Time reversal (T) symmetries must hold invariant.'
    ],
    content: `### Core Mathematical Synthesis
When calculating electron-positron scattering amplitudes (Bhabha scattering), two leading Feynman diagrams contribute:
1. **s-channel (Annihilation)**: $e^+ e^- \\rightarrow \\gamma^* \\rightarrow e^+ e^-$
2. **t-channel (Scattering)**: Electron and positron exchange a virtual spacelike photon.

#### Study Group Action Items:
- [x] Verify Ward-Takahashi identity for gauge invariance
- [ ] Complete Exercise 4.8 on anomalous magnetic dipole moment ($g-2$)
- [ ] Prepare whiteboard slides for Friday peer session`,
    tags: ['Physics', 'Quantum', 'CBC-Advanced', 'Dirac'],
    authorId: 'user-prof-amara',
    authorName: 'Prof. Amara Ochieng',
    authorRole: 'teacher',
    authorAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    conversationId: 'conv-physics-dept',
    permissionType: 'group',
    allowedUserIds: ['user-prof-amara', 'user-david-kip', 'current-user-id'],
    allowedGroupIds: ['conv-physics-dept', 'conv-cbc-form4'],
    collaborators: [
      {
        userId: 'user-prof-amara',
        userName: 'Prof. Amara Ochieng',
        userRole: 'teacher',
        permission: 'admin',
        addedAt: '2026-09-20T10:00:00Z'
      },
      {
        userId: 'user-david-kip',
        userName: 'David Kiprop',
        userRole: 'student',
        permission: 'edit',
        addedAt: '2026-09-21T14:30:00Z'
      },
      {
        userId: 'current-user-id',
        userName: 'You',
        userRole: 'student',
        permission: 'edit',
        addedAt: '2026-09-22T08:15:00Z'
      }
    ],
    isPinned: true,
    createdAt: '2026-09-20T10:00:00Z',
    updatedAt: '2026-09-22T16:40:00Z'
  },
  {
    id: 'note-algo-dijkstra-02',
    title: 'Dynamic Programming vs Greedy Algorithms: Optimal Substructure',
    bookId: '2',
    bookTitle: 'Algorithms & Data Structures',
    bookAuthor: 'Thomas H. Cormen',
    bookCover: '',
    chapterOrPage: 'Chapter 16: Greedy Algorithms (pp. 414–440)',
    keyTakeaways: [
      'Greedy Choice Property: A globally optimal solution can be arrived at by making locally optimal (greedy) choices.',
      'Optimal Substructure: An optimal solution to the problem contains within it optimal solutions to subproblems.',
      'Dijkstra fails with negative edge weights; Bellman-Ford or Floyd-Warshall must be substituted.',
      'Huffman Coding uses prefix trees yielding provably optimal lossless symbol codes.'
    ],
    content: `### Implementation Comparison
Greedy choices do not reconsider past decisions, whereas Dynamic Programming caches subproblem solutions and explores multiple paths.

\`\`\`python
# Fibonacci with Memoization (DP)
def fib_memo(n, memo={}):
    if n in memo: return memo[n]
    if n <= 1: return n
    memo[n] = fib_memo(n-1, memo) + fib_memo(n-2, memo)
    return memo[n]
\`\`\`

**Takeaway Insight**: Always prove greedy choice correctness via exchange arguments before committing to production architectures!`,
    tags: ['Algorithms', 'DataStructures', 'Python', 'InterviewPrep'],
    authorId: 'current-user-id',
    authorName: 'You',
    authorRole: 'student',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    conversationId: 'conv-cs-cohort',
    permissionType: 'group',
    allowedUserIds: ['current-user-id', 'user-sarah-mutiso'],
    allowedGroupIds: ['conv-cs-cohort'],
    collaborators: [
      {
        userId: 'current-user-id',
        userName: 'You',
        userRole: 'student',
        permission: 'admin',
        addedAt: '2026-09-21T09:00:00Z'
      },
      {
        userId: 'user-sarah-mutiso',
        userName: 'Sarah Mutiso',
        userRole: 'student',
        permission: 'edit',
        addedAt: '2026-09-22T11:20:00Z'
      }
    ],
    isPinned: false,
    createdAt: '2026-09-21T09:00:00Z',
    updatedAt: '2026-09-22T17:10:00Z'
  },
  {
    id: 'note-cbc-math-03',
    title: 'Grade 9 CBC Quadratic Equations & Graphical Solutions',
    bookId: '10',
    bookTitle: 'CBC Grade 9 Mathematics',
    bookAuthor: 'Edu Publishers',
    bookCover: '',
    chapterOrPage: 'Strand 3: Algebra & Graphical Analysis (pp. 88–105)',
    keyTakeaways: [
      'Standard form: $ax^2 + bx + c = 0$, where discriminant $\\Delta = b^2 - 4ac$ reveals root multiplicity.',
      'If $\\Delta > 0$: 2 distinct real roots; if $\\Delta = 0$: 1 repeated real root; if $\\Delta < 0$: no real roots.',
      'Parabola axis of symmetry is always $x = -b / (2a)$ with vertex at $( -b/(2a), f(-b/(2a)) )$.',
      'Real-world CBC application: projectile trajectory modeling and revenue maximization.'
    ],
    content: `### Teacher Guidance & Student Tips
Students frequently make sign errors when completing the square.

**Key Rule to Remember:**
When shifting terms across the equation, divide through by coefficient $a$ first before adding $(b/2a)^2$ to both sides.

**Class Exercise:**
Find the roots of $2x^2 - 8x + 6 = 0$ using:
1. Factoring: $2(x - 1)(x - 3) = 0 \\rightarrow x = 1, 3$
2. Quadratic formula verification`,
    tags: ['CBC', 'Grade9', 'Mathematics', 'Algebra'],
    authorId: 'user-dr-kamau',
    authorName: 'Dr. Julius Kamau',
    authorRole: 'teacher',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    conversationId: 'conv-cbc-form4',
    permissionType: 'individual',
    allowedUserIds: ['user-dr-kamau', 'current-user-id'],
    allowedGroupIds: [],
    collaborators: [
      {
        userId: 'user-dr-kamau',
        userName: 'Dr. Julius Kamau',
        userRole: 'teacher',
        permission: 'admin',
        addedAt: '2026-09-19T08:00:00Z'
      },
      {
        userId: 'current-user-id',
        userName: 'You',
        userRole: 'student',
        permission: 'view',
        addedAt: '2026-09-20T12:00:00Z'
      }
    ],
    isPinned: false,
    createdAt: '2026-09-19T08:00:00Z',
    updatedAt: '2026-09-21T15:20:00Z'
  },
  {
    id: 'note-cyber-security-04',
    title: 'Zero Trust Architecture & Cryptographic Key Management',
    bookId: '9',
    bookTitle: 'Essential Cybersecurity',
    bookAuthor: 'Dan Shoemaker',
    bookCover: '',
    chapterOrPage: 'Chapter 7: Identity Access & Zero Trust (pp. 210–235)',
    keyTakeaways: [
      'Core Principle: Never trust, always verify. Perimeter defense is insufficient against lateral movement.',
      'Micro-segmentation isolates workloads to contain blast radiuses during compromised endpoint incidents.',
      'Public Key Infrastructure (PKI) requires strict HSM-backed root of trust and automated cert rotation.',
      'Continuous authentication evaluates device health, IP reputation, and behavioral telemetry.'
    ],
    content: `### Personal Revision Notes
Confidential synthesis for final semester lab exam.

#### Key Protocols Checklist:
- [x] TLS 1.3 Cipher Suites (Elimination of RSA key transport in favor of ECDHE)
- [x] OAuth 2.1 with PKCE (Proof Key for Code Exchange)
- [ ] Implement local WireGuard VPN tunnel with MFA validation`,
    tags: ['Cybersecurity', 'ZeroTrust', 'Networking', 'Private'],
    authorId: 'current-user-id',
    authorName: 'You',
    authorRole: 'student',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    permissionType: 'private',
    allowedUserIds: ['current-user-id'],
    allowedGroupIds: [],
    collaborators: [
      {
        userId: 'current-user-id',
        userName: 'You',
        userRole: 'student',
        permission: 'admin',
        addedAt: '2026-09-22T09:00:00Z'
      }
    ],
    isPinned: true,
    createdAt: '2026-09-22T09:00:00Z',
    updatedAt: '2026-09-23T06:30:00Z'
  }
];

export function getStoredSharedNotes(): SharedBookNote[] {
  if (typeof window === 'undefined') return INITIAL_SHARED_NOTES;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed: SharedBookNote[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Merge missing demo notes
        const existingIds = new Set(parsed.map(n => n.id));
        const missing = INITIAL_SHARED_NOTES.filter(n => !existingIds.has(n.id));
        const combined = [...parsed, ...missing];
        return combined.map(n => ({
          ...n,
          keyTakeaways: Array.isArray(n.keyTakeaways) ? n.keyTakeaways : [],
          tags: Array.isArray(n.tags) ? n.tags : [],
          allowedUserIds: Array.isArray(n.allowedUserIds) ? n.allowedUserIds : [],
          allowedGroupIds: Array.isArray(n.allowedGroupIds) ? n.allowedGroupIds : [],
          collaborators: Array.isArray(n.collaborators) ? n.collaborators : []
        }));
      }
    }
  } catch (err) {
    console.warn('Failed to parse shared book notes from storage:', err);
  }
  return INITIAL_SHARED_NOTES;
}

export function saveStoredSharedNotes(notes: SharedBookNote[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    window.dispatchEvent(new CustomEvent('eduai-shared-notes-updated', { detail: { notes } }));
  } catch (err) {
    console.warn('Failed to persist shared book notes:', err);
  }
}

/**
 * Checks whether a given user has view permission for a shared note
 */
export function canUserViewNote(
  note: SharedBookNote, 
  userId?: string, 
  activeConversationId?: string,
  userGroupIds: string[] = []
): boolean {
  if (!note) return false;
  const uid = userId || 'current-user-id';

  // 1. Author always has access
  if (note.authorId === uid || note.authorId === 'current-user-id') return true;

  // 2. Collaborators listed
  const collaborators = Array.isArray(note.collaborators) ? note.collaborators : [];
  if (collaborators.some(c => c.userId === uid || (c.userId === 'current-user-id' && uid))) return true;

  // 3. Public notes can be viewed by anyone
  if (note.permissionType === 'public') return true;

  const allowedUserIds = Array.isArray(note.allowedUserIds) ? note.allowedUserIds : [];
  const allowedGroupIds = Array.isArray(note.allowedGroupIds) ? note.allowedGroupIds : [];

  // 4. Individual permissions
  if (note.permissionType === 'individual') {
    return allowedUserIds.includes(uid) || allowedUserIds.includes('current-user-id');
  }

  // 5. Group permissions
  if (note.permissionType === 'group') {
    // If active conversation matches
    if (activeConversationId && allowedGroupIds.includes(activeConversationId)) return true;
    if (note.conversationId && activeConversationId === note.conversationId) return true;
    // Or if user is member of one of the allowed groups
    if (userGroupIds.some(gid => allowedGroupIds.includes(gid))) return true;
  }

  return false;
}

/**
 * Checks whether a given user has edit/collaborate permission for a shared note
 */
export function canUserEditNote(note: SharedBookNote, userId?: string): boolean {
  if (!note) return false;
  const uid = userId || 'current-user-id';
  if (note.authorId === uid || note.authorId === 'current-user-id') return true;
  const collaborators = Array.isArray(note.collaborators) ? note.collaborators : [];
  const collab = collaborators.find(c => c.userId === uid || (c.userId === 'current-user-id' && uid));
  return collab ? (collab.permission === 'edit' || collab.permission === 'admin') : false;
}
