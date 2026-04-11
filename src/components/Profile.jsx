import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updatePasswordRequest } from '../lib/authApi';

const MIN_PASSWORD_LENGTH = 8;

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

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      setIsSubmitting(false);
      return;
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from current password');
      setIsSubmitting(false);
      return;
    }

    try {
      await updatePasswordRequest({
        currentPassword,
        newPassword
      });
      setCurrentPassword('');
      setNewPassword('');
      setSuccessMessage('Password updated successfully');
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : 'Password update failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await onLogout();
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
