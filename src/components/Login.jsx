import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { getGoogleLoginUrl } from '../lib/authApi';

function Login() {
  const location = useLocation();
  const fromLocation = location.state?.from;
  const redirectTo = fromLocation
    ? `${fromLocation.pathname || '/'}${fromLocation.search || ''}${fromLocation.hash || ''}`
    : '/';
  const oauthErrorCode = new URLSearchParams(location.search).get('oauthError');
  const oauthError = useMemo(() => {
    if (!oauthErrorCode) {
      return '';
    }
    switch (oauthErrorCode) {
      case 'not_configured':
        return 'Google sign-in is not configured.';
      case 'invalid_state':
      case 'missing_code_or_state':
        return 'Google sign-in session expired. Try again.';
      default:
        return 'Google sign-in failed. Please try again.';
    }
  }, [oauthErrorCode]);

  return (
    <div className="page-container">
      <h2>Login</h2>
      <p>Sign in with your Google account to continue.</p>
      {oauthError ? <p className="auth-error oauth-error">{oauthError}</p> : null}
      <div className="auth-form">
        <a className="oauth-button" href={getGoogleLoginUrl(redirectTo, window.location.origin)}>
          Continue with Google
        </a>
      </div>
    </div>
  );
}

export default Login;
