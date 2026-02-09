import React, { useState } from 'react';
import { FiShield, FiUser, FiLock, FiCheckCircle } from 'react-icons/fi';
import { authAPI } from '../../../utils/api';
import './Setup.css';

const Setup = ({ onComplete }) => {
    const [setupData, setSetupData] = useState({
        username: '',
        password: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [needsUsername, setNeedsUsername] = useState(true);
    const [defaultUsername, setDefaultUsername] = useState('admin');

    // Check what setup is needed
    React.useEffect(() => {
        const checkSetup = async () => {
            try {
                const response = await authAPI.checkSetup();
                const data = response.data;

                if (!data.setup_required) {
                    // Setup not needed, redirect to login
                    onComplete();
                    return;
                }

                setNeedsUsername(data.needs_username);
                setDefaultUsername(data.default_username || 'admin');

                // Pre-fill username if provided via env
                if (!data.needs_username) {
                    setSetupData(prev => ({ ...prev, username: data.default_username }));
                }
            } catch (err) {
                setError('Failed to check setup status');
            }
        };

        checkSetup();
    }, [onComplete]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validate passwords match
        if (setupData.password !== setupData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        // Validate password length
        if (setupData.password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        // Validate username if needed
        if (needsUsername && setupData.username.length < 3) {
            setError('Username must be at least 3 characters');
            return;
        }

        setLoading(true);

        try {
            const response = await authAPI.completeSetup({
                username: needsUsername ? setupData.username : null,
                password: setupData.password,
                confirm_password: setupData.confirmPassword
            });

            const data = response.data;

            if (!data.success) {
                throw new Error(data.message || 'Setup failed');
            }

            // Setup complete, trigger callback
            onComplete();
        } catch (err) {
            const errorMessage = err.response?.data?.detail?.message ||
                err.response?.data?.message ||
                err.message ||
                'Setup failed. Please try again.';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="setup-container">
            <div className="setup-card">
                <div className="setup-header">
                    <FiShield className="setup-icon" />
                    <h1>Welcome to Synology Reverse Proxy Manager</h1>
                    <p>Create your admin account to get started</p>
                </div>

                <form onSubmit={handleSubmit} className="setup-form">
                    {needsUsername ? (
                        <div className="form-group">
                            <label htmlFor="username">
                                <FiUser /> Username
                            </label>
                            <input
                                id="username"
                                type="text"
                                value={setupData.username}
                                onChange={(e) => setSetupData({ ...setupData, username: e.target.value })}
                                placeholder="Enter username (min 3 characters)"
                                required
                                minLength={3}
                                autoFocus
                            />
                        </div>
                    ) : (
                        <div className="form-group">
                            <label>
                                <FiUser /> Username
                            </label>
                            <input
                                type="text"
                                value={defaultUsername}
                                disabled
                                className="input-disabled"
                            />
                            <small className="help-text">Username set via environment variable</small>
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="password">
                            <FiLock /> Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={setupData.password}
                            onChange={(e) => setSetupData({ ...setupData, password: e.target.value })}
                            placeholder="Enter password (min 8 characters)"
                            required
                            minLength={8}
                            autoFocus={!needsUsername}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">
                            <FiCheckCircle /> Confirm Password
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={setupData.confirmPassword}
                            onChange={(e) => setSetupData({ ...setupData, confirmPassword: e.target.value })}
                            placeholder="Confirm your password"
                            required
                            minLength={8}
                        />
                    </div>

                    {error && (
                        <div className="setup-error">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="setup-button"
                        disabled={loading}
                    >
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>

                <div className="setup-footer">
                    <small>
                        This is a one-time setup. Your credentials will be securely stored.
                    </small>
                </div>
            </div>
        </div>
    );
};

export default Setup;
