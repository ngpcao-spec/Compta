import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { vi } from '@/i18n/vi';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** Feuille modale bas d'écran, fermeture par glissement de la poignée, Échap ou clic sur le voile. */
export function BottomSheet({ open, onClose, title, children }: Props) {
  const [dy, setDy] = useState(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="presentation">
      <div
        className="absolute inset-0 bg-[rgb(15_23_42/0.45)]"
        style={{ animation: 'fade-in 150ms ease-out' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title ?? vi.common.menu}
        className="relative w-full max-w-[480px] rounded-t-[24px] bg-white pb-[max(var(--safe-bottom),20px)] shadow-[0_-8px_30px_rgb(0_0_0/0.12)]"
        style={{
          transform: `translateY(${dy}px)`,
          animation: dy === 0 ? 'sheet-in 200ms ease-out' : undefined,
        }}
      >
        <div
          className="flex h-6 cursor-grab touch-none items-center justify-center"
          onPointerDown={(e) => {
            start.current = e.clientY;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (start.current !== null) setDy(Math.max(0, e.clientY - start.current));
          }}
          onPointerUp={() => {
            const shouldClose = dy > 90;
            start.current = null;
            setDy(0);
            if (shouldClose) onClose();
          }}
        >
          <span className="h-[5px] w-10 rounded-full bg-[#D5D8DE]" />
        </div>
        {children}
      </section>
    </div>,
    document.body,
  );
}
