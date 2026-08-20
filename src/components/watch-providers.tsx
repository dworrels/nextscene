import type { WatchProvider, WatchProviders } from "@/types/tmdb";

function ProviderGroup({ label, providers }: { label: string; providers: WatchProvider[] }) {
  if (providers.length === 0) return null;

  return <div>
    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted">{label}</p>
    <div className="flex flex-wrap gap-2">
      {providers.map((provider) => <div key={provider.id} className="flex h-8 items-center gap-2 rounded-full bg-well px-3 text-xs font-medium text-ink">
        {provider.logoUrl ? <span className="h-4 w-4 flex-none rounded bg-cover bg-center" style={{ backgroundImage: `url(${provider.logoUrl})` }} /> : null}
        <span className="truncate">{provider.name}</span>
      </div>)}
    </div>
  </div>;
}

export function WatchProvidersSection({ watchProviders }: { watchProviders: WatchProviders }) {
  const hasProviders = watchProviders.flatrate.length > 0 || watchProviders.rent.length > 0 || watchProviders.buy.length > 0;
  if (!hasProviders) return null;

  return <section className="page-width mt-10">
    <div className="rounded-[28px] border border-line/60 bg-soft p-5 max-[480px]:p-4 min-[760px]:p-6">
      <h2 className="m-0 mb-4 text-[20px] font-[650] tracking-[-0.02em]">Where to watch</h2>
      <div className="flex flex-col gap-4">
        <ProviderGroup label="Included with subscription" providers={watchProviders.flatrate} />
        <ProviderGroup label="Rent" providers={watchProviders.rent} />
        <ProviderGroup label="Buy" providers={watchProviders.buy} />
      </div>
      <p className="mt-4 text-[11px] text-muted/70">
        Streaming data provided by <a className="underline hover:text-muted" href="https://www.justwatch.com" target="_blank" rel="noreferrer">JustWatch</a>.
        {watchProviders.link ? <> <a className="underline hover:text-muted" href={watchProviders.link} target="_blank" rel="noreferrer">More watch options</a></> : null}
      </p>
    </div>
  </section>;
}
