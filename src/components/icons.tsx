import { ChevronLeft, ChevronRight } from "lucide-react";

export function Arrow({ direction = "right" }: { direction?: "left" | "right" }) {
  const iconProps = { className: "inline-block h-[20px] w-[20px] align-middle", strokeWidth: 2.5, "aria-hidden": true } as const;
  return direction === "right" ? <ChevronRight {...iconProps} /> : <ChevronLeft {...iconProps} />;
}
