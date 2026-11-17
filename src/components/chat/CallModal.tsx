import React, { useState, useEffect } from 'react';
import { 
  PhoneOff, Mic, MicOff, Video, VideoOff
} from 'lucide-react';
import { CallSession } from './types';
import { AvatarBadge } from './AvatarBadge';

interface CallModalProps {
  callSession: CallSession;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  callSession,
  onEndCall,
  onToggleMute,
  onToggleVideo
}) => {
  const { partner, type, isMuted, isVideoOff } = callSession;
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
  };

  if (!partner) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col text-white animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="p-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Edu AI Encrypted {type === 'video' ? 'Video Class' : 'Audio Call'}
            </span>
          </div>
          <div className="px-2.5 py-1 rounded-full bg-slate-800 text-xs font-mono text-emerald-400">
            {formatTime(seconds)}
          </div>
        </div>

        {/* Video / Visual Screen */}
        <div className="relative h-80 sm:h-96 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 flex flex-col items-center justify-center p-6 text-center">
          {type === 'video' && !isVideoOff ? (
            <div className="absolute inset-0 overflow-hidden">
              {partner.avatar && (
                <img
                  src={partner.avatar}
                  alt={partner.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover blur-xs opacity-40 scale-105"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-slate-950/80" />
              
              {/* Picture-in-picture student preview */}
              <div className="absolute top-4 right-4 w-24 h-32 rounded-xl bg-slate-800 border-2 border-slate-700/80 shadow-lg overflow-hidden flex items-center justify-center">
                <div className="text-[10px] text-slate-400">You (HD)</div>
              </div>
            </div>
          ) : null}

          {/* Caller Details */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="relative mb-4">
              <AvatarBadge
                name={partner.name}
                avatarUrl={partner.avatar}
                role={partner.role}
                size="xl"
              />
            </div>

            <h3 className="text-xl font-bold text-white mb-1">{partner.name}</h3>
            <p className="text-xs text-slate-400 max-w-xs">
              {partner.role === 'teacher' ? 'Educator' : 'Student'} · {partner.institution}
            </p>

            {/* Audio Waveform Animation */}
            <div className="flex items-center gap-1.5 mt-6 h-8">
              {[40, 75, 100, 60, 85, 45, 90, 65, 30].map((h, i) => (
                <span 
                  key={i} 
                  style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }}
                  className="w-1 bg-indigo-400 rounded-full animate-pulse" 
                />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Call Controls */}
        <div className="p-6 bg-slate-950 border-t border-slate-800/80 flex items-center justify-center gap-4">
          <button
            onClick={onToggleMute}
            className={`w-13 h-13 rounded-full flex items-center justify-center transition-all ${
              isMuted 
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
            title={isMuted ? "Unmute Mic" : "Mute Mic"}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {type === 'video' && (
            <button
              onClick={onToggleVideo}
              className={`w-13 h-13 rounded-full flex items-center justify-center transition-all ${
                isVideoOff 
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
              title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
          )}

          {/* End Call Button */}
          <button
            onClick={onEndCall}
            className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-all hover:scale-105 active:scale-95"
            title="End Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
