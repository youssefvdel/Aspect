import React, { useEffect, useRef } from 'react';

export interface PixelTrailProps {
  gridSize?: number;
  trailSize?: number;
  maxAge?: number;
  interpolate?: number;
  color?: string;
  className?: string;
}

export default function PixelTrail({
  gridSize = 20,
  trailSize = 0.1,
  maxAge = 320,
  interpolate = 10,
  color = '#b6abf7',
  className = '',
}: PixelTrailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    interface ActiveCell {
      col: number;
      row: number;
      birth: number;
    }

    const cells = new Map<string, ActiveCell>();
    let lastPos: { x: number; y: number } | null = null;
    let animId: number | null = null;

    const addCell = (x: number, y: number, now: number) => {
      const col = Math.floor(x / gridSize);
      const row = Math.floor(y / gridSize);
      const key = `${col},${row}`;
      cells.set(key, { col, row, birth: now });

      // Light up adjacent cells based on trailSize
      if (trailSize > 0.06) {
        const subX = (x % gridSize) / gridSize;
        const subY = (y % gridSize) / gridSize;
        if (subX < 0.35) cells.set(`${col - 1},${row}`, { col: col - 1, row, birth: now - 40 });
        if (subX > 0.65) cells.set(`${col + 1},${row}`, { col: col + 1, row, birth: now - 40 });
        if (subY < 0.35) cells.set(`${col},${row - 1}`, { col, row: row - 1, birth: now - 40 });
        if (subY > 0.65) cells.set(`${col},${row + 1}`, { col, row: row + 1, birth: now - 40 });
      }
    };

    const render = (now: number) => {
      ctx.clearRect(0, 0, width, height);

      let hasActive = false;

      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;

      cells.forEach((cell, key) => {
        const age = now - cell.birth;
        if (age >= maxAge) {
          cells.delete(key);
        } else {
          hasActive = true;
          const progress = age / maxAge;
          const alpha = (1 - progress) * 0.75;

          ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
          const x = cell.col * gridSize + 1;
          const y = cell.row * gridSize + 1;
          const size = gridSize - 2;

          ctx.fillRect(x, y, size, size);
        }
      });

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      if (hasActive) {
        animId = requestAnimationFrame(render);
      } else {
        animId = null;
      }
    };

    const ensureLoop = () => {
      if (animId === null) {
        animId = requestAnimationFrame(render);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      const currentX = e.clientX;
      const currentY = e.clientY;

      if (lastPos) {
        const dx = currentX - lastPos.x;
        const dy = currentY - lastPos.y;
        const dist = Math.hypot(dx, dy);
        const steps = Math.max(1, Math.min(interpolate, Math.ceil(dist / (gridSize * 0.35))));

        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          addCell(lastPos.x + dx * t, lastPos.y + dy * t, now);
        }
      } else {
        addCell(currentX, currentY, now);
      }

      lastPos = { x: currentX, y: currentY };
      ensureLoop();
    };

    const handlePointerLeave = () => {
      lastPos = null;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      if (animId !== null) cancelAnimationFrame(animId);
    };
  }, [gridSize, trailSize, maxAge, interpolate, color]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-[1] w-full h-full ${className}`}
      aria-hidden="true"
    />
  );
}
