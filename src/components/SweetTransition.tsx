import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SweetTransitionProps {
  text: string;
  isOpen: boolean;
  onComplete: () => void;
}

export function SweetTransition({ text, isOpen, onComplete }: SweetTransitionProps) {
  const [particles, setParticles] = useState<{ id: number; char: string; left: number; delay: number; scale: number; duration: number }[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Spawn floating hearts and sparkles on overlay load
      const pool = ['💖', '💕', '🩷', '✨', '🌸', '💝', '⭐'];
      const spawned = Array.from({ length: 25 }).map((_, i) => ({
        id: i,
        char: pool[Math.floor(Math.random() * pool.length)],
        left: Math.random() * 100, // percentage width
        delay: Math.random() * 2,  // stagger delay
        scale: Math.random() * 0.6 + 0.6,
        duration: Math.random() * 2.5 + 2.5, // 2.5 to 5.0 seconds rise
      }));
      setParticles(spawned);

      // Transition automatically completes after 3.8 seconds
      const timer = setTimeout(() => {
        onComplete();
      }, 3800);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[500] flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #1a050d 0%, #2b0b16 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Floating background particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {particles.map(p => (
              <motion.div
                key={p.id}
                className="absolute text-lg select-none"
                style={{ left: `${p.left}%`, bottom: '-20px' }}
                initial={{ y: 0, opacity: 0, scale: p.scale }}
                animate={{
                  y: '-110vh',
                  opacity: [0, 0.7, 0.7, 0],
                  scale: [p.scale, p.scale * 1.3, p.scale * 0.7],
                  rotate: [0, Math.random() * 180 - 90],
                }}
                transition={{
                  duration: p.duration,
                  ease: 'easeOut',
                  delay: p.delay,
                  repeat: Infinity,
                }}
              >
                {p.char}
              </motion.div>
            ))}
          </div>

          {/* Sweet text card */}
          <motion.div
            className="relative max-w-xl mx-auto p-8 rounded-3xl bg-white/5 border border-white/10 shadow-[0_15px_40px_rgba(0,0,0,0.6)] z-10 backdrop-blur-md"
            initial={{ scale: 0.9, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -10 }}
            transition={{ type: 'spring', damping: 15, delay: 0.1 }}
          >
            {/* Small decorative heart */}
            <motion.div
              className="text-3xl mb-4 text-[#ff4d6d]"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
            >
              💝
            </motion.div>

            {/* Quote display */}
            <motion.p
              className="font-display font-light italic text-[#fff0f3] text-lg sm:text-xl md:text-2xl leading-relaxed tracking-tight"
              animate={{ opacity: [0.85, 1, 0.85], scale: [1, 1.02, 1] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            >
              "{text}"
            </motion.p>

            {/* Secondary note */}
            <p className="mt-4 text-[10px] font-sans text-pink-300/40 uppercase tracking-widest font-bold">
              Saving your thoughts in my heart...
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
