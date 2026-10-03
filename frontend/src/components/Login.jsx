import React, { useState } from 'react';
import { ORG } from '../utils/helpers';
import api from '../services/api';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const u = username.trim();
    const p = password;
    if (!u || !p) {
      setError('Enter your username and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.login(u, p);
      if (res && res.user) {
        onLoginSuccess(res.user);
      }
    } catch (err) {
      setError(err.message || 'Incorrect username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={handleSubmit} noValidate>
        <div className="brandrow">
          <div className="logo-mark">
            {ORG.logoUrl ? <img src={ORG.logoUrl} alt="" /> : <span>{ORG.initials}</span>}
          </div>
          <div>
            <b>{ORG.name}</b>
            <span>Admin Portal</span>
          </div>
        </div>

        <h1>Sign in</h1>
        <p>Use your counsellor account to manage enquiries.</p>

        <div className="fld" style={{ marginBottom: '14px' }}>
          <label htmlFor="lu">Username</label>
          <input
            className="input"
            id="lu"
            type="text"
            autoComplete="username"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="fld">
          <label htmlFor="lp">Password</label>
          <input
            className="input"
            id="lp"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="form-error" role="alert">
          {error}
        </div>

        <button
          className="btn primary"
          style={{ width: '100%' }}
          type="submit"
          disabled={loading}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

      </form>
    </div>
  );
}
