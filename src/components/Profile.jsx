import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:3001';

function Profile({ currentUser, onLogout }) {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${AUTH_API_URL}/api/auth/update-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser,
          currentPassword,
          newPassword
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || 'Password update failed');
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setSuccessMessage('Password updated successfully');
    } catch {
      setError('Unable to reach auth server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="page-container">
      <h2>Profile</h2>
      <p>Logged in as <strong>{currentUser}</strong>.</p>

      <form onSubmit={handlePasswordChange} className="auth-form">
        <label htmlFor="currentPassword">Current Password</label>
        <input
          id="currentPassword"
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
          className="auth-input"
        />

        <label htmlFor="newPassword">New Password</label>
        <input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
          className="auth-input"
        />

        {error ? <p className="auth-error">{error}</p> : null}
        {successMessage ? <p className="auth-success">{successMessage}</p> : null}

        <button type="submit" className="add-button auth-submit" disabled={isSubmitting}>
          {isSubmitting ? 'Updating...' : 'Update Password'}
        </button>
      </form>

      <button type="button" className="logout-button" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}

export default Profile;
