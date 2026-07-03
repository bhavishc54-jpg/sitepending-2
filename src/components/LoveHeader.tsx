import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface LoveHeaderProps {
  currentQuestion: number; // 1-indexed, e.g., 1 to 14
  totalQuestions: number;  // 14
  isGlowing: boolean;       // whether progress bar is currently glowing (e.g. after next)
  isPulsing: boolean;       // whether progress bar is currently pulsing
}

export function LoveHeader({ currentQuestion, totalQuestions, isGlowing, isPulsing }: LoveHeaderProps) {
  const percentage = Math.round(((currentQuestion - 1) / totalQuestions) * 100);
  const [displayedPct, setDisplayedPct] = useState(0);
  const [headerHearts, setHeaderHearts] = useState<{ id: number; x: number; y: number; delay: number }[]>([]);
  const [headerSparkles, setHeaderSparkles] = useState<{ id: number; x: number; y: number }[]>([]);

  // Smooth counting animation for percentage
  useEffect(() => {
    let start = displayedPct;
    const end = percentage;
    if (start === end) return;

    const duration = 800; // ms
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutQuad
      const ease = progress * (2 - progress);
      const current = Math.round(start + (end - start) * ease);
      setDisplayedPct(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [percentage]);

  // Periodic floating hearts around the header (occasionally)
  useEffect(() => {
    const interval = setInterval(() => {
      const id = Date.now() + Math.random();
      // Random position around the header box (width ~480px, height ~100px)
      const x = Math.random() * 100; // percent
      const delay = Math.random() * 0.5;
      
      setHeaderHearts(prev => [...prev.slice(-5), { id, x, y: 110, delay }]);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Small sparkle animation every few seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const id = Date.now() + Math.random();
      const x = Math.random() * 100; // percent
      const y = Math.random() * 100; // percent
      
      setHeaderSparkles(prev => [...prev.slice(-3), { id, x, y }]);
      
      // Clean up sparkle after animation completes
      setTimeout(() => {
        setHeaderSparkles(prev => prev.filter(s => s.id !== id));
      }, 1500);
    }, 3200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 w-[94%] max-w-lg z-50 pointer-events-none font-sans">
      {/* Floating glassmorphic container */}
      <motion.div
        className="relative rounded-2xl p-[1px] overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 77, 109, 0.2), rgba(255, 133, 161, 0.1))',
        }}
        animate={{
          boxShadow: isGlowing
            ? '0 15px 35px rgba(255, 77, 109, 0.35), 0 0 25px rgba(255, 133, 161, 0.25)'
            : '0 10px 30px rgba(0, 0, 0, 0.5)',
        }}
        transition={{ duration: 0.4 }}
      >
        {/* Shimmer overlay moving slowly across the card */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] animate-[shimmer_6s_infinite_linear] pointer-events-none" />

        <div className="relative backdrop-blur-2xl bg-white/5 rounded-2xl p-3.5 pointer-events-auto border border-white/5">
          {/* Header sparkles layer */}
          <AnimatePresence>
            {headerSparkles.map(s => (
              <motion.span
                key={s.id}
                className="absolute text-pink-300 text-xs pointer-events-none z-10"
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
                initial={{ opacity: 0, scale: 0, rotate: 0 }}
                animate={{ opacity: 1, scale: [1, 1.4, 1], rotate: 180 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ duration: 1.2 }}
              >
                ✨
              </motion.span>
            ))}
          </AnimatePresence>

          {/* Header floating hearts */}
          <AnimatePresence>
            {headerHearts.map(h => (
              <motion.span
                key={h.id}
                className="absolute text-[11px] pointer-events-none z-10"
                style={{ left: `${h.x}%` }}
                initial={{ y: 35, opacity: 0, scale: 0.5 }}
                animate={{
                  y: -35,
                  opacity: [0, 0.8, 0],
                  scale: [0.6, 1.1, 0.5],
                  x: [0, Math.sin(h.id) * 15, 0],
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 3.5, ease: 'easeOut', delay: h.delay }}
                onAnimationComplete={() => {
                  setHeaderHearts(prev => prev.filter(x => x.id !== h.id));
                }}
              >
                💖
              </motion.span>
            ))}
          </AnimatePresence>

          {/* Text and stats matching Geometric Balance */}
          <div className="flex justify-between items-end mb-2">
            <div>
              <h1 className="text-[10px] uppercase tracking-[0.3em] font-outfit text-pink-300/80 mb-0.5 font-bold">
                💖 Love Journey
              </h1>
              <p className="text-sm font-medium text-white/90">
                Question <span className="font-semibold text-white">{String(currentQuestion).padStart(2, '0')}</span>{' '}
                <span className="text-pink-300/50 italic text-xs">of {totalQuestions}</span>
              </p>
            </div>
            <div className="text-right">
              <motion.span 
                className="text-xl font-light tracking-tighter text-white font-outfit"
                animate={{ scale: isPulsing ? [1, 1.15, 1] : 1 }}
                transition={{ duration: 0.5 }}
              >
                {displayedPct}%
              </motion.span>
              <span className="block text-[8px] uppercase tracking-widest text-pink-300/50 font-bold">
                Completed
              </span>
            </div>
          </div>

          {/* Progress bar container */}
          <div className="w-full h-[6px] bg-black/40 rounded-full overflow-hidden border border-white/5 relative">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#ff4d6d] via-[#ff85a1] to-[#ffb3c1]"
              initial={{ width: 0 }}
              animate={{
                width: `${percentage}%`,
                scaleY: isPulsing ? [1, 1.35, 1] : 1,
                boxShadow: isGlowing ? '0 0 10px rgba(255, 77, 109, 0.8)' : '0 0 4px rgba(255, 77, 109, 0.3)',
              }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
