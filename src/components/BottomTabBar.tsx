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
      <div className="relative pointer-events-auto">
        <motion.nav 
          initial={{ y: 60, opacity: 0, scale: 0.94 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 26 }}
          className="relative flex items-center justify-center p-1.5 liquid-glass-dock rounded-full select-none"
          aria-label="Main Navigation Tab Bar"
        >
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
                    ? 'text-brand-700 dark:text-brand-400 font-semibold'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {/* Single Active Transitioning Capsule */}
                {isActive && (
                  <motion.div
                    layoutId="activeNavTransitionCapsule"
                    className="absolute inset-0 bg-brand-50 dark:bg-brand-100/90 border border-brand-200 dark:border-brand-300/30 rounded-full shadow-2xs"
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
                    scale: isActive ? 1.06 : 1,
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
                        ? 'text-brand-600 dark:text-brand-400 stroke-[2.2]' 
                        : 'stroke-[1.8] opacity-80'
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

