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
    <section
      aria-labelledby="participation-heading"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="participation-heading" className="text-sm font-medium text-muted">
            Your participation
          </h2>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight">{stat.pct}%</span>
            <span className="text-sm text-muted">
              {stat.currentCount} of {stat.totalIssues} issues
            </span>
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
            met
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : "bg-amber-50 text-amber-700 ring-amber-200"
          }`}
        >
          {met ? "Target met" : `${stat.need} to go`}
        </span>
      </div>

      <div className="mt-6">
        <div
          role="progressbar"
          aria-valuenow={stat.pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Participation: ${stat.pct} percent of a ${minParticipationPct} percent minimum`}
          className="relative h-3 w-full rounded-full bg-slate-200"
        >
          <div
            className={`h-3 rounded-full transition-all ${met ? "bg-emerald-500" : "bg-amber-500"}`}
            style={{ width: `${fillPct}%` }}
          />
          <span
            aria-hidden
            className="absolute -top-1.5 -bottom-1.5 w-0.5 rounded-full bg-ink"
            style={{ left: `${markerPct}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-0.5 rounded-full bg-ink" />
            Required minimum {minParticipationPct}% ({stat.targetCount} issues)
          </span>
          <span>Class total: {stat.totalIssues} issues</span>
        </div>
      </div>

      <p
        className={`mt-5 rounded-lg px-4 py-3 text-sm font-medium ${
          met ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
        }`}
      >
        {met
          ? `You have reached the ${minParticipationPct}% participation minimum. Keep claiming issues if you want more.`
          : `You need ${stat.need} more ${stat.need === 1 ? "issue" : "issues"} to reach ${minParticipationPct}%.`}
      </p>
    </section>
  );
}
