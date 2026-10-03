import React from 'react';
import Login from '../components/Login';

export default function LoginPage({ onLoginSuccess }) {
  return <Login onLoginSuccess={onLoginSuccess} />;
}
