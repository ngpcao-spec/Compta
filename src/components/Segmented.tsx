interface Option<T extends string> {
  value: T;
  label: string;
}
interface Props<T extends string> {
  options: readonly Option<T>[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
  /** variante compacte (cartes de graphiques) */
  small?: boolean;
}

/** Segment à deux onglets : fond gris clair, onglet actif blanc avec ombre (maquettes). */
export function Segmented<T extends string>({ options, value, onChange, label, small }: Props<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="grid rounded-[10px] bg-divider p-[3px]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`${small ? 'h-8 text-[13px]' : 'h-9 text-sm'} whitespace-nowrap rounded-lg px-2 transition-colors duration-150 ${
              active
                ? 'bg-white font-semibold text-ink shadow-[0_1px_3px_rgb(0_0_0/0.12)]'
                : 'font-medium text-[#4B5563]'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
