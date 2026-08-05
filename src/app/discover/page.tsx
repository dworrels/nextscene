import { MovieGrid } from "@/components/movie-grid";
import { SiteHeader } from "@/components/site-header";
import { buildDiscoverParams, countActiveFilters, parseDiscoverFilters } from "@/lib/discover-filters";
import { getDiscoverMovies, getGenres, getSearchMovies, getWatchProviders, resolvePerson } from "@/lib/tmdb";
import type { Movie } from "@/types/tmdb";

export const revalidate = 3600;

const CURRENT_DECADE = Math.floor(new Date().getFullYear() / 10) * 10;
const DECADES = Array.from({ length: (CURRENT_DECADE - 1950) / 10 + 1 }, (_, i) => CURRENT_DECADE - i * 10);
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "hi", label: "Hindi" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
];
const CERTIFICATIONS = ["G", "PG", "PG-13", "R", "NC-17"];
const SORT_OPTIONS = [
  { value: "popularity.desc", label: "Most popular" },
  { value: "vote_average.desc", label: "Highest rated" },
  { value: "primary_release_date.desc", label: "Newest" },
  { value: "primary_release_date.asc", label: "Oldest" },
  { value: "title.asc", label: "Title A–Z" },
];

const selectClass = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink";
const labelClass = "mb-1.5 block text-xs font-semibold text-muted";

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const resolvedSearchParams = await searchParams;
  const filters = parseDiscoverFilters(resolvedSearchParams);
  const activeFilterCount = countActiveFilters(filters);

  const [genres, providers] = await Promise.all([getGenres(), getWatchProviders()]);

  let movies: Movie[] = [];
  let totalResults = 0;
  let personNotFound = false;

  if (filters.query) {
    const result = await getSearchMovies(filters.query);
    movies = result.movies;
    totalResults = result.totalResults;
  } else {
    const resolvedPerson = filters.person ? await resolvePerson(filters.person) : null;
    const discoverParams = buildDiscoverParams(filters, resolvedPerson?.id ?? null);
    const result = await getDiscoverMovies(discoverParams);
    movies = result.movies;
    totalResults = result.totalResults;
    personNotFound = Boolean(filters.person && !resolvedPerson);
  }

  return <main>
    <SiteHeader />
    <section className="page-width pt-[84px] max-[760px]:pt-11 pb-[38px] max-[760px]:pb-[25px]">
      <h1 className="m-0 text-[clamp(42px,6vw,76px)] font-bold leading-[0.98] tracking-[-0.02em]">Discover</h1>
      <p className="mt-[13px] text-[15px] text-muted">{totalResults.toLocaleString()} films match your search.</p>
    </section>

    <form className="page-width mb-10" method="GET">
      <div className="mb-4 flex gap-3">
        <input
          className="flex-1 rounded-full border border-line bg-soft px-5 py-2.5 text-sm text-ink"
          defaultValue={filters.query ?? ""}
          name="q"
          placeholder="Search movies…"
          type="text"
        />
        <button className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-bg" type="submit">Search</button>
      </div>

      <details className="rounded-2xl border border-line bg-soft px-5 py-4" open={activeFilterCount > 0}>
        <summary className="cursor-pointer text-sm font-semibold text-ink">
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </summary>

        <div className="mt-4 grid grid-cols-4 gap-4 max-[760px]:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Genre</span>
            <select name="genre" defaultValue={filters.genre ?? ""} className={selectClass}>
              <option value="">Any</option>
              {genres.map((genre) => <option value={genre.id} key={genre.id}>{genre.name}</option>)}
            </select>
          </label>

          <label className="block">
            <span className={labelClass}>Decade</span>
            <select name="decade" defaultValue={filters.decade ?? ""} className={selectClass}>
              <option value="">Any</option>
              {DECADES.map((decade) => <option value={decade} key={decade}>{decade}s</option>)}
            </select>
          </label>

          <label className="block">
            <span className={labelClass}>Language</span>
            <select name="language" defaultValue={filters.language ?? ""} className={selectClass}>
              <option value="">Any</option>
              {LANGUAGES.map((language) => <option value={language.code} key={language.code}>{language.label}</option>)}
            </select>
          </label>

          <label className="block">
            <span className={labelClass}>Certification</span>
            <select name="certification" defaultValue={filters.certification ?? ""} className={selectClass}>
              <option value="">Any</option>
              {CERTIFICATIONS.map((rating) => <option value={rating} key={rating}>{rating}</option>)}
            </select>
          </label>

          <label className="block">
            <span className={labelClass}>Min runtime (min)</span>
            <input type="number" name="runtimeMin" min={0} defaultValue={filters.runtimeMin ?? ""} className={selectClass} />
          </label>

          <label className="block">
            <span className={labelClass}>Max runtime (min)</span>
            <input type="number" name="runtimeMax" min={0} defaultValue={filters.runtimeMax ?? ""} className={selectClass} />
          </label>

          <label className="block">
            <span className={labelClass}>Sort by</span>
            <select name="sortBy" defaultValue={filters.sortBy} className={selectClass}>
              {SORT_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>

          <div className="flex gap-2">
            <label className="block flex-[2]">
              <span className={labelClass}>Cast or crew</span>
              <input type="text" name="person" placeholder="e.g. Tom Hanks" defaultValue={filters.person ?? ""} className={selectClass} />
            </label>
            <label className="block flex-1">
              <span className={labelClass}>Role</span>
              <select name="personRole" defaultValue={filters.personRole} className={selectClass}>
                <option value="cast">Cast</option>
                <option value="crew">Crew</option>
              </select>
            </label>
          </div>

          <div className="col-span-4 max-[760px]:col-span-2">
            <span className={labelClass}>Available on</span>
            <div className="flex flex-wrap gap-3">
              {providers.map((provider) => <label className="flex items-center gap-1.5 text-sm text-ink" key={provider.id}>
                <input type="checkbox" name="providers" value={provider.id} defaultChecked={filters.providers.includes(provider.id)} />
                {provider.name}
              </label>)}
            </div>
          </div>

          <div className="col-span-4 max-[760px]:col-span-2 flex items-center gap-4">
            <button type="submit" className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-bg">Apply filters</button>
            <a className="text-sm text-muted hover:text-ink" href="/discover">Reset</a>
          </div>
        </div>
      </details>
    </form>

    {personNotFound ? <p className="page-width mb-6 -mt-4 text-sm text-muted">Could not find &ldquo;{filters.person}&rdquo; — showing results without this filter.</p> : null}
    {filters.query ? <p className="page-width mb-6 -mt-4 text-sm text-muted">Showing search results for &ldquo;{filters.query}&rdquo; — filters are ignored while searching.</p> : null}

    <MovieGrid movies={movies} />
  </main>;
}
