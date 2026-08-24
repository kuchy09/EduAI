import { motion } from 'motion/react';
import { Book } from '../types';
import { 
  Sparkles, Clock, Star, PlayCircle 
} from 'lucide-react';
import { BookCoverVisual } from './BookCoverVisual';
import { DailyReadingGoalCard } from './DailyReadingGoalCard';

interface DashboardProps {
  books: Book[];
  onBookSelect: (book: Book) => void;
  user: any;
  profile?: any;
  onNavigate?: (view: any) => void;
  onAddBookToLibrary?: (book: Book) => void;
}

export function Dashboard({ books, onBookSelect, user, profile, onNavigate }: DashboardProps) {
  // Fallback to user_metadata if profile not found/loaded yet
  const educationLevel = profile?.education_level || user?.user_metadata?.education_level;
  const fieldOfStudy = profile?.field_of_study || user?.user_metadata?.field_of_study;
  const userCurriculum = profile?.curriculum || user?.user_metadata?.curriculum;
  const userCountry = profile?.country || user?.user_metadata?.country || '';
  const userSubjectsRaw = profile?.subjects || user?.user_metadata?.subjects || '';

  const userSubjects = Array.isArray(userSubjectsRaw) 
    ? userSubjectsRaw.map((s: string) => s.toLowerCase()) 
    : typeof userSubjectsRaw === 'string' 
      ? userSubjectsRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) 
      : [];

  const isSchool = educationLevel === 'Primary' || educationLevel === 'High School';

  const personalizedBooks = books.filter(book => {
    const bookSubjects = (book.subjects || []).map(s => s.toLowerCase());
    
    // Always strict match subjects if user has subjects defined
    const matchesSubjects = userSubjects.length > 0 
      ? bookSubjects.some(s => userSubjects.includes(s)) || book.level === 'All'
      : book.level === 'All' || book.category === 'Information and Communication Technologies (ICT)';

    if (isSchool) {
      // Filter school books by curriculum and subjects
      const matchesCurriculum = (book.curriculum?.some(c => c.toLowerCase().includes(userCurriculum?.toLowerCase() || '')) || !book.curriculum || !userCurriculum);
      const matchesCountry = (book.country?.some(c => c.toLowerCase().includes(userCountry?.toLowerCase() || '')) || !book.country || !userCountry);
      const bLevel = book.level?.toLowerCase() || '';
      const isLevelMatch = bLevel === 'school' || bLevel.includes('school');
      return isLevelMatch && matchesCurriculum && matchesCountry && matchesSubjects;
    } else if (educationLevel) {
      // Filter university books by field of study and subjects
      const matchesField = book.category === fieldOfStudy || !fieldOfStudy || book.level === 'All';
      const bLevel = book.level?.toLowerCase() || '';
      const isLevelMatch = bLevel === 'university' || bLevel.includes('uni');
      return isLevelMatch && (matchesField || matchesSubjects);
    }
    
    // If no setup, don't show school or university specific books unless they are general.
    return book.level === 'All' || book.category === 'General' || matchesSubjects; 
  });

  const continueReading = books.filter(b => b.readProgress && b.readProgress > 0 && b.readProgress < 100);
  const recommended = (personalizedBooks.length > 0 ? personalizedBooks : books)
    .filter(b => b.rating >= 4.5)
    .slice(0, 4);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 18) return 'Good afternoon';
    if (hour >= 18 && hour < 22) return 'Good evening';
    return 'Welcome back';
  })();

  const fieldInsights: Record<string, { quote: string; author: string }> = {
    'Business, Administration, and Law': {
      quote: "The best way to predict the future is to create it.",
      author: "Peter Drucker"
    },
    'Engineering, Manufacturing, and Construction': {
      quote: "Scientists study the world as it is; engineers create the world that has never been.",
      author: "Theodore von Kármán"
    },
    'Information and Communication Technologies (ICT)': {
      quote: "Innovation distinguishes between a leader and a follower.",
      author: "Steve Jobs"
    },
    'Health and Welfare': {
      quote: "Wherever the art of Medicine is loved, there is also a love of Humanity.",
      author: "Hippocrates"
    },
    'Natural Sciences, Mathematics, and Statistics': {
      quote: "Nothing in life is to be feared, it is only to be understood. Now is the time to understand more.",
      author: "Marie Curie"
    },
    'Arts and Humanities': {
      quote: "Creativity takes courage.",
      author: "Henri Matisse"
    },
    'Social Sciences': {
      quote: "The function of education is to teach one to think intensively and to think critically.",
      author: "Martin Luther King Jr."
    },
    'Agriculture, Forestry, Fisheries, and Veterinary': {
      quote: "The discovery of agriculture was the first big step toward a civilized life.",
      author: "Arthur Keith"
    },
    'Services': {
      quote: "Always give people more than what they expect to get.",
      author: "Nelson Boswell"
    }
  };

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Learner';
  const displayField = isSchool
    ? 'General Studies'
    : fieldOfStudy;
  
  const insight = fieldInsights[displayField as keyof typeof fieldInsights] || {
    quote: "Education is the most powerful weapon which you can use to change the world.",
    author: "Nelson Mandela"
  };

  const personalizedMessage = continueReading.length > 0 
    ? `I see you're making great progress in "${continueReading[0].title}". You've completed ${continueReading[0].readProgress}% — you're almost there!`
    : `Ready to start your journey in ${displayField || 'learning'}? As ${insight.author} said: "${insight.quote}"`;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8">
      
      {/* Welcome & AI Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="liquid-glass-specular bg-gradient-to-br from-brand-600 to-indigo-800 rounded-3xl p-6 sm:p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8 relative overflow-hidden border border-white/20 shadow-xl"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-medium backdrop-blur-sm">
            <Sparkles className="w-3 h-3" />
            AI Personalized Insight
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold">{greeting}, {firstName}.</h2>
          <p className="text-brand-100 text-lg leading-relaxed italic">
            {personalizedMessage}
          </p>
          <button 
            onClick={() => onNavigate?.('learning-path')} 
            className="mt-2 bg-white text-brand-900 px-6 py-2.5 rounded-full font-medium text-sm hover:bg-brand-50 transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            View My Path
          </button>
        </div>
      </motion.div>

      {/* Daily Reading Goal Widget */}
      <DailyReadingGoalCard />

      {/* Continue Reading */}
      {continueReading.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-brand-500" />
              Continue Reading
            </h3>
            <button className="px-4 py-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">See all</button>
          </div>
          <div className="flex overflow-x-auto gap-6 pb-6 pt-2 px-2 -mx-2 scrollbar-hide snap-x">
            {continueReading.map((book, idx) => (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => onBookSelect(book)}
                key={book.id} 
                className="group cursor-pointer shrink-0 w-32 sm:w-40 snap-start flex flex-col"
              >
                <div className="w-full aspect-[2/3] rounded-lg overflow-hidden shadow-md group-hover:shadow-xl transition-shadow relative mb-3 bg-slate-100">
                  <BookCoverVisual book={book} className="w-full h-full object-cover absolute inset-0" />
                  {book.readProgress !== undefined && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                      <div className="h-full bg-white" style={{ width: book.readProgress + '%' }}></div>
                    </div>
                  )}
                </div>
                <h4 className="font-semibold text-slate-900 leading-tight text-sm line-clamp-2 mb-1">{book.title}</h4>
                <p className="text-xs text-slate-500 line-clamp-1">{book.author}</p>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Trending / Recommended */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400" />
            AI Recommended for You
          </h3>
        </div>
        <div className="flex overflow-x-auto gap-6 pb-6 pt-2 px-2 -mx-2 scrollbar-hide snap-x">
          {recommended.map((book, idx) => (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 + 0.2 }}
              onClick={() => onBookSelect(book)}
              key={book.id} 
              className="group cursor-pointer shrink-0 w-32 sm:w-40 snap-start flex flex-col"
            >
              <div className="w-full aspect-[2/3] rounded-lg overflow-hidden shadow-md group-hover:shadow-xl transition-shadow relative mb-3 bg-slate-100">
                <BookCoverVisual book={book} className="w-full h-full object-cover absolute inset-0" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                  <PlayCircle className="w-10 h-10 text-white drop-shadow-md" />
                </div>
              </div>
              <h4 className="font-semibold text-slate-900 leading-tight text-sm line-clamp-2 mb-1 group-hover:text-brand-600 transition-colors">{book.title}</h4>
              <p className="text-xs text-slate-500 line-clamp-1">{book.author}</p>
            </motion.div>
          ))}
        </div>
      </section>

    </div>
  );
}
