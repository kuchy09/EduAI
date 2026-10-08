import React from 'react';
import { motion } from 'motion/react';
import { Home, Library, ShoppingBag, Headphones } from 'lucide-react';
import { AstroidIcon } from './icons/AstroidIcon';
import { ViewState } from '../types';
import { triggerCapsuleFeedback } from '../lib/feedback';

interface BottomTabBarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
}

interface TabItem {
  id: ViewState;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabItem[] = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'ai-tutor', label: 'Sage', icon: AstroidIcon },
  { id: 'book-store', label: 'Bookstore', icon: ShoppingBag },
  { id: 'audiobooks', label: 'Audiobooks', icon: Headphones },
];

export function BottomTabBar({ currentView, onChangeView }: BottomTabBarProps) {
  // Hide bottom tab bar in full-screen reader mode
  if (currentView === 'reader') {
    return null;
  }

  const handleTabClick = (tabId: ViewState, index: number) => {
    // Pitch varies slightly by tab index to give melodic spatial depth
    const pitch = 500 + index * 40;
    triggerCapsuleFeedback({ pitch, volume: 0.18, hapticDuration: 14 });
    onChangeView(tabId);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 flex justify-center items-center pointer-events-none pb-3 px-3 sm:px-4">
      {/* Outer ambient liquid refraction glow */}
      <div className="relative pointer-events-auto">
        <div className="absolute -inset-1 bg-gradient-to-r from-brand-500/20 via-indigo-500/20 to-purple-500/20 rounded-full blur-xl opacity-75 dark:opacity-40 pointer-events-none" />

        <motion.nav 
          initial={{ y: 60, opacity: 0, scale: 0.92 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 26 }}
          className="relative flex items-center justify-center p-1.5 liquid-glass-dock rounded-full select-none shadow-2xl"
          aria-label="Main Navigation Tab Bar"
        >
          {/* Top specular reflection rim highlight */}
          <div className="absolute top-0 inset-x-4 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/30 to-transparent pointer-events-none rounded-full" />

          {TABS.map((tab, idx) => {
            const isActive = currentView === tab.id;
            const Icon = tab.icon;

            return (
              <motion.button
                key={tab.id}
                onClick={() => handleTabClick(tab.id, idx)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                className={`relative flex flex-col items-center justify-center gap-0.5 sm:gap-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full min-w-[58px] sm:min-w-[70px] transition-colors select-none outline-none focus-visible:ring-2 focus-visible:ring-brand-500 cursor-pointer bg-transparent border-0 shadow-none ${
                  isActive
                    ? 'text-brand-700 dark:text-brand-200 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {/* Single Active Transitioning Capsule */}
                {isActive && (
                  <motion.div
                    layoutId="activeNavTransitionCapsule"
                    className="absolute inset-0 liquid-glass-pill rounded-full"
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 28,
                      mass: 0.7,
                    }}
                  />
                )}

                {/* Animated Icon */}
                <motion.div
                  className="relative z-10 flex items-center justify-center"
                  animate={{
                    scale: isActive ? 1.08 : 1,
                    y: isActive ? -1 : 0,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 480,
                    damping: 18,
                    mass: 0.4,
                  }}
                >
                  <Icon 
                    className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors duration-200 ${
                      isActive 
                        ? 'text-brand-600 dark:text-brand-300 stroke-[2.4]' 
                        : 'stroke-[1.9] opacity-75 group-hover:opacity-100'
                    }`} 
                  />
                </motion.div>

                {/* Text Label */}
                <motion.span 
                  className="relative z-10 tracking-tight text-[10px] sm:text-[11px] leading-none select-none whitespace-nowrap"
                  animate={{
                    fontWeight: isActive ? 600 : 500,
                  }}
                >
                  {tab.label}
                </motion.span>
              </motion.button>
            );
          })}
        </motion.nav>
      </div>
    </div>
  );
}

