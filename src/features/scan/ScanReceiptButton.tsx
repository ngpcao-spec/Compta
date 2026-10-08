import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Camera } from 'lucide-react';
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
  /** catégories de dépense actives (id + nom sont envoyés à la fonction) */
  categories: readonly Category[];
  /** échec ou doute : ouvrir la saisie manuelle pré-remplie, avec ce message */
  onManual: (prefill: Prefill, message: string) => void;
  /** transaction enregistrée : quitter l'écran de saisie */
  onDone: () => void;
}

/** « Quét hóa đơn » : photo → IA → une dépense enregistrée directement (SPEC §3.10). */
export function ScanReceiptButton({ categories, onManual, onDone }: Props) {
  const online = useOnline();
  const toast = useToast();
  const navigate = useNavigate();
  const amountText = useAmountText();
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => abort.current?.abort(), []);

  const run = async (file: File) => {
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    const refs = categories.map((c) => ({ id: c.id, name: c.name }));
    const out = await scanReceipt(file, refs, todayStr(), ctrl.signal, defaultScanDeps(invokeScan));
    abort.current = null;
    setBusy(false);

    if (out.kind === 'cancelled') return;
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
      toast(vi.scan.added(amountText(d.amount), name), {
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

  return (
    <div>
      <button
        type="button"
        disabled={!online || busy || categories.length === 0}
        onClick={() => input.current?.click()}
        data-testid="scan-receipt"
        className="tap flex h-12 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-primary bg-white font-semibold text-primary disabled:border-divider disabled:text-muted"
      >
        <Camera size={20} />
        {vi.scan.button}
      </button>
      {!online && (
        <p className="mt-1.5 text-center text-[13px] text-muted" data-testid="scan-offline">
          {vi.scan.offline}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        data-testid="scan-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ''; // permet de rescanner le même fichier
          if (file) void run(file);
        }}
      />
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
