import { Clock3 } from "lucide-react";

type Props = {
  title?: string;
};

export function StaleQuoteMarker({ title = "Price may be outdated" }: Props) {
  return (
    <span
      className="ml-1 inline-flex align-middle text-amber-700"
      title={title}
      aria-label={title}
      role="img"
    >
      <Clock3 className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
    </span>
  );
}
