import type { ParticipationStat } from "@/lib/types";

type ParticipationMeterProps = {
  stat: ParticipationStat;
  minParticipationPct: number;
};

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function ParticipationMeter({ stat, minParticipationPct }: ParticipationMeterProps) {
  const fillPct = clampPct(stat.pct);
  const markerPct = clampPct(minParticipationPct);
  const met = stat.meetsTarget;

  return (
    <section aria-labelledby="participation-heading" className="rounded-2xl bg-[#f8f6fc] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="participation-heading" className="text-sm font-medium">
            Participation
          </h2>
          <p className="mt-1 text-xs text-muted">Progress against the class minimum</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            met ? "bg-mist text-[#0d652d]" : "bg-sand text-[#8a5a00]"
          }`}
        >
          {met ? "Target met" : `${stat.need} to go`}
        </span>
      </div>

      <p className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-medium tracking-tight">{stat.pct}%</span>
        <span className="text-xs text-muted">
          {stat.currentCount} of {stat.totalIssues} issues
        </span>
      </p>

      <div className="mt-4">
        <div
          role="progressbar"
          aria-valuenow={stat.pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Participation: ${stat.pct} percent of a ${minParticipationPct} percent minimum`}
          className="relative h-2.5 w-full rounded-full bg-lavender/70"
        >
          <div
            className={`h-2.5 rounded-full transition-all ${met ? "bg-[#0d9c57]" : "bg-[#e8710a]"}`}
            style={{ width: `${fillPct}%` }}
          />
          <span
            aria-hidden
            className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-ink"
            style={{ left: `${markerPct}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Required minimum {minParticipationPct}% ({stat.targetCount} issues)
        </p>
      </div>

      <p className={`mt-4 text-sm leading-relaxed ${met ? "text-[#0d652d]" : "text-ink/80"}`}>
        {met
          ? `You have reached the ${minParticipationPct}% participation minimum. Keep claiming issues if you want more.`
          : `You need ${stat.need} more ${stat.need === 1 ? "issue" : "issues"} to reach ${minParticipationPct}%.`}
      </p>
    </section>
  );
}
