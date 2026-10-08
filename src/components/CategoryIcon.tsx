import { ICONS } from './icons';
import { Tag } from 'lucide-react';

interface Props {
  icon: string;
  color: string;
  /** diamètre du cercle en px (40 par défaut, icône 20) */
  size?: number;
}

export function CategoryIcon({ icon, color, size = 40 }: Props) {
  const Icon = ICONS[icon] ?? Tag;
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full text-white"
      style={{ width: size, height: size, background: color }}
    >
      <Icon size={Math.round(size / 2)} strokeWidth={2} />
    </span>
  );
}
