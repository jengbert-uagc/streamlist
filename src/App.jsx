import React, { useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Navigation from './components/Navigation';
import StreamList from './components/StreamList';
import Movies from './components/Movies';
import Cart from './components/Cart';
import About from './components/About';
import Login from './components/Login';
import Profile from './components/Profile';
import './App.css';

const STORAGE_KEY = 'streamlist-user';

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
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem(STORAGE_KEY));

  const handleLogin = (username) => {
    localStorage.setItem(STORAGE_KEY, username);
    setCurrentUser(username);
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCurrentUser(null);
  };

  return (
    <Router>
      <div className="app-container">
        <Navigation currentUser={currentUser} />
        <main className="content">
          <Routes>
            <Route path="/" element={<ProtectedRoute currentUser={currentUser}><StreamList /></ProtectedRoute>} />
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
