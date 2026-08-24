import React, { useState, useEffect, useRef } from 'react';
import { Send, User as UserIcon, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ChatMessage {
  id: string;
  email: string;
  content: string;
  created_at: string;
}

const ROOM_NAME = 'global-student-chat';

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabase) return;

    // Get current user safely
    supabase.auth.getUser()
      .then((res) => {
        setUser(res?.data?.user || null);
      })
      .catch(err => console.warn('Chat getUser error ignored:', err));

    // Mock initial messages
    setMessages([
      { id: '1', email: 'elena.rodriguez@student.edu', content: 'Anyone studying for the upcoming physics finals?', created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: '2', email: 'alex.chen@student.edu', content: 'Yes! I am reviewing kinematics and dynamics today. Do you want to review together?', created_at: new Date(Date.now() - 3000000).toISOString() },
    ]);

    try {
      // Setup Realtime Broadcast
      const channel = supabase.channel(ROOM_NAME, {
        config: {
          broadcast: {
            ack: false,
            self: true
          }
        }
      });

    channel
      .on(
        'broadcast',
        { event: 'new_message' },
        (payload) => {
          setMessages((prev) => {
            // Avoid duplicates just in case
            if (prev.some(m => m.id === payload.payload.id)) return prev;
            return [...prev, payload.payload as ChatMessage];
          });
        }
      )
      .subscribe();

      return () => {
        if (supabase) supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn('Realtime channel setup error:', e);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      email: user.email || 'Anonymous',
      content: newMessage.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');

    // Broadcast message to channel
    const channel = supabase.channel(ROOM_NAME);
    await channel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: message,
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3 shrink-0">
        <div className="bg-brand-100 p-2 rounded-xl text-brand-600">
          <MessageCircle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-display">Global Student Chat</h2>
          <p className="text-sm text-slate-500">Live discussion with peers</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.map((msg, index) => {
          const isMe = user && msg.email === user.email;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className="flex items-center gap-2 mb-1">
                {!isMe && (
                  <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                    <UserIcon className="w-3 h-3" />
                  </div>
                )}
                <span className="text-xs text-slate-500 font-medium">
                  {isMe ? 'You' : msg.email.split('@')[0]}
                </span>
                <span className="text-[10px] text-slate-400">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div 
                className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                  isMe 
                    ? 'bg-brand-600 text-white rounded-tr-sm' 
                    : 'bg-white text-slate-800 border border-slate-100 rounded-tl-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-slate-200 p-4 shrink-0">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={user ? "Type a message..." : "Please sign in to chat..."}
            disabled={!user}
            className="flex-1 bg-slate-100 border-transparent focus:bg-white focus:border-brand-500 rounded-xl px-4 py-3 outline-none transition-all"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || !user}
            className="bg-brand-600 text-white p-3 rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:hover:bg-brand-600 transition-colors flex items-center justify-center shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
