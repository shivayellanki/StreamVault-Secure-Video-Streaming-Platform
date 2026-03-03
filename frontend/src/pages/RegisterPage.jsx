import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

export default function RegisterPage({ onSwitchToLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async (e) => {
        e.preventDefault();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            toast.error('Please enter a valid email address.');
            return;
        }
        if (password.length < 6) {
            toast.error('Password must be at least 6 characters.');
            return;
        }
        if (password !== confirm) {
            toast.error('Passwords do not match.');
            return;
        }

        try {
            setLoading(true);
            await axios.post('/register', { email, password });
            toast.success('Account created! You can now sign in.');
            onSwitchToLogin();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Registration failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-wrap">
            <div className="card login-card">
                <div className="card-body">
                    <h1 className="login-heading">Create account</h1>
                    <p className="login-sub">Join StreamVault to access premium courses.</p>

                    <form onSubmit={handleRegister}>
                        <div className="field">
                            <label htmlFor="reg-email">Email</label>
                            <input
                                id="reg-email"
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
                            <label htmlFor="reg-password">Password</label>
                            <input
                                id="reg-password"
                                className="input"
                                type="password"
                                autoComplete="new-password"
                                placeholder="Min. 6 characters"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="reg-confirm">Confirm password</label>
                            <input
                                id="reg-confirm"
                                className="input"
                                type="password"
                                autoComplete="new-password"
                                placeholder="Repeat your password"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            className="btn btn-primary"
                            type="submit"
                            disabled={loading}
                            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
                        >
                            {loading ? 'Creating account…' : 'Create account'}
                        </button>
                    </form>

                    <div className="hint-row">
                        Already have an account?{' '}
                        <button className="btn-link" onClick={onSwitchToLogin}>Sign in</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
