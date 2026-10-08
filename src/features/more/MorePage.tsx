import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Download, EyeOff, LogOut, Smartphone, Tags, UserX } from 'lucide-react';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { useToast } from '@/components/Toast';
import { useHideAmounts } from '@/db/hooks';
import { setHideAmounts } from '@/db/repo/profile';
import { useAuth, useUser } from '@/features/auth/AuthProvider';
import { useInstallPrompt } from '@/features/pwa/install';
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

const rowClass = 'tap flex w-full items-center gap-3 px-4 py-3 text-left';

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

  return (
    <div>
      <header className="bg-white px-4 pb-3 pt-[calc(var(--safe-top)+8px)]">
        <h1 className="text-lg font-bold">{vi.more.title}</h1>
      </header>

      <div className="space-y-3 p-4">
        <section className="card flex items-center gap-3 p-4" aria-label="profile">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-dark text-lg font-bold text-white">
              {(user.name ?? user.email ?? '?').slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <div className="truncate font-semibold">{user.name}</div>
            <div className="truncate text-sm text-muted">{user.email}</div>
          </div>
        </section>

        <p className="px-1 text-xs text-muted" data-testid="sync-indicator" role="status">
          {syncLabel(status, typeof navigator !== 'undefined' && !navigator.onLine)}
        </p>

        <section className="card divide-y divide-divider overflow-hidden">
          <Link to="/more/categories" className={rowClass}>
            <Tags size={20} className="text-link" />
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
            <Download size={20} className="text-link" />
            <span className="flex-1">{vi.more.exportCsv}</span>
          </button>
          <div className={rowClass}>
            <EyeOff size={20} className="text-link" />
            <span className="flex-1">{vi.more.hideAmounts}</span>
            <button
              role="switch"
              aria-checked={hidden}
              aria-label={vi.more.hideAmounts}
              onClick={() => void setHideAmounts(!hidden)}
              data-testid="hide-switch"
              className={`relative h-7 w-12 rounded-full transition-colors ${hidden ? 'bg-primary' : 'bg-[#D5D8DF]'}`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${hidden ? 'left-[22px]' : 'left-0.5'}`}
              />
            </button>
          </div>
          {install && (
            <button className={rowClass} onClick={() => void install()}>
              <Smartphone size={20} className="text-link" />
              <span className="flex-1">{vi.more.install}</span>
            </button>
          )}
        </section>

        <section className="card divide-y divide-divider overflow-hidden">
          <button
            className={rowClass}
            onClick={() => (status.pending > 0 ? setConfirmOut(true) : void signOut())}
            data-testid="sign-out"
          >
            <LogOut size={20} className="text-link" />
            <span className="flex-1">{vi.more.signOut}</span>
          </button>
          <button
            className={`${rowClass} text-danger`}
            onClick={() => setDeleting(true)}
            data-testid="delete-account"
          >
            <UserX size={20} />
            <span className="flex-1">{vi.more.deleteAccount}</span>
          </button>
        </section>

        <p className="text-center text-xs text-muted">
          {vi.more.version} {__APP_VERSION__}
        </p>
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
          <h2 className="text-lg font-bold text-danger">{vi.more.deleteAccount}</h2>
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
            <p role="alert" className="mt-2 text-sm text-danger">
              {deleteError}
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              className="tap rounded-full bg-[#E6E8EE] font-semibold"
              onClick={() => setDeleting(false)}
            >
              {vi.common.cancel}
            </button>
            <button
              disabled={word !== vi.more.deleteAccountWord || busy}
              className="tap rounded-full bg-danger font-semibold text-white disabled:opacity-40"
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
