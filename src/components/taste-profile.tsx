import { importRatingsAction, repairRowAction } from "@/lib/ratings-actions";
import { readRatings } from "@/lib/ratings";

export async function TasteProfile() {
  const { rows } = await readRatings();

  if (rows.length === 0) {
    return <section className="page-width mt-16 max-[760px]:mt-10" aria-labelledby="taste-profile-heading">
      <div className="rounded-2xl bg-soft px-8 py-14 text-center max-[760px]:px-6 max-[760px]:py-10">
        <h2 className="m-0 text-[28px] font-[650] leading-[1.12] tracking-[-0.02em] max-[760px]:text-[25px]" id="taste-profile-heading">No ratings yet</h2>
        <p className="mx-auto mt-3 max-w-[420px] text-sm text-muted">Import your IMDb ratings export to unlock personal recommendations and taste insights.</p>
        <form className="mx-auto mt-6 flex max-w-[420px] flex-col items-center gap-3" action={importRatingsAction}>
          <input type="file" name="file" accept=".csv" required className="w-full text-sm text-muted" />
          <button className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-bg" type="submit">Import ratings</button>
        </form>
      </div>
    </section>;
  }

  const matched = rows.filter((row) => row.tmdbId !== null);
  const unmatched = rows.filter((row) => row.tmdbId === null);

  return <section className="page-width mt-16 max-[760px]:mt-10" aria-labelledby="taste-profile-heading">
    <div className="rounded-2xl bg-soft px-8 py-10 max-[760px]:px-6">
      <h2 className="m-0 text-[28px] font-[650] leading-[1.12] tracking-[-0.02em] max-[760px]:text-[25px]" id="taste-profile-heading">Your taste profile</h2>
      <p className="mt-3 text-sm text-muted">
        {matched.length} of {rows.length} ratings matched to TMDb.
        {unmatched.length > 0 ? ` ${unmatched.length} need review below.` : ""}
      </p>

      {unmatched.length > 0 ? <div className="mt-6 flex flex-col gap-2">
        {unmatched.map((row) => <form className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2" action={repairRowAction} key={row.imdbId}>
          <input type="hidden" name="imdbId" value={row.imdbId} />
          <span className="flex-1 truncate text-sm text-ink">{row.title}</span>
          <input className="w-40 rounded-md border border-line bg-soft px-2 py-1 text-xs text-ink" name="query" placeholder="TMDb ID or title" type="text" />
          <button className="rounded-md bg-ink px-3 py-1 text-xs font-semibold text-bg" type="submit">Fix</button>
        </form>)}
      </div> : null}

      <form className="mt-6" action={importRatingsAction}>
        <label className="text-sm text-muted">
          Re-import ratings
          <input type="file" name="file" accept=".csv" required className="mt-2 block w-full max-w-[320px] text-sm text-muted" />
        </label>
        <button className="mt-3 rounded-full bg-ink px-5 py-2 text-xs font-semibold text-bg" type="submit">Import</button>
      </form>
    </div>
  </section>;
}
