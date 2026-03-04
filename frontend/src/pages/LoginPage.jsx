import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

export default function LoginPage({ onLogin, onSwitchToRegister }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const res = await axios.post('/login', { email, password });
            if (res.data.token) {
                localStorage.setItem('token', res.data.token);
            }
            toast.success(`Welcome back!`);
            onLogin({ email: res.data.email, role: res.data.role });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Login failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-wrap">
            <div className="card login-card">
                <div className="card-body">
                    <h1 className="login-heading">Sign in</h1>
                    <p className="login-sub">Access your StreamVault course library.</p>

                    <form onSubmit={handleLogin}>
                        <div className="field">
                            <label htmlFor="login-email">Email</label>
                            <input
                                id="login-email"
                                className="input"
                                type="email"
                                autoComplete="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="login-password">Password</label>
                            <input
                                id="login-password"
                                className="input"
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            className="btn btn-primary"
                            type="submit"
                            disabled={loading}
                            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
                        >
                            {loading ? 'Signing in…' : 'Sign in'}
                        </button>
                    </form>

                    <div className="hint-row">
                        Don't have an account?{' '}
                        <button className="btn-link" onClick={onSwitchToRegister}>Create one</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
