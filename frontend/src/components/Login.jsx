import React, { useState } from 'react';
import { ORG } from '../utils/helpers';
import api from '../services/api';
import Icon from './Icons';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              className="input"
              id="lp"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%', paddingRight: '42px' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted, #64748b)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                borderRadius: '6px',
                transition: 'color 0.15s ease'
              }}
            >
              <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
            </button>
          </div>
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
