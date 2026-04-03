import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Navigation from './components/Navigation';
import StreamList from './components/StreamList';
import Find from './components/Find';
import Movies from './components/Movies';
import Cart from './components/Cart';
import About from './components/About';
import Login from './components/Login';
import Profile from './components/Profile';
import './App.css';

const USER_STORAGE_KEY = 'streamlist-user';
const ITEMS_STORAGE_KEY = 'streamlist-items';

const loadItems = () => {
  try {
    const storedItems = localStorage.getItem(ITEMS_STORAGE_KEY);
    return storedItems ? JSON.parse(storedItems) : [];
  } catch {
    return [];
  }
};

function ProtectedRoute({ currentUser, children }) {
  const location = useLocation();
  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

function LoginRoute({ currentUser, onLogin }) {
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || '/profile';
  if (currentUser) {
    return <Navigate to={redirectTo} replace />;
  }
  return <Login onLogin={onLogin} />;
}

function App() {
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem(USER_STORAGE_KEY));
  const [streamItems, setStreamItems] = useState(loadItems);

  useEffect(() => {
    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(streamItems));
  }, [streamItems]);

  const handleLogin = (username) => {
    localStorage.setItem(USER_STORAGE_KEY, username);
    setCurrentUser(username);
  };

  const handleLogout = () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    setCurrentUser(null);
  };

  const handleAddMovieToStreamList = (movie) => {
    const title = movie.title?.trim();
    if (!title) {
      return;
    }

    const releaseYear = movie.releaseDate?.slice(0, 4);
    const displayText = releaseYear ? `${title} (${releaseYear})` : title;

    setStreamItems((previousItems) => {
      const hasDuplicate = previousItems.some((item) => {
        if (movie.id && item.tmdbId) {
          return item.tmdbId === movie.id;
        }
        return item.text.toLowerCase() === displayText.toLowerCase();
      });

      if (hasDuplicate) {
        return previousItems;
      }

      return [
        {
          id: Date.now(),
          text: displayText,
          completed: false,
          tmdbId: movie.id || null,
        },
        ...previousItems,
      ];
    });
  };

  return (
    <Router>
      <div className="app-container">
        <Navigation currentUser={currentUser} />
        <main className="content">
          <Routes>
            <Route path="/" element={<ProtectedRoute currentUser={currentUser}><StreamList items={streamItems} setItems={setStreamItems} /></ProtectedRoute>} />
            <Route path="/find" element={<ProtectedRoute currentUser={currentUser}><Find streamItems={streamItems} onAddToStreamList={handleAddMovieToStreamList} /></ProtectedRoute>} />
            <Route path="/movie" element={<ProtectedRoute currentUser={currentUser}><Movies /></ProtectedRoute>} />
            <Route path="/movies" element={<ProtectedRoute currentUser={currentUser}><Movies /></ProtectedRoute>} />
            <Route path="/cart" element={<ProtectedRoute currentUser={currentUser}><Cart /></ProtectedRoute>} />
            <Route path="/about" element={<ProtectedRoute currentUser={currentUser}><About /></ProtectedRoute>} />
            <Route
              path="/login"
              element={<LoginRoute currentUser={currentUser} onLogin={handleLogin} />}
            />
            <Route path="/profile" element={<ProtectedRoute currentUser={currentUser}><Profile currentUser={currentUser} onLogout={handleLogout} /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
