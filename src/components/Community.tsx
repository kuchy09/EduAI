import { MessageSquare, ThumbsUp, Share2, Plus } from 'lucide-react';

export function Community() {
  const posts = [
    { 
      author: 'Elena Rodriguez', 
      role: 'Student',
      time: '2h ago',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=100',
      title: 'Study Group for Calculus II midterm?', 
      content: "Looking for 3-4 people to join a focused study session this weekend. We'll be covering integration by parts and differential equations. Anyone interested?", 
      tags: ['#StudyGroup', '#Calculus'],
      likes: 8, 
      comments: 12 
    },
    { 
      author: 'Prof. James Wilson', 
      role: 'Educator',
      time: '5h ago',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=100',
      title: 'Best practices for LLM prompting in research', 
      content: "I've compiled a list of effective strategies for using AI tools to assist with literature reviews without compromising academic integrity. Check out the attached PDF guide.", 
      tags: ['#AI', '#Research', '#AcademicIntegrity'],
      likes: 42, 
      comments: 5 
    },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Community Forum</h2>
          <p className="text-slate-500 text-sm">Connect with thousands of students and educators worldwide.</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-2.5 sm:py-2 flex items-center justify-center gap-2 font-medium text-sm transition-colors shadow-sm shrink-0 w-full sm:w-auto">
          <Plus className="w-4 h-4" /> 
          <span>New Post</span>
        </button>
      </div>

      <div className="space-y-4">
        {posts.map((post, idx) => (
          <div key={idx} className="bg-white dark:bg-[#1a1a1d] p-4 sm:p-6 rounded-xl border border-slate-200 dark:border-[#2e2e32] shadow-sm dark:shadow-[0_8px_28px_-4px_rgba(0,0,0,0.55)] space-y-4">
            <div className="flex items-center justify-between bg-transparent">
              <div className="flex items-start sm:items-center gap-3">
                <img src={post.avatar} alt={post.author} className="w-10 h-10 rounded-full object-cover shrink-0" />
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <h4 className="font-bold text-slate-900 dark:text-[#ededed]">{post.author}</h4>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${post.role === 'Educator' ? 'bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300' : 'bg-[#f4f4f6] dark:bg-[#27272c] text-slate-600 dark:text-[#d4d4d8]'}`}>
                      {post.role}
                    </span>
                    <span className="text-slate-400 dark:text-[#8e8e93] text-sm">• {post.time}</span>
                  </div>
                </div>
              </div>
              <button className="p-2 rounded-lg bg-transparent hover:bg-[#f5f5f7] dark:bg-[#242429] dark:hover:bg-[#2e2e35] text-slate-400 dark:text-[#a1a1aa] hover:text-slate-600 dark:hover:text-white transition-colors self-start sm:self-auto cursor-pointer">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
            
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{post.title}</h3>
            
            <p className="text-slate-600 dark:text-[#c4c4c8] leading-relaxed text-[15px]">{post.content}</p>
            
            <div className="flex flex-wrap gap-2">
              {post.tags.map(tag => (
                <span key={tag} className="text-purple-600 dark:text-[#a78bfa] text-[13px] font-medium">{tag}</span>
              ))}
            </div>

            <div className="flex items-center gap-6 pt-4 text-sm font-medium text-slate-500 dark:text-[#a1a1aa]">
              <button className="flex items-center gap-2 hover:text-slate-800 dark:hover:text-white transition-colors">
                <ThumbsUp className="w-4 h-4" /> {post.likes}
              </button>
              <button className="flex items-center gap-2 hover:text-slate-800 dark:hover:text-white transition-colors">
                <MessageSquare className="w-4 h-4" /> {post.comments} Replies
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
