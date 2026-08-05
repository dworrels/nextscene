import { ChevronLeft, ChevronRight } from "lucide-react";

export function Mark() {
  return <span className="inline-flex h-5 w-[19px] items-end gap-[2px] rotate-180" aria-hidden="true">
    <i className="block h-[9px] w-[5px] rounded bg-accent" />
    <i className="block h-[17px] w-[5px] rounded bg-accent" />
    <i className="block h-[12px] w-[5px] rounded bg-accent" />
  </span>;
}

export function Arrow({ direction = "right" }: { direction?: "left" | "right" }) {
  const iconProps = { className: "h-[15px] w-[15px]", strokeWidth: 1.8, "aria-hidden": true } as const;
  return direction === "right" ? <ChevronRight {...iconProps} /> : <ChevronLeft {...iconProps} />;
}
