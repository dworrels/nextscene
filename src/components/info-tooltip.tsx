"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

const TOOLTIP_WIDTH = 224; // px, matches w-56 below
const EDGE_MARGIN = 16; // minimum gap to keep from the viewport edge

export function InfoTooltip({ label, children, tone = "default" }: { label: string; children: ReactNode; tone?: "default" | "inverted" }) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const id = useId();
  const containerRef = useRef<HTMLSpanElement>(null);

  function openTooltip() {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const naturalLeft = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      const overflowLeft = EDGE_MARGIN - naturalLeft;
      const overflowRight = naturalLeft + TOOLTIP_WIDTH - (window.innerWidth - EDGE_MARGIN);
      setShift(overflowLeft > 0 ? overflowLeft : overflowRight > 0 ? -overflowRight : 0);
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    function handlePointer(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return <span className="relative inline-flex" ref={containerRef}>
    <button
      aria-describedby={id}
      aria-expanded={open}
      aria-label={label}
      className={`-m-4 inline-flex items-center justify-center rounded-full p-4 transition-colors focus-visible:outline focus-visible:-outline-offset-8 focus-visible:outline-current ${tone === "inverted" ? "text-bg/60 hover:text-bg focus-visible:text-bg" : "text-muted hover:text-ink focus-visible:text-ink"}`}
      onClick={() => (open ? setOpen(false) : openTooltip())}
      type="button"
    >
      <Info className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
    <span
      className={`pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-56 rounded-lg border border-line bg-bg px-3 py-2 text-xs leading-[1.45] text-muted shadow-[0_8px_24px_rgba(0,0,0,.16)] transition-opacity duration-150 ${open ? "opacity-100" : "opacity-0"}`}
      id={id}
      role="tooltip"
      style={{ transform: `translateX(calc(-50% + ${shift}px))` }}
    >
      {children}
    </span>
  </span>;
}
