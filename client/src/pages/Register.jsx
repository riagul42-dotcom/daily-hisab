import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে');
      return;
    }
    if (form.password !== form.confirm) {
      setError('পাসওয়ার্ড দুটি মিলছে না');
      return;
    }
    setBusy(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
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
        <p className="brand-tag">পরিবারের প্রতিটি টাকার হিসাব</p>
        <ul className="brand-points">
          <li>বিনামূল্যে পারিবারিক অ্যাকাউন্ট</li>
          <li>সহজ ফর্মে দ্রুত খরচ এন্ট্রি</li>
          <li>আপনার ডেটা নিরাপদ ক্লাউডে</li>
        </ul>
      </div>

      <div className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <h2>নতুন অ্যাকাউন্ট</h2>
          <p className="muted">পারিবারিক ব্যবহারকারী হিসেবে নিবন্ধন হবে</p>

          {error && <div className="alert error">{error}</div>}

          <label className="field">
            <span>নাম</span>
            <input value={form.name} onChange={set('name')} placeholder="আপনার নাম" required minLength={2} />
          </label>
          <label className="field">
            <span>ইমেইল</span>
            <input type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required />
          </label>
          <label className="field">
            <span>মোবাইল নম্বর (ঐচ্ছিক)</span>
            <input value={form.phone} onChange={set('phone')} placeholder="01XXXXXXXXX" />
          </label>
          <label className="field">
            <span>পাসওয়ার্ড</span>
            <input type="password" value={form.password} onChange={set('password')} placeholder="কমপক্ষে ৮ অক্ষর" required minLength={8} />
          </label>
          <label className="field">
            <span>পাসওয়ার্ড আবার</span>
            <input type="password" value={form.confirm} onChange={set('confirm')} placeholder="পাসওয়ার্ড নিশ্চিত করুন" required />
          </label>

          <button className="btn primary block" disabled={busy}>
            {busy ? 'অপেক্ষা করুন…' : 'নিবন্ধন করুন'}
          </button>

          <p className="switch">
            আগে থেকেই অ্যাকাউন্ট আছে? <Link to="/login">লগইন করুন</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
