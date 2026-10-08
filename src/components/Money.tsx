import { useHideAmounts } from '@/db/hooks';
import { displayAmount } from '@/lib/money';

interface Props {
  value: number;
  /** dépense : préfixe `-` */
  expense?: boolean;
  className?: string;
}

/** Montant formaté, masqué (`******`) si le profil le demande. */
export function Money({ value, expense, className }: Props) {
  const hidden = useHideAmounts();
  return <span className={className}>{displayAmount(value, { hidden, expense })}</span>;
}

export function useAmountText(): (value: number, expense?: boolean) => string {
  const hidden = useHideAmounts();
  return (value, expense) => displayAmount(value, { hidden, expense });
}
