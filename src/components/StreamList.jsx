import React, { useState } from 'react';

const TMDB_API_URL = import.meta.env.VITE_TMDB_API_URL || 'https://api.themoviedb.org/3';
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_IMAGE_BASE_URL = import.meta.env.VITE_TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';

function StreamList({ items, setItems }) {
  const [inputValue, setInputValue] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState(null);
  const [movieDetailsByTmdbId, setMovieDetailsByTmdbId] = useState({});
  const [detailErrorsByTmdbId, setDetailErrorsByTmdbId] = useState({});
  const [loadingTmdbId, setLoadingTmdbId] = useState(null);

  React.useEffect(() => {
    const query = inputValue.trim();
    if (!TMDB_API_KEY || query.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `${TMDB_API_URL}/search/movie?api_key=${encodeURIComponent(TMDB_API_KEY)}&query=${encodeURIComponent(query)}&include_adult=false&page=1`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          setSuggestions([]);
          return;
        }

        const payload = await response.json();
        const nextSuggestions = (payload.results || []).slice(0, 8).map((movie) => {
          const year = movie.release_date?.slice(0, 4);
          return {
            id: movie.id,
            label: year ? `${movie.title} (${year})` : movie.title,
          };
        });
        setSuggestions(nextSuggestions);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [inputValue]);

  const addStreamItem = (text) => {
    const trimmedValue = text.trim();
    if (!trimmedValue) {
      return;
    }

    setItems((prevItems) => {
      const alreadyExists = prevItems.some(
        (item) => item.text.toLowerCase() === trimmedValue.toLowerCase(),
      );

      if (alreadyExists) {
        return prevItems;
      }

      return [
        {
          id: Date.now(),
          text: trimmedValue,
          completed: false,
        },
        ...prevItems,
      ];
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    addStreamItem(inputValue);
    setInputValue('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const toggleComplete = (id) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const deleteItem = (id) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditValue('');
    }
    if (expandedItemId === id) {
      setExpandedItemId(null);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditValue(item.text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveEdit = (id) => {
    const trimmedValue = editValue.trim();
    if (!trimmedValue) {
      return;
    }

    let didUpdate = false;
    setItems((prevItems) => {
      const hasDuplicate = prevItems.some(
        (item) => item.id !== id && item.text.toLowerCase() === trimmedValue.toLowerCase(),
      );
      if (hasDuplicate) {
        return prevItems;
      }

      didUpdate = true;
      return prevItems.map((item) =>
        item.id === id ? { ...item, text: trimmedValue } : item
      );
    });

    if (!didUpdate) {
      return;
    }

    setEditingId(null);
    setEditValue('');
  };

  const handleSuggestionSelect = (label) => {
    addStreamItem(label);
    setInputValue('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const loadMovieDetails = async (tmdbId) => {
    if (!TMDB_API_KEY || !tmdbId) {
      return;
    }
    if (movieDetailsByTmdbId[tmdbId] || detailErrorsByTmdbId[tmdbId]) {
      return;
    }

    setLoadingTmdbId(tmdbId);
    try {
      const response = await fetch(
        `${TMDB_API_URL}/movie/${tmdbId}?api_key=${encodeURIComponent(TMDB_API_KEY)}`,
      );
      if (!response.ok) {
        throw new Error('TMDB details request failed');
      }
      const payload = await response.json();
      const details = {
        title: payload.title || '',
        overview: payload.overview || '',
        releaseDate: payload.release_date || '',
        rating: payload.vote_average,
        posterUrl: payload.poster_path ? `${TMDB_IMAGE_BASE_URL}/w342${payload.poster_path}` : null,
      };
      setMovieDetailsByTmdbId((previous) => ({ ...previous, [tmdbId]: details }));
    } catch {
      setDetailErrorsByTmdbId((previous) => ({ ...previous, [tmdbId]: 'Unable to load TMDB details right now.' }));
    } finally {
      setLoadingTmdbId((previous) => (previous === tmdbId ? null : previous));
    }
  };

  const toggleExpanded = async (item) => {
    if (expandedItemId === item.id) {
      setExpandedItemId(null);
      return;
    }

    setExpandedItemId(item.id);
    if (item.tmdbId) {
      await loadMovieDetails(item.tmdbId);
    }
  };

  const totalItems = items.length;
  const completedItems = items.filter((item) => item.completed).length;

  return (
    <div className="page-container">
      <h2>StreamList</h2>
      <p>Add movies to watch, then edit, complete, or remove them below.</p>
      <form onSubmit={handleSubmit} className="input-group">
        <div className="streamlist-input-wrap">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 120);
            }}
            placeholder="Enter movie name"
            className="streamlist-input"
          />
          {showSuggestions && (suggestions.length > 0 || isSearching) ? (
            <ul className="autocomplete-list">
              {isSearching ? <li className="autocomplete-item muted">Searching...</li> : null}
              {!isSearching
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
        <button type="submit" className="add-button">Submit</button>
      </form>

      <div className="list-header">
        <p>{totalItems} total</p>
        <p>{completedItems} completed</p>
      </div>

      {items.length === 0 ? (
        <p className="empty-state">No entries yet. Add your first service above.</p>
      ) : (
        <ul className="stream-items">
          {items.map((item) => (
            <li key={item.id} className={`stream-item ${item.completed ? 'is-complete' : ''}`}>
              <div className="stream-item-main">
                {editingId === item.id ? (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="edit-input"
                    aria-label={`Edit ${item.text}`}
                  />
                ) : (
                  <button
                    type="button"
                    className="item-title-button"
                    onClick={() => {
                      void toggleExpanded(item);
                    }}
                    aria-expanded={expandedItemId === item.id}
                  >
                    <span className="item-text">{item.text}</span>
                    <span className="material-symbols-outlined detail-caret">
                      {expandedItemId === item.id ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                )}

                <div className="item-actions">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => toggleComplete(item.id)}
                    title={item.completed ? 'Mark as incomplete' : 'Mark as complete'}
                  >
                    <span className="material-symbols-outlined">
                      {item.completed ? 'undo' : 'check_circle'}
                    </span>
                  </button>

                  {editingId === item.id ? (
                    <>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => saveEdit(item.id)}
                        title="Save"
                        disabled={!editValue.trim()}
                      >
                        <span className="material-symbols-outlined">save</span>
                      </button>
                      <button type="button" className="icon-button" onClick={cancelEdit} title="Cancel">
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => startEdit(item)}
                      title="Edit"
                    >
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="icon-button danger"
                    onClick={() => deleteItem(item.id)}
                    title="Delete"
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </div>

              {expandedItemId === item.id ? (
                <div className="stream-item-details">
                  {!item.tmdbId ? (
                    <p className="empty-state">No TMDB details available for this entry. Add titles from Find to enable details.</p>
                  ) : loadingTmdbId === item.tmdbId ? (
                    <p className="empty-state">Loading details...</p>
                  ) : detailErrorsByTmdbId[item.tmdbId] ? (
                    <p className="auth-error">{detailErrorsByTmdbId[item.tmdbId]}</p>
                  ) : movieDetailsByTmdbId[item.tmdbId] ? (
                    <div className="stream-detail-card">
                      <div className="stream-detail-content">
                        <p className="find-meta">
                          {movieDetailsByTmdbId[item.tmdbId].releaseDate
                            ? `Release: ${movieDetailsByTmdbId[item.tmdbId].releaseDate}`
                            : 'Release date unavailable'}
                          {' • '}
                          {typeof movieDetailsByTmdbId[item.tmdbId].rating === 'number'
                            ? `Rating: ${movieDetailsByTmdbId[item.tmdbId].rating.toFixed(1)}/10`
                            : 'Rating unavailable'}
                        </p>
                        <p className="find-overview">
                          {movieDetailsByTmdbId[item.tmdbId].overview || 'No overview available for this movie.'}
                        </p>
                      </div>
                      <div className="stream-detail-poster-wrap">
                        {movieDetailsByTmdbId[item.tmdbId].posterUrl ? (
                          <img
                            src={movieDetailsByTmdbId[item.tmdbId].posterUrl}
                            alt={`${movieDetailsByTmdbId[item.tmdbId].title || item.text} poster`}
                            className="stream-detail-poster"
                            loading="lazy"
                          />
                        ) : (
                          <div className="find-poster-placeholder">No poster available</div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default StreamList;
