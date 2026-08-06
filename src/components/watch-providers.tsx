import type { WatchProvider, WatchProviders } from "@/types/tmdb";

function ProviderGroup({ label, providers }: { label: string; providers: WatchProvider[] }) {
  if (providers.length === 0) return null;

  return <div className="mb-3">
    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted">{label}</p>
    <div className="flex flex-wrap gap-3">
      {providers.map((provider) => <div key={provider.id} className="flex items-center gap-2 rounded-full bg-soft px-3 py-1.5 text-xs font-medium text-ink">
        {provider.logoUrl ? <span className="h-5 w-5 flex-none rounded bg-cover bg-center" style={{ backgroundImage: `url(${provider.logoUrl})` }} /> : null}
        {provider.name}
      </div>)}
    </div>
  </div>;
}

export function WatchProvidersSection({ watchProviders }: { watchProviders: WatchProviders }) {
  const hasProviders = watchProviders.flatrate.length > 0 || watchProviders.rent.length > 0 || watchProviders.buy.length > 0;
  if (!hasProviders) return null;

  return <section className="page-width mt-10 max-w-[560px]">
    <h2 className="m-0 mb-4 text-[20px] font-[650] tracking-[-0.02em]">Where to watch</h2>
    <ProviderGroup label="Stream" providers={watchProviders.flatrate} />
    <ProviderGroup label="Rent" providers={watchProviders.rent} />
    <ProviderGroup label="Buy" providers={watchProviders.buy} />
    <p className="mt-4 text-xs text-muted">
      Streaming data provided by <a className="underline hover:text-ink" href="https://www.justwatch.com" target="_blank" rel="noreferrer">JustWatch</a>.
      {watchProviders.link ? <> <a className="underline hover:text-ink" href={watchProviders.link} target="_blank" rel="noreferrer">More watch options</a></> : null}
    </p>
  </section>;
}
