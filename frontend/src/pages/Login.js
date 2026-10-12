import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').replace(/\/+$/, '') + '/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [filling, setFilling] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) navigate('/');
      else setError(result.error);
    } finally { setIsLoading(false); }
  };

  const fillDemoCredentials = async () => {
    setFilling(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/auth/demo-credentials`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Demo credentials are unavailable in this local setup.');
      const credentials = await response.json();
      if (!credentials.email || !credentials.password) throw new Error('Demo credentials are unavailable in this local setup.');
      setEmail(credentials.email);
      setPassword(credentials.password);
    } catch (failure) { setError(failure.message); }
    finally { setFilling(false); }
  };

  return <div className="login-container"><div className="login-card">
    <h1>AI Pricing Optimizer</h1>
    <p className="subtitle">Smart pricing for e-commerce success</p>
    {error && <div className="error-message" role="alert">{error}</div>}
    <form onSubmit={handleSubmit}>
      <div className="form-group"><label htmlFor="login-email">Email</label><input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your email" required /></div>
      <div className="form-group"><label htmlFor="login-password">Password</label><input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /></div>
      <button type="submit" className="btn btn-primary" disabled={isLoading || filling}>{isLoading ? 'Signing in...' : 'Sign In'}</button>
    </form>
    <button type="button" className="btn btn-secondary" disabled={isLoading || filling} onClick={fillDemoCredentials}>{filling ? 'Filling…' : 'Fill demo credentials'}</button>
  </div></div>;
}
