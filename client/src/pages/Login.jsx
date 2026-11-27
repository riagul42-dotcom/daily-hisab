import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Icon } from '../components/Icons.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-brand">
        <div className="brand-mark big">৳</div>
        <h1>Daily Hisab</h1>
        <p className="brand-tag">দৈনিক বাজার হিসাব</p>
        <ul className="brand-points">
          <li>পারিবারিক ও ব্যবসায়িক খরচ একসাথে</li>
          <li>দৈনিক, মাসিক ও বার্ষিক রিপোর্ট</li>
          <li>PDF ও Excel ডাউনলোড</li>
          <li>ভূমিকা-ভিত্তিক নিরাপদ লগইন</li>
        </ul>
      </div>

      <div className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <h2>লগইন করুন</h2>
          <p className="muted">আপনার অ্যাকাউন্টে প্রবেশ করুন</p>

          {error && <div className="alert error">{error}</div>}

          <label className="field">
            <span>ইমেইল</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label className="field">
            <span>পাসওয়ার্ড</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="আপনার পাসওয়ার্ড"
              autoComplete="current-password"
              required
            />
          </label>

          <button className="btn primary block" disabled={busy}>
            {busy ? 'অপেক্ষা করুন…' : 'লগইন'}
          </button>

          <p className="switch">
            নতুন আইডি দরকার? অ্যাডমিনের সাথে যোগাযোগ করুন
          </p>

          <a className="apk-note" href="/Daily-Hisab.apk" download>
            <Icon name="android" size={18} />
            <span>Android অ্যাপ ডাউনলোড (APK)</span>
          </a>
        </form>
      </div>
    </div>
  );
}
