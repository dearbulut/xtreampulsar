import { clsx } from 'clsx';

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  from?: string;
  via?: string;
  to?: string;
}

export function GradientText({ children, className, from, via, to }: GradientTextProps) {
  const style = from
    ? { backgroundImage: `linear-gradient(135deg, ${from}, ${via ?? '#8b5cf6'}, ${to ?? '#06b6d4'})` }
    : undefined;

  return (
    <span
      className={clsx('bg-clip-text text-transparent', !from && 'gradient-text', className)}
      style={style}
    >
      {children}
    </span>
  );
}
