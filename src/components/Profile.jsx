import React from 'react';
import { useNavigate } from 'react-router-dom';

function Profile({ currentUser, onLogout }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await onLogout();
    navigate('/login');
  };

  return (
    <div className="page-container">
      <h2>Profile</h2>
      <p>Logged in as <strong>{currentUser}</strong>.</p>
      <p>This account is managed through Google OAuth.</p>

      <button type="button" className="logout-button" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}

export default Profile;
