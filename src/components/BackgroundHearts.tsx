import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface HeartParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
  tx: number; // target translation x
  ty: number; // target translation y
}

export function BackgroundHearts() {
  const [particles, setParticles] = useState<HeartParticle[]>([]);
  const lastPos = useRef({ x: 0, y: 0 });
  const idCounter = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX: x, clientY: y } = e;
      
      // Calculate distance from last particle
      const dx = x - lastPos.current.x;
      const dy = y - lastPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Only spawn if moved at least 25px to keep it performant and tasteful
      if (distance > 25) {
        lastPos.current = { x, y };
        
        // Colors from the "Geometric Balance" design theme
        const colors = ['#c9a0a8', '#d4adb5', '#e8c8ce', '#f0dde0'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const size = Math.random() * 8 + 8; // size between 8px and 16px
        const rotation = Math.random() * 40 - 20; // rotation between -20 and 20 deg
        
        // Gentle drift offsets
        const tx = Math.random() * 30 - 15;
        const ty = -Math.random() * 30 - 15; // Float upwards

        const newParticle: HeartParticle = {
          id: idCounter.current++,
          x,
          y,
          size,
          color: randomColor,
          rotation,
          tx,
          ty,
        };

        setParticles((prev) => {
          // Keep active particles capped at 25 for exceptional performance
          const kept = prev.slice(-24);
          return [...kept, newParticle];
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.span
            key={p.id}
            initial={{ opacity: 0.8, scale: 0.4, x: p.x - p.size / 2, y: p.y - p.size / 2, rotate: p.rotation }}
            animate={{ 
              opacity: 0, 
              scale: 1.1,
              x: p.x - p.size / 2 + p.tx, 
              y: p.y - p.size / 2 + p.ty,
              rotate: p.rotation * 1.5 
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="absolute select-none pointer-events-none"
            style={{ 
              fontSize: `${p.size}px`,
              color: p.color,
              filter: 'drop-shadow(0 0 3px rgba(201, 160, 168, 0.3))'
            }}
          >
            💖
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
