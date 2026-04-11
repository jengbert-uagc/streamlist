import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loginRequest } from '../lib/authApi';

const MIN_PASSWORD_LENGTH = 8;

function Login({ onLogin }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fromLocation = location.state?.from;
  const redirectTo = fromLocation
    ? `${fromLocation.pathname || '/'}${fromLocation.search || ''}${fromLocation.hash || ''}`
    : '/';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      setError('Username and password are required');
      setIsSubmitting(false);
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = await loginRequest({ username: normalizedUsername, password });
      onLogin(payload.username);
      navigate(redirectTo, { replace: true });
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : 'Login failed');
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
