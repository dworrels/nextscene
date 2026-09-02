# NextScene

NextScene is a personal movie and TV discovery app. It uses your ratings and preferences to surface recommendations, explain why a title may suit your taste, track franchise releases, and help you find something to watch.

> This product uses the TMDB API but is not endorsed or certified by TMDB.

## Features

- Browse popular, top-rated, now-playing, upcoming, and on-the-air titles
- Search movies and TV shows by title or natural-language intent
- Import and manage ratings, then receive personally ranked recommendations
- See an estimated rating and a concise “Why watch?” explanation for a title
- Maintain watchlist, favorites, and “not interested” lists
- Set content preferences, including languages and disliked genres
- Track new entries in movie collections and new TV seasons
- Explore title details, trailers, streaming providers, episodes, and related titles

## Tech stack

- [Next.js](https://nextjs.org/) 16 with React 19 and TypeScript
- Tailwind CSS 4
- [TMDb API](https://developer.themoviedb.org/docs/getting-started)
- OpenAI API for generated “Why watch?” explanations
- Vitest and Testing Library

## Getting started

### Prerequisites

- Node.js 20.9 or newer
- A TMDb API Read Access Token
- An OpenAI API key (required only for generated “Why watch?” explanations)

### Install and configure

```bash
npm install
cp .env.example .env.local
```

Set these values in `.env.local`:

```dotenv
TMDB_API_READ_ACCESS_TOKEN=your_tmdb_read_access_token
TMDB_API_BASE_URL=https://api.themoviedb.org/3
TMDB_DEFAULT_LANGUAGE=en-US

# Required for generated detail-page “Why watch?” explanations.
OPENAI_API_KEY=your_openai_api_key
```

Create a TMDb token from [TMDb API settings](https://www.themoviedb.org/settings/api). Keep both API keys server-side; do not use `NEXT_PUBLIC_` prefixes for them.

### Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Run the production server after building. |
| `npm run lint` | Run ESLint. |
| `npm test` | Run the test suite once. |

## How personalization works

Import or add ratings from the Ratings page. NextScene matches rated titles to TMDb, builds a taste profile from title metadata, and ranks candidate titles using that profile alongside TMDb recommendations and discovery results. Rated, watchlisted, and dismissed titles are excluded from future recommendation pools.

The natural-language search accepts queries such as “short French thrillers,” “family-friendly animated movies,” or “a show like *Severance*.” It combines recognized constraints with catalog search and the saved taste profile when relevant.

## Data storage and deployment

Personal data is stored as JSON files under `data/` at runtime, including ratings, watchlists, favorites, preferences, dismissed titles, and cached explanations. This makes local development simple, but it requires persistent writable storage in production.

For a deployed instance, use a single Node server with a persistent volume mounted for `data/`. Stateless or serverless platforms with ephemeral filesystems will not reliably retain personal data or coordinate concurrent writes across instances.

## Project structure

```text
src/app/          Routes and pages
src/components/   UI components
src/lib/          TMDb client, personalization, storage, and server actions
src/types/        Shared TypeScript types
data/             Runtime JSON data (created as needed; do not commit personal data)
```

## Attribution

Movie, TV, image, and watch-provider metadata is supplied by [The Movie Database (TMDb)](https://www.themoviedb.org/). NextScene is not endorsed or certified by TMDb.
