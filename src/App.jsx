import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Navigation from './components/Navigation';
import StreamList from './components/StreamList';
import Movies from './components/Movies';
import Cart from './components/Cart';
import CreditCard from './components/CreditCard';
import About from './components/About';
import Login from './components/Login';
import Profile from './components/Profile';
import { currentUserRequest, logoutRequest } from './lib/authApi';
import './App.css';

const ITEMS_STORAGE_KEY_PREFIX = 'streamlist-items';
const CART_STORAGE_KEY_PREFIX = 'streamlist-cart';

const getStorageKey = (prefix, username) => `${prefix}:${username}`;

const loadUserCollection = (prefix, username) => {
  if (!username) {
    return [];
  }
  try {
    const storedValue = localStorage.getItem(getStorageKey(prefix, username));
    return storedValue ? JSON.parse(storedValue) : [];
  } catch {
    return [];
  }
};

function ProtectedRoute({ currentUser, authResolved, children }) {
  const location = useLocation();
  if (!authResolved) {
    return <p>Checking session...</p>;
  }
  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

function LoginRoute({ currentUser, authResolved }) {
  const location = useLocation();
  if (!authResolved) {
    return <p>Checking session...</p>;
  }
  const fromLocation = location.state?.from;
  const redirectTo = fromLocation
    ? `${fromLocation.pathname || '/'}${fromLocation.search || ''}${fromLocation.hash || ''}`
    : '/';
  if (currentUser) {
    return <Navigate to={redirectTo} replace />;
  }
  return <Login />;
}

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [streamItems, setStreamItems] = useState([]);
  const [cartItems, setCartItems] = useState([]);

  useEffect(() => {
    let isActive = true;
    const loadCurrentUser = async () => {
      try {
        const payload = await currentUserRequest();
        if (isActive) {
          setCurrentUser(payload.username || null);
        }
      } catch {
        if (isActive) {
          setCurrentUser(null);
        }
      } finally {
        if (isActive) {
          setAuthResolved(true);
        }
      }
    };

    void loadCurrentUser();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!authResolved) {
      return;
    }
    if (!currentUser) {
      setStreamItems([]);
      setCartItems([]);
      return;
    }

    setStreamItems(loadUserCollection(ITEMS_STORAGE_KEY_PREFIX, currentUser));
    setCartItems(loadUserCollection(CART_STORAGE_KEY_PREFIX, currentUser));
  }, [authResolved, currentUser]);

  useEffect(() => {
    if (!authResolved || !currentUser) {
      return;
    }
    localStorage.setItem(getStorageKey(ITEMS_STORAGE_KEY_PREFIX, currentUser), JSON.stringify(streamItems));
  }, [authResolved, currentUser, streamItems]);

  useEffect(() => {
    if (!authResolved || !currentUser) {
      return;
    }
    localStorage.setItem(getStorageKey(CART_STORAGE_KEY_PREFIX, currentUser), JSON.stringify(cartItems));
  }, [authResolved, currentUser, cartItems]);

  const handleLogout = async () => {
    try {
      await logoutRequest();
    } finally {
      setCurrentUser(null);
    }
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

  const cartItemCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  return (
    <Router>
      <div className="app-container">
        <Navigation currentUser={currentUser} cartItemCount={cartItemCount} />
        <main className="content">
          <Routes>
            <Route path="/" element={<ProtectedRoute currentUser={currentUser} authResolved={authResolved}><StreamList items={streamItems} setItems={setStreamItems} /></ProtectedRoute>} />
            <Route path="/find" element={<Navigate to="/movies" replace />} />
            <Route path="/movie" element={<Navigate to="/movies" replace />} />
            <Route path="/movies" element={<ProtectedRoute currentUser={currentUser} authResolved={authResolved}><Movies streamItems={streamItems} onAddToStreamList={handleAddMovieToStreamList} /></ProtectedRoute>} />
            <Route
              path="/cart"
              element={
                <ProtectedRoute currentUser={currentUser} authResolved={authResolved}>
                  <Cart cartItems={cartItems} setCartItems={setCartItems} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/credit-card"
              element={
                <ProtectedRoute currentUser={currentUser} authResolved={authResolved}>
                  <CreditCard currentUser={currentUser} />
                </ProtectedRoute>
              }
            />
            <Route path="/about" element={<About />} />
            <Route
              path="/login"
              element={<LoginRoute currentUser={currentUser} authResolved={authResolved} />}
            />
            <Route path="/profile" element={<ProtectedRoute currentUser={currentUser} authResolved={authResolved}><Profile currentUser={currentUser} onLogout={handleLogout} /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
