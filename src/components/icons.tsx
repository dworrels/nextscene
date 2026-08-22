import { ChevronLeft, ChevronRight } from "lucide-react";

export function Arrow({ direction = "right" }: { direction?: "left" | "right" }) {
  const iconProps = { className: "inline-block h-[20px] w-[20px] align-middle", strokeWidth: 2.5, "aria-hidden": true } as const;
  return direction === "right" ? <ChevronRight {...iconProps} /> : <ChevronLeft {...iconProps} />;
}

// Same "N + play" mark as src/app/icon.svg (the static favicon), minus its
// solid background tile — that source file is one compound path where the
// first subpath is a solid canvas rect and the rest (frame + letterform)
// read as one self-contained line-art shape once that background is
// dropped. Rendered with fill: currentColor directly on the page — no
// backing chip needed, unlike the full favicon version, which does need one
// on any background that isn't already high-contrast against it.
export function Logo({ className }: { className?: string }) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 1448 1086" xmlns="http://www.w3.org/2000/svg">
    <g fill="currentColor" stroke="none" transform="translate(0,1086) scale(0.1,-0.1)">
      <path d="M9749 8200 c28 -5 82 -22 119 -36 266 -106 455 -350 492 -638 7 -55 10
-613 8 -1761 -4 -1900 4 -1723 -88 -1910 -95 -194 -254 -334 -455 -403 l-80
-27 -667 -3 -668 -3 0 181 0 180 605 0 c406 0 621 4 657 11 120 25 232 108
283 209 58 114 55 20 55 1815 0 1804 3 1707 -57 1817 -35 64 -120 143 -186
173 -29 14 -80 28 -113 32 -32 5 -1139 6 -2459 3 l-2400 -5 -68 -32 c-78 -37
-163 -117 -195 -185 -54 -112 -52 -28 -52 -1805 0 -1163 3 -1657 11 -1695 25
-120 106 -227 215 -285 91 -48 146 -54 464 -51 l285 3 2 765 c1 421 2 775 3
788 0 13 12 34 26 49 46 46 32 55 614 -387 109 -82 149 -119 162 -147 16 -35
17 -96 18 -725 0 -677 0 -687 -20 -698 -14 -7 -250 -10 -768 -8 l-747 3 -70
24 c-214 72 -375 211 -470 406 -87 177 -80 10 -80 1950 l0 1720 22 85 c61 229
209 415 417 520 169 86 -82 78 2682 79 1561 1 2470 -3 2503 -9z m-4147 -1231
c45 -24 1111 -820 1943 -1451 176 -133 391 -296 479 -363 104 -79 165 -132
177 -155 18 -33 19 -68 19 -633 l0 -599 -29 -29 c-53 -52 -58 -49 -327 165
-271 218 -269 216 -784 617 -250 195 -565 441 -700 546 -135 105 -386 299
-559 430 -173 131 -324 251 -335 267 -21 27 -21 40 -26 564 -3 295 -2 553 2
572 13 64 83 99 140 69z m3193 -459 c132 -95 294 -212 360 -260 66 -47 142
-101 169 -120 61 -41 91 -102 81 -164 -7 -48 -21 -67 -96 -126 -31 -25 -136
-110 -234 -190 -569 -465 -523 -430 -565 -430 -27 0 -48 8 -67 24 l-28 24 -3
669 c-2 489 1 675 9 696 7 15 24 34 38 43 54 30 83 16 336 -166z" />
    </g>
  </svg>;
}
