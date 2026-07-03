import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface ExplosionParticle {
  id: number;
  emoji: string;
  startX: string;
  startY: string;
  endX: string;
  endY: string;
  size: number;
  duration: number;
  delay: number;
  rotation: number;
}

export function HeartExplosion() {
  const [particles, setParticles] = useState<ExplosionParticle[]>([]);

  useEffect(() => {
    const list: ExplosionParticle[] = [];
    let idCounter = 0;

    const emojis = ['💖', '💕', '💝', '💗', '💓', '💞', '💘', '💌', '🌸', '✨', '👑', '🌹'];

    // 1. Central Burst (Triggered immediately)
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 150 + Math.random() * 300; // pixels
      const size = 16 + Math.random() * 32; // size from 16px to 48px
      const duration = 1.2 + Math.random() * 1.5;
      const delay = Math.random() * 0.2;
      const rotation = Math.random() * 720 - 360;

      list.push({
        id: idCounter++,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        startX: '50vw',
        startY: '50vh',
        endX: `calc(50vw + ${Math.cos(angle) * distance}px)`,
        endY: `calc(50vh + ${Math.sin(angle) * distance - 80}px)`, // drifts up
        size,
        duration,
        delay,
        rotation,
      });
    }

    // 2. Left Fountain (Staggered slightly)
    for (let i = 0; i < 30; i++) {
      // Angle between -75 deg and -15 deg (pointing up and right)
      const angle = (-75 + Math.random() * 60) * (Math.PI / 180);
      const distance = 250 + Math.random() * 450;
      const size = 14 + Math.random() * 26;
      const duration = 1.5 + Math.random() * 1.5;
      const delay = 0.2 + Math.random() * 0.4;
      const rotation = Math.random() * 540 - 270;

      list.push({
        id: idCounter++,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        startX: '5vw',
        startY: '95vh',
        endX: `calc(5vw + ${Math.cos(angle) * distance}px)`,
        endY: `calc(95vh + ${Math.sin(angle) * distance}px)`,
        size,
        duration,
        delay,
        rotation,
      });
    }

    // 3. Right Fountain (Staggered slightly)
    for (let i = 0; i < 30; i++) {
      // Angle between -165 deg and -105 deg (pointing up and left)
      const angle = (-165 + Math.random() * 60) * (Math.PI / 180);
      const distance = 250 + Math.random() * 450;
      const size = 14 + Math.random() * 26;
      const duration = 1.5 + Math.random() * 1.5;
      const delay = 0.2 + Math.random() * 0.4;
      const rotation = Math.random() * 540 - 270;

      list.push({
        id: idCounter++,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        startX: '95vw',
        startY: '95vh',
        endX: `calc(95vw + ${Math.cos(angle) * distance}px)`,
        endY: `calc(95vh + ${Math.sin(angle) * distance}px)`,
        size,
        duration,
        delay,
        rotation,
      });
    }

    setParticles(list);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{
            left: p.startX,
            top: p.startY,
            scale: 0,
            opacity: 0,
            rotate: 0,
            x: '-50%',
            y: '-50%',
          }}
          animate={{
            left: p.endX,
            top: p.endY,
            scale: [0, 1.3, 1, 0.7, 0],
            opacity: [0, 1, 1, 0.8, 0],
            rotate: p.rotation,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: [0.1, 0.8, 0.3, 1], // beautiful outward deceleration
          }}
          className="absolute pointer-events-none select-none"
          style={{
            fontSize: `${p.size}px`,
            filter: 'drop-shadow(0 4px 10px rgba(255, 77, 109, 0.35))',
          }}
        >
          {p.emoji}
        </motion.div>
      ))}
    </div>
  );
}
