"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { InfoTooltip } from "@/components/info-tooltip";
import { whyWatchAction, type WhyWatchState } from "@/lib/why-watch-actions";
import type { TasteReference, WhyWatchReason } from "@/lib/recommendations";
import type { MediaType } from "@/types/tmdb";

// Reason sentences are built server-side as plain strings (e.g. "...closest
// to Inception, which you rated 8/10."); this finds the referenced title
// within the text and turns just that substring into a link, leaving the
// surrounding sentence and its color untouched.
function ReasonText({ text, references }: { text: string; references: TasteReference[] }) {
  let match: { reference: TasteReference; index: number } | null = null;
  for (const reference of references) {
    const index = text.indexOf(reference.title);
    if (index !== -1 && (!match || index < match.index)) match = { reference, index };
  }
  if (!match) return <>{text}</>;

  const { reference, index } = match;
  const before = text.slice(0, index);
  const after = text.slice(index + reference.title.length);
  const href = reference.mediaType === "tv" ? `/tv/${reference.id}` : `/movies/${reference.id}`;

  return <>{before}<Link className="text-inherit underline decoration-line underline-offset-2 transition-colors hover:decoration-ink" href={href}>{reference.title}</Link>{after}</>;
}

function ActionButton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return <button
    className="min-h-11 rounded-full border border-line bg-bg px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-soft disabled:cursor-wait disabled:opacity-60"
    disabled={pending}
    name="mode"
    type="submit"
    value="detailed"
  >
    {pending ? "Thinking…" : children}
  </button>;
}

// This reason has actual matched titles behind it (poster examples), while
// the feature-pattern reasons are thinner statistics — floating it to the
// top gives the section one detailed hero card instead of three same-sized
// ones of uneven substance. See getWhyWatchInsight in recommendations.ts.
const LIKED_REASON_HEADING = "Similar to movies you loved";

// The other reasons are thin statistics — no posters, no theme chips, plain
// text only. Only the hero "similar to movies you loved" card gets the
// richer treatment below.
function ReasonCard({ reason, references }: { reason: WhyWatchReason; references: TasteReference[] }) {
  return <div className="rounded-2xl bg-well p-4">
    <h4 className="m-0 text-[15px] font-semibold leading-snug text-ink">{reason.heading}</h4>
    <p className="m-0 mt-1 text-sm leading-[1.5] text-muted"><ReasonText references={references} text={reason.detail} /></p>
  </div>;
}

