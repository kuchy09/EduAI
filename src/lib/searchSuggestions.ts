import { Book } from '../types';
import { platformBookStoreCatalog } from '../data';

export interface RelatedSearchSuggestion {
  text: string;
  type: 'subject' | 'curriculum' | 'author' | 'topic' | 'popular';
  icon?: string;
  count?: number;
}

// Popular / Trending academic searches
export const POPULAR_ACADEMIC_SEARCHES: string[] = [
  'Calculus & Analytical Geometry',
  'Data Structures & Algorithms',
  'Kenyan CBC Grade 9 Science',
  'Computer Science & Programming',
  'Human Anatomy & Physiology',
  'Microeconomics & Market Analysis',
  'Linear Algebra & Matrices',
  'Organic Chemistry',
  'Commercial & Contract Law',
  'General Physics for Engineering'
];

/**
 * Computes related search query suggestions based on user input query and available books
 */
export function getRelatedSearchSuggestions(query: string, allBooks: Book[] = []): RelatedSearchSuggestion[] {
  const q = query.toLowerCase().trim();
  const combinedBooks = [...allBooks, ...platformBookStoreCatalog];

  if (!q) {
    return POPULAR_ACADEMIC_SEARCHES.slice(0, 6).map(text => ({
      text,
      type: 'popular',
      icon: '🔥'
    }));
  }

  const suggestionsMap = new Map<string, RelatedSearchSuggestion>();

  // 1. Direct Subject & Topic Matches from books
  combinedBooks.forEach(book => {
    // Check subjects
    book.subjects?.forEach(subj => {
      const subjLow = subj.toLowerCase();
      if (subjLow.includes(q) || q.split(' ').some(word => word.length > 2 && subjLow.includes(word))) {
        if (!suggestionsMap.has(subj)) {
          suggestionsMap.set(subj, {
            text: subj,
            type: 'subject',
            icon: '📚'
          });
        }
      }
    });

    // Check curriculum
    book.curriculum?.forEach(cur => {
      const curLow = cur.toLowerCase();
      if (curLow.includes(q) || q.split(' ').some(word => word.length > 2 && curLow.includes(word))) {
        const label = `${cur} Curriculum`;
        if (!suggestionsMap.has(label)) {
          suggestionsMap.set(label, {
            text: cur,
            type: 'curriculum',
            icon: '🎓'
          });
        }
      }
    });

    // Check author
    if (book.author.toLowerCase().includes(q)) {
      const label = `Books by ${book.author}`;
      if (!suggestionsMap.has(label)) {
        suggestionsMap.set(label, {
          text: book.author,
          type: 'author',
          icon: '✍️'
        });
      }
    }

    // Check category
    if (book.category.toLowerCase().includes(q)) {
      if (!suggestionsMap.has(book.category)) {
        suggestionsMap.set(book.category, {
          text: book.category,
          type: 'topic',
          icon: '🏷️'
        });
      }
    }
  });

  // 2. Synthesized related academic terms
  if (q.includes('math') || q.includes('calc') || q.includes('algebra')) {
    ['Calculus I & II', 'Differential Equations', 'Linear Algebra Notes', 'Discrete Mathematics'].forEach(term => {
      if (!suggestionsMap.has(term)) {
        suggestionsMap.set(term, { text: term, type: 'topic', icon: '📐' });
      }
    });
  }

  if (q.includes('phys') || q.includes('mechanic') || q.includes('quantum')) {
    ['Classical Mechanics', 'Quantum Physics', 'Electromagnetism', 'Thermodynamics'].forEach(term => {
      if (!suggestionsMap.has(term)) {
        suggestionsMap.set(term, { text: term, type: 'topic', icon: '⚡' });
      }
    });
  }

  if (q.includes('comp') || q.includes('code') || q.includes('program') || q.includes('data') || q.includes('cs')) {
    ['Data Structures & Algorithms', 'Python Programming', 'Database Systems', 'Artificial Intelligence'].forEach(term => {
      if (!suggestionsMap.has(term)) {
        suggestionsMap.set(term, { text: term, type: 'topic', icon: '💻' });
      }
    });
  }

  if (q.includes('bio') || q.includes('anat') || q.includes('med') || q.includes('health')) {
    ['Human Anatomy & Physiology', 'Cell Biology', 'Genetics & Evolution', 'Medical Microbiology'].forEach(term => {
      if (!suggestionsMap.has(term)) {
        suggestionsMap.set(term, { text: term, type: 'topic', icon: '🧬' });
      }
    });
  }

  if (q.includes('econ') || q.includes('bus') || q.includes('finance') || q.includes('account')) {
    ['Microeconomics', 'Macroeconomics', 'Financial Accounting', 'Corporate Finance'].forEach(term => {
      if (!suggestionsMap.has(term)) {
        suggestionsMap.set(term, { text: term, type: 'topic', icon: '📈' });
      }
    });
  }

  if (q.includes('law') || q.includes('legal') || q.includes('court') || q.includes('right')) {
    ['Constitutional Law', 'Contract Law', 'Criminal Law & Procedure', 'Commercial Law'].forEach(term => {
      if (!suggestionsMap.has(term)) {
        suggestionsMap.set(term, { text: term, type: 'topic', icon: '⚖️' });
      }
    });
  }

  // Also include matching popular searches
  POPULAR_ACADEMIC_SEARCHES.forEach(term => {
    if (term.toLowerCase().includes(q) && !suggestionsMap.has(term)) {
      suggestionsMap.set(term, { text: term, type: 'popular', icon: '🔥' });
    }
  });

  return Array.from(suggestionsMap.values()).slice(0, 8);
}
