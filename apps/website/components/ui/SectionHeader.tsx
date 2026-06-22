import { clsx } from 'clsx';
import { Badge } from './Badge';

interface SectionHeaderProps {
  badge?: string;
  title: React.ReactNode;
  subtitle?: string;
  center?: boolean;
  className?: string;
}

export function SectionHeader({ badge, title, subtitle, center = true, className }: SectionHeaderProps) {
  return (
    <div className={clsx(center && 'text-center', 'max-w-3xl', center && 'mx-auto', className)}>
      {badge && (
        <div className={clsx('mb-4', center && 'flex justify-center')}>
          <Badge variant="default">{badge}</Badge>
        </div>
      )}
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-text-base leading-tight text-balance">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-lg text-text-muted leading-relaxed text-balance">{subtitle}</p>
      )}
    </div>
  );
}
