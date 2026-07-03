import React, { useState, useEffect, useRef } from 'react';

export interface Particle {
  id: number;
  char: string;
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  opacity: number;
  rotation: number;
  rotationSpeed: number;
  scale: number;
  color: string;
}

// Mirror div caret calculation for textareas/inputs
function getCaretCoordinates(element: HTMLTextAreaElement | HTMLInputElement, position: number) {
  if (typeof window === 'undefined') return { top: 0, left: 0 };

  const properties = [
    'direction',
    'boxSizing',
    'width',
    'height',
    'overflowX',
    'overflowY',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'lineHeight',
    'fontFamily',
    'textAlign',
    'textTransform',
    'textIndent',
    'textDecoration',
    'letterSpacing',
    'wordSpacing'
  ];

  const div = document.createElement('div');
  div.id = 'input-textarea-caret-position-mirror-div';
  document.body.appendChild(div);

  const style = div.style;
  const computed = window.getComputedStyle(element);

  style.whiteSpace = 'pre-wrap';
  if (element.tagName !== 'INPUT') {
    style.wordWrap = 'break-word';
  }

  style.position = 'absolute';
  style.visibility = 'hidden';

  properties.forEach(prop => {
    // @ts-ignore
    style[prop] = computed[prop];
  });

  // Take borders into account
  style.borderStyle = 'solid';

  div.textContent = element.value.substring(0, position);
  
  if (element.tagName === 'INPUT') {
    div.textContent = div.textContent.replace(/\s/g, '\u00a0');
  }

  const span = document.createElement('span');
  span.textContent = element.value.substring(position) || '.';
  div.appendChild(span);

  const spanRect = span.getBoundingClientRect();
  const divRect = div.getBoundingClientRect();

  document.body.removeChild(div);

  return {
    top: spanRect.top - divRect.top,
    left: spanRect.left - divRect.left
  };
}

// Global list of particles to draw over everything
let globalParticleId = 0;
type ParticleListener = (particles: Particle[]) => void;
const listeners = new Set<ParticleListener>();
let activeParticles: Particle[] = [];

export function spawnRomanticParticle(x: number, y: number) {
  // Respect reduced-motion preferences
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const particlesPool = [
    // Tiny pink hearts
    '💖', '💕', '🩷', '💝',
    // Small sparkles
    '✨', '✨',
    // Soft glowing petals
    '🌸', '🌸',
    // Mini twinkling stars
    '⭐', '🌟'
  ];

  const colors = [
    'text-pink-400',
    'text-pink-300',
    'text-rose-400',
    'text-rose-300',
    'text-amber-300', // for gold sparkles/stars
  ];

  const randomChar = particlesPool[Math.floor(Math.random() * particlesPool.length)];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  const size = Math.floor(Math.random() * 12) + 12; // 12px to 24px
  
  // Speed values
  const angle = (Math.random() * 40 - 20) * (Math.PI / 180); // -20deg to 20deg
  const speed = Math.random() * 1.5 + 1.2; // vertical float speed
  const vx = Math.sin(angle) * (Math.random() * 0.8 + 0.2);
  const vy = -speed; // upward float
  
  const newParticle: Particle = {
    id: ++globalParticleId,
    char: randomChar,
    x,
    y,
    size,
    vx,
    vy,
    opacity: 0.9,
    rotation: Math.random() * 360,
    rotationSpeed: Math.random() * 4 - 2,
    scale: 0.1, // starts small pop
    color: randomColor
  };

  activeParticles = [...activeParticles.slice(-60), newParticle]; // cap max screen particles for performance
  listeners.forEach(l => l(activeParticles));
}

// Typing particle container rendered at the body level
export function RomanticParticleCanvas() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const handleUpdate = (updated: Particle[]) => {
      setParticles(updated);
    };
    listeners.add(handleUpdate);

    // Animation loop using RequestAnimationFrame for buttery 60 FPS
    let animFrame: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = (time - lastTime) / 16.66; // normalized dt around 60fps
      lastTime = time;

      if (activeParticles.length > 0) {
        let needsUpdate = false;
        const updated = activeParticles
          .map(p => {
            // scale pops up to 1
            const nextScale = p.scale < 1 ? Math.min(1, p.scale + 0.15) : 1;
            // slowly fade out
            const nextOpacity = p.opacity - 0.015 * dt;

            if (nextOpacity <= 0) {
              needsUpdate = true;
              return null;
            }

            return {
              ...p,
              x: p.x + p.vx * dt,
              y: p.y + p.vy * dt,
              scale: nextScale,
              opacity: nextOpacity,
              rotation: p.rotation + p.rotationSpeed * dt
            };
          })
          .filter(Boolean) as Particle[];

        if (needsUpdate || updated.length !== activeParticles.length || updated.some(p => p.x !== p.x)) {
          activeParticles = updated;
          setParticles(updated);
        }
      }

      animFrame = requestAnimationFrame(loop);
    };

    animFrame = requestAnimationFrame(loop);

    return () => {
      listeners.delete(handleUpdate);
      cancelAnimationFrame(animFrame);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className={`absolute select-none transition-transform duration-75 ease-out`}
          style={{
            left: p.x,
            top: p.y,
            fontSize: `${p.size}px`,
            opacity: p.opacity,
            transform: `translate(-50%, -50%) scale(${p.scale}) rotate(${p.rotation}deg)`,
          }}
        >
          {p.char}
        </div>
      ))}
    </div>
  );
}

// Enhancing Inputs and Textareas automatically with romantic sparkles
interface EnhancedProps {
  onInput?: React.FormEventHandler<HTMLTextAreaElement | HTMLInputElement>;
}

export function useRomanticTyping<T extends HTMLTextAreaElement | HTMLInputElement>() {
  const ref = useRef<T>(null);

  const handleInput = (e: React.FormEvent<T>) => {
    const el = e.currentTarget;
    if (!el) return;

    // spawn particles with 35% probability to avoid visual fatigue
    if (Math.random() > 0.35) return;

    try {
      const selStart = el.selectionStart || 0;
      const rect = el.getBoundingClientRect();
      const coords = getCaretCoordinates(el, selStart);

      // Caret coordinates relative to viewport
      const absoluteX = rect.left + coords.left - el.scrollLeft + window.scrollX;
      const absoluteY = rect.top + coords.top - el.scrollTop + window.scrollY;

      // Ensure we don't spawn completely outside the element box
      const bufferedX = Math.max(rect.left + 5, Math.min(rect.right - 5, absoluteX));
      const bufferedY = Math.max(rect.top + 5, Math.min(rect.bottom - 5, absoluteY));

      spawnRomanticParticle(bufferedX, bufferedY);
    } catch (err) {
      // Fallback: spawn in viewport center of input rect
      const rect = el.getBoundingClientRect();
      spawnRomanticParticle(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  };

  return { ref, handleInput };
}
