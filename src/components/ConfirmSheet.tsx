import { vi } from '@/i18n/vi';
import { BottomSheet } from './BottomSheet';

interface Props {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel = vi.common.confirm,
  danger,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <BottomSheet open={open} onClose={onCancel} title={title}>
      <div className="px-4 pb-4">
        <h2 className="text-lg font-bold">{title}</h2>
        {message && <p className="mt-1 text-sm text-muted">{message}</p>}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button className="tap rounded-full bg-[#E6E8EE] font-semibold" onClick={onCancel}>
            {vi.common.cancel}
          </button>
          <button
            className={`tap rounded-full font-semibold text-white ${danger ? 'bg-danger' : 'bg-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
