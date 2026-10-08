import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface ToastAction {
  label: string;
  onClick: () => void;
}
type ToastFn = (message: string, action?: ToastAction) => void;

const ToastContext = createContext<ToastFn>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; action?: ToastAction } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback<ToastFn>((message, action) => {
    setToast({ message, action });
    clearTimeout(timer.current);
    // Un toast avec action reste plus longtemps pour laisser le temps de toucher « Sửa ».
    timer.current = setTimeout(() => setToast(null), action ? 7000 : 2200);
  }, []);
  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+16px)] z-[60] flex justify-center px-4"
          style={{ animation: 'fade-in 150ms ease-out' }}
        >
          <span className="pointer-events-auto flex items-center gap-3 rounded-full bg-[#1F2329] py-2 pr-2 pl-4 text-sm text-white shadow-lg">
            <span>{toast.message}</span>
            {toast.action && (
              <button
                className="tap rounded-full bg-white/15 px-3 font-semibold"
                data-testid="toast-action"
                onClick={() => {
                  const a = toast.action;
                  setToast(null);
                  a?.onClick();
                }}
              >
                {toast.action.label}
              </button>
            )}
          </span>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
