import { CHART_THEME } from "@/lib/chartFormat";

const ITEMS = [
  { label: "Gain", color: CHART_THEME.gain, faded: false },
  { label: "Loss", color: CHART_THEME.loss, faded: false },
  { label: "Market closed", color: CHART_THEME.empty, faded: false },
  { label: "No snapshot", color: CHART_THEME.empty, faded: true }
];

export function ChartLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/60" aria-hidden>
      {ITEMS.map((item) => (
        <li className="flex items-center gap-1.5" key={item.label}>
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: item.color, opacity: item.faded ? 0.35 : 1 }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
