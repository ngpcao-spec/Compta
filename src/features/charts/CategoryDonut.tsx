import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { useAmountText } from '@/components/Money';
import { vi } from '@/i18n/vi';
import type { CategoryShare } from '@/lib/stats';

interface LabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  outerRadius: number;
  index: number;
  name: string;
}

const RAD = Math.PI / 180;

/** Étiquette externe d'une part ≥ 5 % ; le pourcentage vient de `items`, pas de Recharts. */
function makeLabel(items: readonly CategoryShare[]) {
  return function renderLabel(p: LabelProps) {
    const percent = items[p.index]?.percent ?? 0;
    if (percent < 5) return null;
    return labelNode(p, percent);
  };
}

function labelNode(p: LabelProps, percent: number) {
  const r = p.outerRadius + 16;
  const x = p.cx + r * Math.cos(-p.midAngle * RAD);
  const y = p.cy + r * Math.sin(-p.midAngle * RAD);
  const anchor = x > p.cx ? 'start' : 'end';
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={11} fill="#1F2329">
      <tspan x={x} dy="-0.2em" fontWeight={600}>{`${percent.toFixed(1)}%`}</tspan>
      <tspan x={x} dy="1.2em" fill="#8A8F98">
        {p.name}
      </tspan>
    </text>
  );
}

interface Props {
  items: CategoryShare[];
  total: number;
}

/** Donut avec total au centre, étiquettes externes pour les parts ≥ 5 %, noms des petites parts dessous. */
export function CategoryDonut({ items, total }: Props) {
  const text = useAmountText();
  const small = items.filter((i) => i.percent < 5);
  return (
    <div>
      <div className="relative h-[250px]" data-testid="donut">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <Pie
              data={items}
              dataKey="amount"
              nameKey="name"
              innerRadius={58}
              outerRadius={82}
              startAngle={90}
              endAngle={-270}
              paddingAngle={items.length > 1 ? 1 : 0}
              isAnimationActive={false}
              label={makeLabel(items) as unknown as boolean}
              labelLine={false}
            >
              {items.map((i) => (
                <Cell key={i.categoryId} fill={i.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted">{vi.charts.total}</span>
          <span className="text-base font-bold" data-testid="donut-total">
            {text(total)}
          </span>
        </div>
      </div>
      {small.length > 0 && (
        <p className="px-2 text-center text-xs text-muted">
          {small.map((s) => s.name).join(' · ')}
        </p>
      )}
    </div>
  );
}
