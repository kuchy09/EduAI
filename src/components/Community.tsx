import React, { useState, useEffect } from 'react';
import { MessageSquare, ThumbsUp, Plus, X, Send, Loader2 } from 'lucide-react';
import { CommunityPost } from './chat/types';
import { AvatarBadge } from './chat/AvatarBadge';
import {
  fetchCommunityPostsApi,
  createCommunityPostApi,
  toggleCommunityLikeApi,
  addCommunityReplyApi,
} from '../lib/socialChatClient';
import { getPersistedDeviceSession } from '../lib/supabase';

export function Community() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postTags, setPostTags] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [replyTextByPost, setReplyTextByPost] = useState<Record<string, string>>({});

  const currentUserId = getPersistedDeviceSession()?.user?.id || '';

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const loaded = await fetchCommunityPostsApi();
        if (active) setPosts(loaded);
      } catch (err) {
        console.warn('[Community] Failed to fetch community posts:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim() || !postContent.trim()) return;
    try {
      setIsSubmitting(true);
      const tags = postTags
        .split(',')
        .map((t) => t.replace(/^#/, '').trim())
        .filter(Boolean);
      const created = await createCommunityPostApi({
        title: postTitle.trim(),
        content: postContent.trim(),
        tags,
      });
      setPosts((prev) => [created, ...prev]);
      setPostTitle('');
      setPostContent('');
      setPostTags('');
      setIsNewPostOpen(false);
    } catch (err) {
      console.warn('[Community] Create post failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    try {
      const updated = await toggleCommunityLikeApi(postId);
      setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
    } catch (err) {
      console.warn('[Community] Toggle like failed:', err);
    }
  };

  const handlePostReply = async (postId: string) => {
    const content = (replyTextByPost[postId] || '').trim();
    if (!content) return;
    try {
      const updated = await addCommunityReplyApi(postId, content);
      setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
      setReplyTextByPost((prev) => ({ ...prev, [postId]: '' }));
    } catch (err) {
      console.warn('[Community] Reply failed:', err);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Recently';
    const diffMins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display mb-1.5">
            Community Forum
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Share study group invites, textbook questions, and peer notes across the network.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsNewPostOpen(true)}
          className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-5 flex items-center justify-center gap-2 font-semibold text-xs transition-colors shadow-xs shrink-0 w-full sm:w-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Post</span>
        </button>
      </div>

      {/* Create Post Modal */}
      {isNewPostOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="fixed inset-0" onClick={() => setIsNewPostOpen(false)} />
          <form
            onSubmit={handleCreatePost}
            className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Start a Community Discussion
              </h3>
              <button
                type="button"
                onClick={() => setIsNewPostOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Topic Title
              </label>
              <input
                type="text"
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                placeholder="e.g., Looking for Physics Paper 2 revision partners"
                className="w-full h-10 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Details
              </label>
              <textarea
                rows={4}
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="Write your question, study plan, or helpful resource summary..."
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={postTags}
                onChange={(e) => setPostTags(e.target.value)}
                placeholder="Physics, StudyGroup, KCSE"
                className="w-full h-10 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewPostOpen(false)}
                className="h-10 px-4 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Publish Post</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="py-16 text-center space-y-2">
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading discussions...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const isLiked = currentUserId ? post.likedBy.includes(currentUserId) : false;
            const isExpanded = expandedPostId === post.id;

            return (
              <div
                key={post.id}
                className="bg-white dark:bg-[#1a1a1d] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-[#2e2e32] shadow-xs space-y-3.5"
              >
                <div className="flex items-center gap-3">
                  <AvatarBadge
                    name={post.authorName}
                    avatarUrl={post.authorAvatar}
                    role={post.authorRole.toLowerCase()}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-[#ededed] truncate">
                      {post.authorName}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {post.authorRole} · {formatTime(post.createdAt)}
                    </p>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                  {post.title}
                </h3>

                <p className="text-slate-600 dark:text-[#c4c4c8] leading-relaxed text-sm whitespace-pre-wrap">
                  {post.content}
                </p>

                {post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-indigo-600 dark:text-indigo-400 text-xs font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-6 pt-3 border-t border-slate-100 dark:border-[#2e2e32] text-xs font-semibold text-slate-500 dark:text-[#a1a1aa]">
                  <button
                    type="button"
                    onClick={() => handleToggleLike(post.id)}
                    className={`flex items-center gap-1.5 transition-colors cursor-pointer tabular-nums ${
                      isLiked
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span>{post.likedBy.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedPostId(isExpanded ? null : post.id)}
                    className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer tabular-nums"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>
                      {post.replies.length} {post.replies.length === 1 ? 'Reply' : 'Replies'}
                    </span>
                  </button>
                </div>

                {/* Expandable Replies Thread */}
                {isExpanded && (
                  <div className="pt-3 border-t border-slate-100 dark:border-[#2e2e32] space-y-3">
                    {post.replies.map((rep) => (
                      <div
                        key={rep.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-[#242429] space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {rep.authorName}{' '}
                            <span className="font-normal text-slate-500 dark:text-slate-400">
                              · {rep.authorRole}
                            </span>
                          </span>
                          <span className="text-[11px] text-slate-400 tabular-nums">
                            {formatTime(rep.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          {rep.content}
                        </p>
                      </div>
                    ))}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={replyTextByPost[post.id] || ''}
                        onChange={(e) =>
                          setReplyTextByPost((prev) => ({ ...prev, [post.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handlePostReply(post.id);
                          }
                        }}
                        placeholder="Write a helpful reply..."
                        className="flex-1 h-9 px-3 rounded-xl bg-slate-50 dark:bg-[#242429] border border-slate-200 dark:border-[#333338] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      />
                      <button
                        type="button"
                        onClick={() => handlePostReply(post.id)}
                        className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" /> Reply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
