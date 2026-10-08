interface Option<T extends string> {
  value: T;
  label: string;
}
interface Props<T extends string> {
  options: readonly Option<T>[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}

export function Segmented<T extends string>({ options, value, onChange, label }: Props<T>) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-full bg-[#E6E8EE] p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`tap flex-1 whitespace-nowrap rounded-full px-3 text-sm font-semibold transition-colors duration-150 ${
              active ? 'bg-white text-ink shadow-sm' : 'text-muted'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
