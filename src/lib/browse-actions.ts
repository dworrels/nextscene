"use server";

import {
  getAiringTodayTvShows,
  getMovieRecommendations,
  getNowPlayingMovies,
  getOnTheAirTvShows,
  getPopularMovies,
  getPopularTvShows,
  getSearchMovies,
  getSearchTv,
  getTopRatedMovies,
  getTopRatedTvShows,
  getTvRecommendations,
  getUpcomingMovies,
} from "@/lib/tmdb";
import type { MediaItem, PagedResult } from "@/types/tmdb";

function emptyPage(): PagedResult<MediaItem> {
  return { items: [], page: 1, totalPages: 1, totalResults: 0 };
}

export async function browseCategory(key: string, page = 1): Promise<PagedResult<MediaItem>> {
  switch (key) {
    case "popular-movies": return getPopularMovies(page);
    case "popular-tv": return getPopularTvShows(page);
    case "top-rated-movies": return getTopRatedMovies(page);
    case "top-rated-tv": return getTopRatedTvShows(page);
    case "now-playing": return getNowPlayingMovies(page);
    case "on-the-air": return getOnTheAirTvShows(page);
    case "airing-today": return getAiringTodayTvShows(page);
    case "coming-soon": return getUpcomingMovies(page);
    default: return emptyPage();
  }
}

export async function loadMovieRecommendations(movieId: number, page: number): Promise<PagedResult<MediaItem>> {
  return getMovieRecommendations(movieId, page);
}

export async function loadTvRecommendations(showId: number, page: number): Promise<PagedResult<MediaItem>> {
  return getTvRecommendations(showId, page);
}

export async function searchMediaPage(query: string, page = 1): Promise<PagedResult<MediaItem>> {
  const trimmed = query.trim();
  if (!trimmed) return emptyPage();

  const [movies, shows] = await Promise.all([
    getSearchMovies(trimmed, page).catch(() => emptyPage()),
    getSearchTv(trimmed, page).catch(() => emptyPage()),
  ]);

  return {
    items: [...movies.items, ...shows.items].sort((a, b) => b.audienceScore - a.audienceScore),
    page,
    totalPages: Math.max(movies.totalPages, shows.totalPages),
    totalResults: movies.totalResults + shows.totalResults,
  };
}
