"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

type BackButtonProps = {
  fallbackHref: string;
  ariaLabel: string;
  className: string;
  mode?: "history" | "parent";
};

// Child pages use `parent` so their labelled destination is reliable even
// when the page was opened directly or from outside the app. Top-level and
// discovery pages preserve the user's actual browsing history instead.
export function BackButton({ fallbackHref, ariaLabel, className, mode = "history" }: BackButtonProps) {
  const router = useRouter();

  function goBack() {
    if (mode === "parent") router.replace(fallbackHref);
    else if (window.history.length > 1) router.back();
    else router.push(fallbackHref);
  }

  return <button aria-label={ariaLabel} className={`${className} min-h-11 min-w-11`} onClick={goBack} type="button">
    <ArrowLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
  </button>;
}
