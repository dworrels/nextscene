export type BrowseCategory = { key: string; label: string; gradient: string };

export const BROWSE_CATEGORIES: BrowseCategory[] = [
  { key: "popular-movies", label: "Popular Movies", gradient: "from-[#ff5f6d] to-[#8b2fc9]" },
  { key: "popular-tv", label: "Popular TV Shows", gradient: "from-[#2af598] to-[#009efd]" },
  { key: "top-rated-movies", label: "Top Rated Movies", gradient: "from-[#f7971e] to-[#ffd200]" },
  { key: "top-rated-tv", label: "Top Rated TV Shows", gradient: "from-[#ee0979] to-[#ff6a00]" },
  { key: "now-playing", label: "In Theaters Now", gradient: "from-[#4568dc] to-[#b06ab3]" },
  { key: "on-the-air", label: "Airing This Week", gradient: "from-[#11998e] to-[#38ef7d]" },
  { key: "airing-today", label: "Airing Today", gradient: "from-[#4776e6] to-[#8e54e9]" },
  { key: "coming-soon", label: "Coming Soon", gradient: "from-[#ec008c] to-[#6a3093]" },
];
