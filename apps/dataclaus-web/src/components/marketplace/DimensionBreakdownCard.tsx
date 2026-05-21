import type { DimensionPayload, DimensionPayloadValued } from '@/lib/schemas';

const DIMENSION_LABEL: Record<string, string> = {
  behavior: 'BEHAVIOR',
  demographic: 'DEMOGRAPHIC',
  device: 'DEVICE',
};

const DIMENSION_HINT: Record<string, string> = {
  behavior:    'watch + tags + engagement',
  demographic: 'censored age + gender + locale',
  device:      'sensor signal + bot-detection',
};

type Props = {
  name: 'behavior' | 'demographic' | 'device';
  dim: DimensionPayload | DimensionPayloadValued;
};

function isValued(d: DimensionPayload | DimensionPayloadValued): d is DimensionPayloadValued {
  return 'unit_price_usd' in d;
}

export function DimensionBreakdownCard({ name, dim }: Props) {
  const valued = isValued(dim);
  const topDist = Object.entries(dim.distribution ?? {}).slice(0, 5);

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-[10px] tracking-[0.18em] text-white/60 font-semibold">{DIMENSION_LABEL[name]}</h4>
        <span className="font-mono text-2xl tabular-nums">{dim.count.toLocaleString()}</span>
      </div>
      <p className="text-xs text-white/50 mb-3">{DIMENSION_HINT[name]}</p>

      {topDist.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {topDist.map(([k, v]) => (
            <span key={k} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-mono text-white/70">
              {k} · {v}
            </span>
          ))}
        </div>
      )}

      {valued ? (
        <div className="border-t border-white/10 pt-3 mt-2">
          <div className="font-mono text-xs text-white/70">
            ${dim.unit_price_usd.toFixed(4)} / {name === 'demographic' ? 'profile' : 'event'} × {dim.count.toLocaleString()}
          </div>
          <div className="font-mono text-lg tabular-nums mt-1">${dim.total_usd.toFixed(2)}</div>
          <p className="text-[11px] italic text-white/55 mt-2 leading-snug">{dim.ai_justification}</p>
          <p className="text-[10px] text-white/40 mt-2">AI quality: {(dim.quality_score * 100).toFixed(0)}%</p>
        </div>
      ) : (
        <p className="text-[11px] italic text-white/40 border-t border-white/10 pt-3 mt-2">
          Est. value: pending AI audit
        </p>
      )}
    </div>
  );
}
