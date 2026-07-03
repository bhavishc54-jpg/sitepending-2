import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MEOW_WORDS } from '../types';

interface CuteCatProps {
  big?: boolean;
  onClickCat?: () => void;
  className?: string;
}

export function CuteCat({ big = false, onClickCat, className = "" }: CuteCatProps) {
  const [meowText, setMeowText] = useState("meow meow cutie pie 🐾");
  const [showMeow, setShowMeow] = useState(false);
  const [bounce, setBounce] = useState(false);

  // Cycle meow messages occasionally
  useEffect(() => {
    const interval = setInterval(() => {
      const randomWord = MEOW_WORDS[Math.floor(Math.random() * MEOW_WORDS.length)];
      setMeowText(randomWord);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleInteraction = () => {
    // Soft bounce animation
    setBounce(true);
    setTimeout(() => setBounce(false), 500);

    // Show meow text bubble
    const randomWord = MEOW_WORDS[Math.floor(Math.random() * MEOW_WORDS.length)];
    setMeowText(randomWord);
    setShowMeow(true);

    // Hide meow text after 2 seconds
    const timer = setTimeout(() => setShowMeow(false), 2000);

    // Web Audio synthesizer meow-like sound!
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = 'triangle';
      // Pitch sweeps up to imitate a meow
      osc.frequency.setValueAtTime(450, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.15);
      osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.3);
      
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      // AudioContext fails gracefully if not allowed
    }

    if (onClickCat) {
      onClickCat();
    }
  };

  return (
    <div 
      className={`relative inline-block select-none cursor-pointer ${className}`}
      onClick={handleInteraction}
      onMouseEnter={() => setShowMeow(true)}
      onMouseLeave={() => setShowMeow(false)}
    >
      {/* Meow speech bubble */}
      <AnimatePresence>
        {showMeow && (
          <motion.div
            className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] sm:text-xs text-pink-300 font-sans border border-white/10 shadow-lg whitespace-nowrap z-30 uppercase tracking-widest font-bold"
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -5 }}
            transition={{ type: 'spring', damping: 12 }}
          >
            {meowText}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Cat SVG wrapped in spring motion */}
      <motion.div
        animate={bounce ? { scaleY: [1, 0.85, 1.1, 0.95, 1], scaleX: [1, 1.15, 0.9, 1.05, 1] } : {}}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        whileHover={{ scale: 1.05 }}
        className={big ? "w-[150px] h-[150px] sm:w-[180px] sm:h-[180px]" : "w-[65px] h-[65px] sm:w-[75px] sm:h-[75px]"}
      >
        <svg 
          viewBox="0 0 200 200" 
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-md"
        >
          {/* Body */}
          <ellipse cx="100" cy="140" rx="55" ry="45" fill="#f8c0d0"/>
          {/* Head */}
          <ellipse cx="100" cy="90" rx="40" ry="35" fill="#f8c0d0"/>
          {/* Ears */}
          <polygon points="68,65 60,30 85,55" fill="#f8c0d0"/>
          <polygon points="132,65 140,30 115,55" fill="#f8c0d0"/>
          {/* Inner Ears */}
          <polygon points="68,65 62,35 83,55" fill="#ffb6d3"/>
          <polygon points="132,65 138,35 117,55" fill="#ffb6d3"/>
          {/* Eyes */}
          <ellipse cx="85" cy="85" rx="6" ry="7" fill="#5a2d3a"/>
          <ellipse cx="115" cy="85" rx="6" ry="7" fill="#5a2d3a"/>
          {/* Eye reflections */}
          <ellipse cx="87" cy="83" rx="2" ry="2.5" fill="white"/>
          <ellipse cx="117" cy="83" rx="2" ry="2.5" fill="white"/>
          {/* Cute pink cheeks */}
          <ellipse cx="78" cy="92" rx="6" ry="3" fill="rgba(231,90,151,0.25)"/>
          <ellipse cx="122" cy="92" rx="6" ry="3" fill="rgba(231,90,151,0.25)"/>
          {/* Nose */}
          <ellipse cx="100" cy="97" rx="4" ry="3" fill="#e75a97"/>
          {/* Mouth */}
          <path d="M96 100 Q100 106 104 100" stroke="#5a2d3a" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          {/* Whiskers */}
          <path d="M75 95 L55 90" stroke="#d4849e" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M75 98 L55 100" stroke="#d4849e" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M125 95 L145 90" stroke="#d4849e" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M125 98 L145 100" stroke="#d4849e" strokeWidth="1.2" strokeLinecap="round"/>
          {/* Tail */}
          <path d="M140 170 Q150 175 155 165 Q165 140 155 135" stroke="#f8c0d0" strokeWidth="8" fill="none" strokeLinecap="round"/>
        </svg>
      </motion.div>
    </div>
  );
}
