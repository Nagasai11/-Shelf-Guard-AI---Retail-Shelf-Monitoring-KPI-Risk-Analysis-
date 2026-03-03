import { useState } from 'react';
import { ShieldCheck, LogIn, UserPlus, Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import './LoginPage.css';

export default function LoginPage({ onLogin }) {
    const [mode, setMode] = useState('login'); // login | register
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('manager');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await onLogin(mode, { username, email, password, role });
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-bg-orb orb-a" />
            <div className="login-bg-orb orb-b" />

            <div className="login-card glass-card">
                <div className="login-header">
                    <div className="login-logo">
                        <ShieldCheck size={32} />
                    </div>
                    <h2>ShelfGuard<span className="logo-ai">AI</span></h2>
                    <p>Retail Shelf Monitoring & KPI Risk Analysis</p>
                </div>

                <div className="login-tabs">
                    <button
                        className={`login-tab ${mode === 'login' ? 'active' : ''}`}
                        onClick={() => { setMode('login'); setError(''); }}
                    >
                        <LogIn size={14} /> Sign In
                    </button>
                    <button
                        className={`login-tab ${mode === 'register' ? 'active' : ''}`}
                        onClick={() => { setMode('register'); setError(''); }}
                    >
                        <UserPlus size={14} /> Register
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label><User size={14} /> Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter username"
                            required
                            autoComplete="username"
                        />
                    </div>

                    {mode === 'register' && (
                        <div className="form-group">
                            <label><Mail size={14} /> Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter email"
                                required
                                autoComplete="email"
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label><Lock size={14} /> Password</label>
                        <div className="password-input">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                required
                                minLength={6}
                                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                            />
                            <button type="button" className="toggle-pwd" onClick={() => setShowPassword(!showPassword)}>
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {mode === 'register' && (
                        <div className="form-group">
                            <label>Role</label>
                            <select value={role} onChange={(e) => setRole(e.target.value)}>
                                <option value="manager">Manager</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                    )}

                    {error && <div className="login-error">{error}</div>}

                    <button type="submit" className="login-submit" disabled={loading}>
                        {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                    </button>
                </form>

                <p className="login-note">
                    🔒 Sign in required to access the system. Your data is private and isolated.
                </p>
            </div>
        </div>
    );
}
