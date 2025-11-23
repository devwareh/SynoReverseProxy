import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import Button from '../../common/Button/Button';
import Input from '../../common/Input/Input';
import Checkbox from '../../common/Checkbox/Checkbox';
import './Login.css';

const Login = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Focus username input on mount
    const usernameInput = document.getElementById('login-username');
    if (usernameInput) {
      usernameInput.focus();
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      setLoading(false);
      return;
    }

    try {
      const result = await login(username.trim(), password, rememberMe);
      
      if (!result.success) {
        setError(result.error || 'Login failed');
        setLoading(false);
      } else {
        // Login successful - AuthContext will update state
        // Component will re-render and redirect automatically
        setLoading(false);
      }
    } catch (err) {
      console.error('Login form error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Synology Reverse Proxy Manager</h1>
          <p>Please log in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="login-username">Username</label>
            <Input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              label="Remember me"
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="large"
            fullWidth
            disabled={loading}
            loading={loading}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;

