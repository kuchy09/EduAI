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
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-2">Community Forum</h2>
          <p className="text-slate-500 text-sm">Connect with thousands of students and educators worldwide.</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-2.5 sm:py-2 flex items-center justify-center gap-2 font-medium text-sm transition-colors shadow-sm shrink-0 w-full sm:w-auto">
          <Plus className="w-4 h-4" /> 
          <span>New Post</span>
        </button>
      </div>

      <div className="space-y-4">
        {posts.map((post, idx) => (
          <div key={idx} className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-start sm:items-center gap-3">
                <img src={post.avatar} alt={post.author} className="w-10 h-10 rounded-full object-cover shrink-0" />
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <h4 className="font-bold text-slate-900">{post.author}</h4>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${post.role === 'Educator' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
                      {post.role}
                    </span>
                    <span className="text-slate-400 text-sm">• {post.time}</span>
                  </div>
                </div>
              </div>
              <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors self-start sm:self-auto">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
            
            <h3 className="text-lg font-bold text-slate-900">{post.title}</h3>
            
            <p className="text-slate-600 leading-relaxed text-[15px]">{post.content}</p>
            
            <div className="flex flex-wrap gap-2">
              {post.tags.map(tag => (
                <span key={tag} className="text-purple-600 text-[13px] font-medium">{tag}</span>
              ))}
            </div>

            <div className="flex items-center gap-6 pt-4 text-sm font-medium text-slate-500">
              <button className="flex items-center gap-2 hover:text-slate-800 transition-colors">
                <ThumbsUp className="w-4 h-4" /> {post.likes}
              </button>
              <button className="flex items-center gap-2 hover:text-slate-800 transition-colors">
                <MessageSquare className="w-4 h-4" /> {post.comments} Replies
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