function HeroReasonCard({ reason, references }: { reason: WhyWatchReason; references: TasteReference[] }) {
  const examples = reason.examples.slice(0, 4);
  return <div className="flex flex-col gap-4 rounded-2xl bg-well p-5 min-[760px]:flex-row min-[760px]:items-start min-[760px]:gap-6">
    <div className="min-[760px]:w-[220px] min-[760px]:flex-none">
      <h4 className="m-0 text-base font-semibold leading-snug text-ink">{reason.heading}</h4>
      <p className="m-0 mt-1 text-sm leading-[1.5] text-muted"><ReasonText references={references} text={reason.detail} /></p>
      {reason.themes.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">
        {reason.themes.map((theme) => <span className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink" key={theme}>{theme}</span>)}
      </div> : null}
    </div>
    {examples.length > 0 ? <div className="flex gap-3 overflow-x-auto min-[760px]:flex-1 min-[760px]:overflow-visible [scrollbar-width:none]">
      {examples.map((reference) => <Link
        className="group w-20 min-w-0 flex-none min-[760px]:w-auto min-[760px]:flex-1"
        href={reference.mediaType === "tv" ? `/tv/${reference.id}` : `/movies/${reference.id}`}
        key={reference.id}
        prefetch={false}
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-line/40 transition-transform duration-300 ease-out group-hover:scale-[1.04]">
          {reference.posterUrl ? <Image alt="" className="object-cover" fill loading="lazy" sizes="(max-width: 759px) 80px, 220px" src={reference.posterUrl} /> : null}
          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.04em] text-white backdrop-blur-sm">{reference.rating}/10</span>
        </div>
        <p className="m-0 mt-1.5 truncate text-xs font-semibold text-ink">{reference.title}</p>
      </Link>)}
    </div> : null}
  </div>;
}

export function WhyWatch({ id, mediaType, initialState }: { id: number; mediaType: MediaType; initialState: WhyWatchState }) {
  const [state, formAction] = useActionState(whyWatchAction, initialState);
  const insight = state.status === "ready" ? state.insight : undefined;

  if (state.status === "rated") {
    return <section className="page-width mt-10">
      <div className="rounded-2xl border border-line bg-soft px-6 py-5">
        <h2 className="m-0 text-[20px] font-[650] tracking-[-0.02em]">Already rated</h2>
        <p className="mb-0 mt-2 text-sm text-muted">You gave {state.title} {state.rating}/10. This rating now contributes to your taste profile and future predictions.</p>
      </div>
    </section>;
  }

  const references = insight ? [...insight.liked, ...insight.cautions] : [];
  // Float the "similar to movies you loved" reason (if present) to the front
  // so it becomes the hero card — see the comment on LIKED_REASON_HEADING.
  const orderedReasons = insight
    ? [...insight.reasons].sort((a, b) => (a.heading === LIKED_REASON_HEADING ? -1 : b.heading === LIKED_REASON_HEADING ? 1 : 0))
    : [];
  const [heroReason, ...restReasons] = orderedReasons;

  return <section className="page-width mt-10">
    <div className="rounded-[28px] border border-line/60 bg-soft p-5 max-[480px]:p-4 min-[760px]:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="m-0 text-[22px] font-[650] tracking-[-0.02em]">Why you&apos;ll probably like this</h2>
        {insight && !state.explanation ? <form className="flex flex-wrap gap-2" action={formAction}>
          <input name="id" type="hidden" value={id} />
          <input name="mediaType" type="hidden" value={mediaType} />
          <ActionButton>Tell me more</ActionButton>
        </form> : null}
      </div>

      {insight ? <div className="mt-4 space-y-5">
        <div className="flex flex-col gap-4 rounded-2xl bg-well p-5 max-[480px]:p-4 min-[760px]:flex-row min-[760px]:items-center min-[760px]:gap-6">
          <div className="flex-none min-[760px]:w-[200px]">
            <p className="m-0 text-sm text-muted">Predicted rating for you</p>
            <p className="m-0 mt-1 flex items-baseline gap-1.5">
              <span className="text-[56px] font-bold leading-none tracking-[-0.03em] text-ink max-[480px]:text-[44px]">{insight.estimatedRating.toFixed(1)}</span>
              <span className="text-lg text-muted">/10</span>
            </p>
          </div>
          <div className="hidden w-px self-stretch bg-line min-[760px]:block" />
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="m-0 text-lg font-semibold capitalize text-ink">{insight.confidence} confidence</h3>
              <InfoTooltip label="How this estimate was calculated">
                Based on {insight.ratingCount} matched ratings{insight.validationCount > 0 ? `, cross-checked against ${insight.validationCount} held-out ratings` : ""}. Expected error about ±{insight.estimatedError.toFixed(1)} points.
                {insight.comparableCount > 0 ? ` Confidence also reflects how closely ${insight.comparableCount} similar ${insight.comparableCount === 1 ? "title" : "titles"} you've rated agree with each other.` : ""}
              </InfoTooltip>
            </div>
            {insight.closelyRelatedCount > 0 ? <p className="m-0 mt-1 text-sm text-muted">Based on {insight.closelyRelatedCount} closely related {insight.closelyRelatedCount === 1 ? "title" : "titles"} you&apos;ve rated</p> : null}
          </div>
        </div>

        <div>
          {heroReason ? <HeroReasonCard reason={heroReason} references={references} /> : null}
          {restReasons.length > 0 ? <div className={`grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2 ${heroReason ? "mt-2.5" : ""}`}>
            {restReasons.map((reason) => <ReasonCard key={reason.heading} reason={reason} references={references} />)}
          </div> : null}
        </div>

        {insight.mismatchReasons.length > 0 ? <div>
          <h3 className="m-0 mb-2 text-[17px] font-semibold tracking-[-0.01em] text-ink">Things to consider</h3>
          <div className="rounded-2xl bg-well p-4">
            <ul className="m-0 list-none space-y-1.5 p-0 text-sm leading-[1.5] text-muted">
              {insight.mismatchReasons.map((reason) => <li key={reason.heading}>
                <span className="font-semibold text-ink">{reason.heading}.</span> <ReasonText references={references} text={reason.detail} />
              </li>)}
            </ul>
          </div>
        </div> : null}

        {state.explanation ? <div>
          <h3 className="m-0 mb-2 text-[17px] font-semibold tracking-[-0.01em] text-ink">Detailed explanation</h3>
          <div className="rounded-2xl bg-well p-4">
            <p className="m-0 text-xs text-muted">
              Predicted rating: <span className="font-semibold text-ink">{insight.estimatedRating.toFixed(1)}</span>
              {" "}· Expected range: <span className="font-semibold text-ink">{Math.max(1, insight.estimatedRating - insight.estimatedError).toFixed(1)}–{Math.min(10, insight.estimatedRating + insight.estimatedError).toFixed(1)}</span>
            </p>
            <p className="m-0 mt-2 text-sm leading-[1.55] text-ink">{state.explanation}</p>
          </div>
        </div> : null}
      </div> : null}

      {!insight && state.message ? <p className="m-0 mt-4 text-sm text-muted" role={state.status === "error" ? "alert" : undefined}>{state.message}</p> : null}
    </div>
  </section>;
}
