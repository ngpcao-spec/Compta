import { useRef, useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { vi } from '@/i18n/vi';

const OPEN = 88;

interface Props {
  children: ReactNode;
  onOpen: () => void;
  onDelete: () => void;
}

/** Ligne dont le balayage vers la gauche révèle le bouton supprimer. */
export function SwipeRow({ children, onOpen, onDelete }: Props) {
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; base: number } | null>(null);
  const moved = useRef(false);

  return (
    <div className="relative overflow-hidden">
      <button
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-danger text-white"
        style={{ width: OPEN }}
        aria-label={vi.common.delete}
        tabIndex={x === 0 ? -1 : 0}
        onClick={onDelete}
      >
        <Trash2 size={22} />
      </button>
      <div
        role="button"
        tabIndex={0}
        className="relative bg-card"
        style={{
          transform: `translateX(${x}px)`,
          transition: dragging ? 'none' : 'transform 150ms',
          touchAction: 'pan-y',
        }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, base: x };
          moved.current = false;
          setDragging(true);
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const dx = e.clientX - start.current.x;
          if (Math.abs(dx) > 8) moved.current = true;
          if (moved.current) setX(Math.max(-OPEN, Math.min(0, start.current.base + dx)));
        }}
        onPointerUp={() => {
          if (moved.current) setX((cur) => (cur < -OPEN / 2 ? -OPEN : 0));
          start.current = null;
          setDragging(false);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDragging(false);
          setX(0);
        }}
        onClick={() => {
          if (moved.current) return;
          if (x !== 0) setX(0);
          else onOpen();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onOpen();
          if (e.key === 'Delete') onDelete();
        }}
      >
        {children}
      </div>
    </div>
  );
}
