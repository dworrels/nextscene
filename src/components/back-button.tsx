"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

type BackButtonProps = {
  fallbackHref: string;
  ariaLabel: string;
  className: string;
};

// A direct visit may not have an in-app history entry. In that case the
// supplied parent/home route is safer than leaving the user on a blank tab.
export function BackButton({ fallbackHref, ariaLabel, className }: BackButtonProps) {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push(fallbackHref);
  }

  return <button aria-label={ariaLabel} className={`${className} min-h-11 min-w-11`} onClick={goBack} type="button">
    <ArrowLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
  </button>;
}
