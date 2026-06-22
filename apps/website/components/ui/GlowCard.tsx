'use client';

import { useRef } from 'react';
import { clsx } from 'clsx';

interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}

export function GlowCard({ children, className, glowColor = '99,102,241' }: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={clsx(
        'relative bg-surface border border-border rounded-2xl overflow-hidden',
        'transition-all duration-300 hover:-translate-y-1',
        'hover:border-primary/30',
        'before:absolute before:inset-0 before:opacity-0 before:transition-opacity before:duration-300',
        'hover:before:opacity-100',
        className,
      )}
      style={{
        ['--glow' as string]: `rgba(${glowColor},0.15)`,
      }}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(circle 200px at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(${glowColor}, 0.08), transparent)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
