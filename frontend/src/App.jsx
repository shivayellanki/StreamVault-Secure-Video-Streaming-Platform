import React, { useState } from 'react';
import axios from 'axios';
import { Toaster, toast } from 'react-hot-toast';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CourseCatalog from './pages/CourseCatalog';
import AdminDashboard from './pages/AdminDashboard';
import './index.css';

// In dev: Vite proxy handles relative paths → localhost:8000
// In production: VITE_API_URL points to the Render backend
axios.defaults.baseURL = import.meta.env.VITE_API_URL || '';
axios.defaults.withCredentials = true;

// Screen enum
const SCREEN = { LOGIN: 'login', REGISTER: 'register' };

export default function App() {
  const [user, setUser] = useState(null);   // { email, role }
  const [screen, setScreen] = useState(SCREEN.LOGIN);

  const handleLogin = (userData) => setUser(userData);

  const handleLogout = async () => {
    try { await axios.post('/logout'); } catch { /* ignore */ }
    document.cookie = 'token=; Max-Age=0; path=/;';
    setUser(null);
    setScreen(SCREEN.LOGIN);
    toast.success('Signed out');
  };

  return (
    <div className="layout">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e2024',
            color: '#e6e8eb',
            border: '1px solid #2d3035',
            fontSize: '0.85rem',
          },
        }}
      />

      {/* ── Topbar ── */}
      <header className="topbar">
        <div className="topbar-brand">
          <span className="dot" />
          StreamVault
        </div>

        {user && (
          <div className="topbar-right">
            <div className="user-badge">
              <span className="indicator" />
              {user.email}
              {user.role === 'admin' && (
                <span className="tag blue" style={{ marginLeft: '0.25rem' }}>admin</span>
              )}
            </div>
            <button className="btn btn-ghost" onClick={handleLogout}>Sign out</button>
          </div>
        )}
      </header>

      {/* ── Content ── */}
      {!user ? (
        screen === SCREEN.LOGIN ? (
          <LoginPage
            onLogin={handleLogin}
            onSwitchToRegister={() => setScreen(SCREEN.REGISTER)}
          />
        ) : (
          <RegisterPage
            onSwitchToLogin={() => setScreen(SCREEN.LOGIN)}
          />
        )
      ) : (
        <div className="main-wrap">
          {user.role === 'admin' ? (
            <AdminDashboard />
          ) : (
            <CourseCatalog userEmail={user.email} />
          )}
        </div>
      )}
    </div>
  );
}
