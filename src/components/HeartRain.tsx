import React, { useEffect, useRef } from 'react';

interface Heart {
  x: number;
  y: number;
  size: number;
  speed: number;
  swaySpeed: number;
  swayAmount: number;
  swayOffset: number;
  symbol: string;
  color: string;
  opacity: number;
  angle: number;
  spinSpeed: number;
}

export function HeartRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    const heartSymbols = ['💖', '💕', '💗', '💓', '💞', '💘', '❤️', '🌸', '✨'];
    const colors = [
      '#ff4d6d', // sweet pink
      '#ff758f', // warm rose
      '#ff85a1', // soft blush
      '#f7cad0', // pale pink
      '#ffd6e7', // lavender pink
      '#ffb3c1', // baby pink
      '#fff0f3', // sweet cream
    ];

    const hearts: Heart[] = [];
    const maxHearts = 45; // balanced density for premium, high-performance aesthetic

    // Pre-populate some hearts at random heights so they don't all start falling from the top together
    for (let i = 0; i < maxHearts; i++) {
      hearts.push({
        x: Math.random() * width,
        y: Math.random() * -height, // start above or spread across screen
        size: Math.random() * 12 + 8, // 8px to 20px
        speed: Math.random() * 1.5 + 1.0, // gentle fall speed
        swaySpeed: Math.random() * 0.02 + 0.01,
        swayAmount: Math.random() * 25 + 10,
        swayOffset: Math.random() * Math.PI * 2,
        symbol: heartSymbols[Math.floor(Math.random() * heartSymbols.length)],
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: Math.random() * 0.5 + 0.4, // opacity between 0.4 and 0.9
        angle: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * 0.03,
      });
    }

    const drawHeartPath = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
      ctx.beginPath();
      ctx.moveTo(x, y + size / 4);
      ctx.quadraticCurveTo(x, y, x + size / 2, y);
      ctx.quadraticCurveTo(x + size, y, x + size, y + size / 3);
      ctx.quadraticCurveTo(x + size, y + (size * 2) / 3, x + size / 2, y + size);
      ctx.quadraticCurveTo(x, y + (size * 2) / 3, x, y + size / 3);
      ctx.quadraticCurveTo(x, y, x, y + size / 4);
      ctx.closePath();
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < hearts.length; i++) {
        const h = hearts[i];

        // Update physics
        h.y += h.speed;
        h.swayOffset += h.swaySpeed;
        h.angle += h.spinSpeed;

        // Apply sway to visual x
        const renderX = h.x + Math.sin(h.swayOffset) * h.swayAmount;

        // Reset if it goes off bottom of screen
        if (h.y > height + 40) {
          h.y = -40;
          h.x = Math.random() * width;
          h.speed = Math.random() * 1.5 + 1.0;
          h.size = Math.random() * 12 + 8;
          h.opacity = Math.random() * 0.5 + 0.4;
        }

        ctx.save();
        ctx.globalAlpha = h.opacity;
        ctx.translate(renderX, h.y);
        ctx.rotate(h.angle);

        // Standard emojis look beautiful, crisp, and load instantly on all systems
        ctx.font = `${h.size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(255, 77, 109, 0.3)';
        ctx.shadowBlur = 6;
        ctx.fillText(h.symbol, 0, 0);

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999] w-full h-full"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}
