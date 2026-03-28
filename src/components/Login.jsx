import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:3001';

function Login({ onLogin }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const redirectTo = location.state?.from?.pathname || '/profile';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${AUTH_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || 'Login failed');
        return;
      }

      onLogin(payload.username);
      navigate(redirectTo, { replace: true });
    } catch {
      setError('Unable to reach auth server');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <h2>Login</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
          className="auth-input"
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          className="auth-input"
        />

        {error ? <p className="auth-error">{error}</p> : null}

        <button type="submit" className="add-button auth-submit" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}

export default Login;
