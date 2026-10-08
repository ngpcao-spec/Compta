import { useState } from 'react';
import { Link } from 'react-router';
import {
  ChevronRight,
  CloudAlert,
  CloudCheck,
  CloudOff,
  CloudUpload,
  Download,
  EyeOff,
  LogOut,
  Smartphone,
  Tag,
  Trash2,
} from 'lucide-react';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { TabHeader } from '@/app/layouts';
import { useToast } from '@/components/Toast';
import { useHideAmounts } from '@/db/hooks';
import { setHideAmounts } from '@/db/repo/profile';
import { useAuth, useUser } from '@/features/auth/AuthProvider';
import { isIos, isStandalone, useInstallPrompt } from '@/features/pwa/install';
import { vi } from '@/i18n/vi';
import { useSyncStatus, type SyncStatus } from '@/sync/status';
import { exportCsv } from './exportCsv';

export function syncLabel(s: SyncStatus, offline: boolean): string {
  if (offline || s.state === 'offline') return vi.sync.offline;
  if (s.pending > 0) return vi.sync.pending(s.pending);
  if (s.state === 'syncing') return vi.sync.syncing;
  if (s.state === 'error') return vi.sync.error;
  if (!s.lastSyncAt) return vi.sync.never;
  const d = new Date(s.lastSyncAt);
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return vi.sync.synced(hhmm);
}

type Tone = 'ok' | 'pending' | 'offline' | 'error';
function syncTone(s: SyncStatus, offline: boolean): Tone {
  if (offline || s.state === 'offline') return 'offline';
  if (s.state === 'error') return 'error';
  if (s.pending > 0 || s.state === 'syncing') return 'pending';
  return 'ok';
}
const TONES: Record<Tone, { cls: string; Icon: typeof CloudCheck }> = {
  ok: { cls: 'bg-[#EAF5EA] text-[#1B6E2B]', Icon: CloudCheck },
  pending: { cls: 'bg-[#FFF4E0] text-[#8A5A00]', Icon: CloudUpload },
  offline: { cls: 'bg-divider text-[#4B5563]', Icon: CloudOff },
  error: { cls: 'bg-[#FDECEA] text-danger-ink', Icon: CloudAlert },
};

const rowClass = 'tap flex w-full items-center gap-3.5 px-4 py-3 text-left text-base';

function RowIcon({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
      style={{ background: color }}
    >
      {children}
    </span>
  );
}

export function MorePage() {
  const user = useUser();
  const { signOut, deleteAccount } = useAuth();
  const hidden = useHideAmounts();
  const status = useSyncStatus();
  const toast = useToast();
  const { install } = useInstallPrompt();
  const [confirmOut, setConfirmOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  const tone = TONES[syncTone(status, offline)];
  const showInstall = !isStandalone() && (install !== null || isIos());

  return (
    <div>
      <TabHeader title={vi.more.title} />

      <div className="space-y-3 p-4">
        <section className="card p-4" aria-label="profile">
          <div className="flex items-center gap-3.5">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt=""
                width={56}
                height={56}
                className="h-14 w-14 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-tint text-2xl font-bold text-primary-dark">
                {(user.name ?? user.email ?? '?').slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate text-lg font-bold">{user.name}</div>
              <div className="truncate text-sm text-muted">{user.email}</div>
            </div>
          </div>
          <p
            className={`mt-3.5 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${tone.cls}`}
            data-testid="sync-indicator"
            role="status"
          >
            <tone.Icon size={20} />
            {syncLabel(status, offline)}
          </p>
        </section>

        <section className="card divide-y divide-divider overflow-hidden">
          <Link to="/more/categories" className={rowClass}>
            <RowIcon color="#1A6ED8">
              <Tag size={18} />
            </RowIcon>
            <span className="flex-1">{vi.more.categories}</span>
            <ChevronRight size={18} className="text-muted" />
          </Link>
          <button
            className={rowClass}
            onClick={async () => {
              if (!(await exportCsv())) toast(vi.more.csvEmpty);
            }}
            data-testid="export-csv"
          >
            <RowIcon color="#26A69A">
              <Download size={18} />
            </RowIcon>
            <span className="flex-1">{vi.more.exportCsv}</span>
            <ChevronRight size={18} className="text-muted" />
          </button>
          <label className={`${rowClass} cursor-pointer`}>
            <RowIcon color="#78909C">
              <EyeOff size={18} />
            </RowIcon>
            <span className="flex-1">{vi.more.hideAmounts}</span>
            <input
              type="checkbox"
              role="switch"
              checked={hidden}
              onChange={() => void setHideAmounts(!hidden)}
              data-testid="hide-switch"
              className="h-6 w-6 rounded-md accent-[var(--primary)]"
            />
          </label>
          {showInstall && (
            <button
              className={rowClass}
              onClick={() => (install ? void install() : toast(vi.more.installIos))}
            >
              <RowIcon color="#7E57C2">
                <Smartphone size={18} />
              </RowIcon>
              <span className="flex-1">{vi.more.install}</span>
              <ChevronRight size={18} className="text-muted" />
            </button>
          )}
        </section>

        <section className="card divide-y divide-divider overflow-hidden">
          <button
            className={rowClass}
            onClick={() => (status.pending > 0 ? setConfirmOut(true) : void signOut())}
            data-testid="sign-out"
          >
            <LogOut size={22} />
            <span className="flex-1">{vi.more.signOut}</span>
          </button>
          <button
            className={`${rowClass} text-danger-ink`}
            onClick={() => setDeleting(true)}
            data-testid="delete-account"
          >
            <Trash2 size={22} />
            <span className="flex-1">{vi.more.deleteAccount}</span>
          </button>
        </section>

        <p className="text-center text-[13px] text-muted">{vi.more.versionLine(__APP_VERSION__)}</p>
      </div>

      <ConfirmSheet
        open={confirmOut}
        title={vi.more.signOut}
        message={vi.more.signOutPending(status.pending)}
        confirmLabel={vi.more.signOut}
        danger
        onCancel={() => setConfirmOut(false)}
        onConfirm={() => {
          setConfirmOut(false);
          void signOut();
        }}
      />

      <BottomSheet open={deleting} onClose={() => setDeleting(false)} title={vi.more.deleteAccount}>
        <div className="px-4 pb-4">
          <h2 className="text-lg font-bold text-danger-ink">{vi.more.deleteAccount}</h2>
          <p className="mt-1 text-sm text-muted">{vi.more.deleteAccountWarn}</p>
          <label className="mt-3 block text-sm" htmlFor="delete-word">
            {vi.more.deleteAccountPrompt}
          </label>
          <input
            id="delete-word"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            autoComplete="off"
            className="mt-1 min-h-[44px] w-full rounded-xl bg-bg px-3 outline-none focus:ring-2 focus:ring-danger"
            data-testid="delete-word"
          />
          {deleteError && (
            <p role="alert" className="mt-2 text-sm text-danger-ink">
              {deleteError}
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              className="tap rounded-full bg-divider font-semibold"
              onClick={() => setDeleting(false)}
            >
              {vi.common.cancel}
            </button>
            <button
              disabled={word !== vi.more.deleteAccountWord || busy}
              className="tap rounded-full bg-danger-ink font-semibold text-white disabled:opacity-40"
              data-testid="delete-confirm"
              onClick={async () => {
                setBusy(true);
                try {
                  await deleteAccount();
                } catch {
                  setDeleteError(vi.more.deleteAccountFailed);
                  setBusy(false);
                }
              }}
            >
              {vi.common.delete}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
