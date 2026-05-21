import type { DimensionsMap, DimensionsMapValued } from '@/lib/schemas';
import { DimensionBreakdownCard } from './DimensionBreakdownCard';

type Props = {
  dimensions: DimensionsMap | DimensionsMapValued;
};

const ORDER: Array<'behavior' | 'demographic' | 'device'> = ['behavior', 'demographic', 'device'];

export function DimensionGrid({ dimensions }: Props) {
  const present = ORDER.filter(k => dimensions[k]);
  if (present.length === 0) return null;

  const cols = present.length === 1 ? 'grid-cols-1' : present.length === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className={`grid gap-3 ${cols}`}>
      {present.map(name => (
        <DimensionBreakdownCard key={name} name={name} dim={dimensions[name]!} />
      ))}
    </div>
  );
}
