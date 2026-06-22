'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';

interface TerminalProps {
  lines: string[];
  className?: string;
  autoPlay?: boolean;
  speed?: number;
}

export function Terminal({ lines, className, autoPlay = true, speed = 60 }: TerminalProps) {
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!autoPlay) return;
    const timeout = setTimeout(() => setStarted(true), 600);
    return () => clearTimeout(timeout);
  }, [autoPlay]);

  useEffect(() => {
    if (!started || currentLine >= lines.length) return;

    const line = lines[currentLine];
    if (currentChar < line.length) {
      const t = setTimeout(() => {
        setVisibleLines((prev) => {
          const next = [...prev];
          next[currentLine] = (next[currentLine] ?? '') + line[currentChar];
          return next;
        });
        setCurrentChar((c) => c + 1);
      }, speed);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setCurrentLine((l) => l + 1);
        setCurrentChar(0);
      }, 120);
      return () => clearTimeout(t);
    }
  }, [started, currentLine, currentChar, lines, speed]);

  return (
    <div
      className={clsx(
        'bg-[#0a0a0f] border border-border rounded-xl overflow-hidden font-mono text-sm',
        className,
      )}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface">
        <div className="w-3 h-3 rounded-full bg-danger/70" />
        <div className="w-3 h-3 rounded-full bg-warning/70" />
        <div className="w-3 h-3 rounded-full bg-success/70" />
        <span className="ml-3 text-xs text-text-muted">terminal — bash</span>
      </div>
      {/* Content */}
      <div className="p-4 space-y-1 min-h-[280px]">
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="text-text-muted select-none mr-2 text-xs pt-0.5">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span
              className={clsx(
                'flex-1 leading-relaxed',
                line.startsWith('$') ? 'text-cyan-400' :
                line.startsWith('✓') || line.includes('hazır') ? 'text-success' :
                line.startsWith('#') ? 'text-text-muted italic' :
                'text-slate-300',
              )}
            >
              {i < currentLine
                ? line
                : i === currentLine
                ? (visibleLines[i] ?? '')
                : ''}
              {i === currentLine && started && (
                <span className="inline-block w-2 h-4 bg-cyan-400 ml-0.5 animate-pulse align-text-bottom" />
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
