import React, { useEffect, useState } from 'react';

const TMDB_API_URL = import.meta.env.VITE_TMDB_API_URL || 'https://api.themoviedb.org/3';
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

function Find({ streamItems, onAddToStreamList }) {
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState([]);
  const [lastQuery, setLastQuery] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!TMDB_API_KEY || trimmedQuery.length < 2) {
      setSuggestions([]);
      setIsSuggestionsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSuggestionsLoading(true);
      try {
        const response = await fetch(
          `${TMDB_API_URL}/search/movie?api_key=${encodeURIComponent(TMDB_API_KEY)}&query=${encodeURIComponent(trimmedQuery)}&include_adult=false&page=1`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          setSuggestions([]);
          return;
        }

        const payload = await response.json();
        const nextSuggestions = (payload.results || []).slice(0, 8).map((movie) => ({
          id: movie.id,
          label: movie.title,
        }));
        setSuggestions(nextSuggestions);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSuggestionsLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const runSearch = async (searchTerm) => {
    const trimmedQuery = searchTerm.trim();
    if (!trimmedQuery) {
      setError('Enter a movie title to search.');
      return;
    }
    if (!TMDB_API_KEY) {
      setError('TMDB API key is missing. Add VITE_TMDB_API_KEY to your environment.');
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const response = await fetch(
        `${TMDB_API_URL}/search/movie?api_key=${encodeURIComponent(TMDB_API_KEY)}&query=${encodeURIComponent(trimmedQuery)}&include_adult=false&page=1`,
      );

      if (!response.ok) {
        setError('TMDB search failed. Please try again.');
        setMovies([]);
        return;
      }

      const payload = await response.json();
      const nextMovies = (payload.results || []).slice(0, 12).map((movie) => ({
        id: movie.id,
        title: movie.title,
        overview: movie.overview,
        releaseDate: movie.release_date,
        rating: movie.vote_average,
      }));

      setMovies(nextMovies);
      setLastQuery(trimmedQuery);
      setQuery('');
      setSuggestions([]);
      setShowSuggestions(false);
    } catch {
      setError('Unable to reach TMDB right now.');
      setMovies([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await runSearch(query);
  };

  const handleSuggestionSelect = (label) => {
    setQuery(label);
    setShowSuggestions(false);
    void runSearch(label);
  };

  return (
    <div className="page-container">
      <h2>Find</h2>
      <p>Search TMDB and review movie details.</p>

      <form onSubmit={handleSubmit} className="find-form">
        <div className="find-input-wrap">
          <input
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 120);
            }}
            placeholder="Search movie title..."
            className="streamlist-input find-input"
          />
          {showSuggestions && (suggestions.length > 0 || isSuggestionsLoading) ? (
            <ul className="autocomplete-list">
              {isSuggestionsLoading ? <li className="autocomplete-item muted">Searching...</li> : null}
              {!isSuggestionsLoading
                ? suggestions.map((suggestion) => (
                  <li key={suggestion.id}>
                    <button
                      type="button"
                      className="autocomplete-item"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSuggestionSelect(suggestion.label)}
                    >
                      {suggestion.label}
                    </button>
                  </li>
                ))
                : null}
            </ul>
          ) : null}
        </div>
        <button type="submit" className="add-button" disabled={isLoading}>
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error ? <p className="auth-error">{error}</p> : null}
      {lastQuery ? <p className="find-results-title">Results for "{lastQuery}"</p> : null}

      {movies.length === 0 && lastQuery && !isLoading ? (
        <p className="empty-state">No movies found.</p>
      ) : null}

      <ul className="find-results">
        {movies.map((movie) => {
          const releaseYear = movie.releaseDate?.slice(0, 4);
          const displayText = releaseYear ? `${movie.title} (${releaseYear})` : movie.title;
          const alreadyAdded = streamItems.some((item) => {
            if (movie.id && item.tmdbId) {
              return item.tmdbId === movie.id;
            }
            return item.text.toLowerCase() === displayText.toLowerCase();
          });

          return (
            <li key={movie.id} className="find-card">
              <h3>{movie.title}</h3>
              <p className="find-meta">
                {movie.releaseDate ? `Release: ${movie.releaseDate}` : 'Release date unavailable'}
                {' • '}
                {typeof movie.rating === 'number' ? `Rating: ${movie.rating.toFixed(1)}/10` : 'Rating unavailable'}
              </p>
              <p className="find-overview">{movie.overview || 'No overview available for this movie.'}</p>
              <button
                type="button"
                className="add-result-button"
                onClick={() => onAddToStreamList(movie)}
                disabled={alreadyAdded}
              >
                {alreadyAdded ? 'Added' : 'Add to StreamList'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default Find;
