import { Construction } from 'lucide-react';

interface Props {
  title: string;
  description?: string;
}

export function ComingSoonPage({ title, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Construction className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-xl font-bold text-slate-100 mb-2">{title}</h2>
      <p className="text-muted text-sm max-w-xs">
        {description ?? 'Bu sayfa yapım aşamasındadır. Yakında eklenecek.'}
      </p>
    </div>
  );
}
