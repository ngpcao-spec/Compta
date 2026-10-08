import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Camera, Image as ImageIcon } from 'lucide-react';
import { useAmountText } from '@/components/Money';
import { useToast } from '@/components/Toast';
import type { Category } from '@/db/types';
import { createTransaction } from '@/db/repo/transactions';
import { vi } from '@/i18n/vi';
import { todayStr } from '@/lib/dates';
import { DAILY_LIMIT } from '../../../supabase/functions/scan-receipt/validate';
import type { Prefill } from './normalize';
import { invokeScan } from './scanClient';
import { defaultScanDeps, scanReceipt } from './scanReceipt';
import { useOnline } from './useOnline';

interface Props {
  /** catégories actives de dépense ET de revenu (id, nom et type sont envoyés à la fonction) */
  categories: readonly Category[];
  /** échec ou doute : ouvrir la saisie manuelle pré-remplie, avec ce message */
  onManual: (prefill: Prefill, message: string) => void;
  /** image illisible (HEIC non décodable, fichier corrompu…) : message, rien n'est enregistré */
  onError: (message: string) => void;
  /** transaction enregistrée : quitter l'écran de saisie */
  onDone: () => void;
}

const SOURCES = [
  { key: 'camera', Icon: Camera, label: vi.scan.camera, aria: vi.scan.cameraLabel, capture: true },
  {
    key: 'library',
    Icon: ImageIcon,
    label: vi.scan.library,
    aria: vi.scan.libraryLabel,
    capture: false,
  },
] as const;

/** « Quét hóa đơn » : photo → IA → une dépense enregistrée directement (SPEC §3.10). */
export function ScanReceiptButton({ categories, onManual, onError, onDone }: Props) {
  const online = useOnline();
  const toast = useToast();
  const navigate = useNavigate();
  const amountText = useAmountText();
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => abort.current?.abort(), []);

  const run = async (file: File) => {
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    const refs = categories.map((c) => ({ id: c.id, name: c.name, type: c.type }));
    const out = await scanReceipt(file, refs, todayStr(), ctrl.signal, defaultScanDeps(invokeScan));
    abort.current = null;
    setBusy(false);

    if (out.kind === 'cancelled') return;
    if (out.kind === 'image_error') {
      onError(vi.scan.badImage);
      return;
    }
    if (out.kind === 'failed') {
      onManual(out.prefill, out.reason === 'quota' ? vi.scan.quota(DAILY_LIMIT) : vi.scan.failed);
      return;
    }
    if (out.kind === 'manual') {
      onManual(out.prefill, vi.scan.failed);
      return;
    }
    const d = out.draft;
    try {
      const tx = await createTransaction({
        categoryId: d.categoryId,
        amount: d.amount,
        note: d.note,
        occurredOn: d.date,
      });
      const name = categories.find((c) => c.id === d.categoryId)?.name ?? '';
      const message =
        d.txType === 'income'
          ? vi.scan.addedIncome
          : d.vatExcluded
            ? vi.scan.addedNoVat
            : vi.scan.added;
      toast(message(amountText(d.amount), name), {
        label: vi.scan.edit,
        onClick: () => void navigate(`/tx/${tx.id}`),
      });
      onDone();
    } catch {
      onManual(
        { amount: d.amount, date: d.date, categoryId: d.categoryId, note: d.note },
        vi.scan.failed,
      );
    }
  };

  const disabled = !online || busy || categories.length === 0;

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {SOURCES.map(({ key, Icon, label, aria, capture }) => (
          <div key={key}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => (capture ? cameraInput : libraryInput).current?.click()}
              aria-label={aria}
              data-testid={`scan-${key}`}
              className="tap flex h-12 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-primary bg-white font-semibold text-primary disabled:border-divider disabled:text-muted"
            >
              <Icon size={20} aria-hidden />
              {label}
            </button>
            <input
              ref={capture ? cameraInput : libraryInput}
              type="file"
              accept="image/*"
              capture={capture ? 'environment' : undefined}
              className="hidden"
              tabIndex={-1}
              aria-hidden
              data-testid={`scan-${key}-input`}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = ''; // permet de rescanner le même fichier
                if (file) void run(file);
              }}
            />
          </div>
        ))}
      </div>
      {!online && (
        <p className="mt-1.5 text-center text-[13px] text-muted" data-testid="scan-offline">
          {vi.scan.offline}
        </p>
      )}
      {busy && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-8"
          role="alertdialog"
          aria-label={vi.scan.reading}
          data-testid="scan-overlay"
        >
          <div className="flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl bg-white p-6 text-center shadow-xl">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="font-semibold">{vi.scan.reading}</p>
            <button
              className="tap rounded-full bg-divider px-6 font-semibold"
              data-testid="scan-cancel"
              onClick={() => abort.current?.abort()}
            >
              {vi.scan.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
