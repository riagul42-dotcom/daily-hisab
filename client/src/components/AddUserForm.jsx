import { useState } from 'react';
import { api } from '../api.js';

const ALL_ROLES = [
  ['manager', 'ম্যানেজার'],
  ['employee', 'কর্মচারী'],
  ['family', 'পারিবারিক ব্যবহারকারী'],
  ['superadmin', 'সুপার অ্যাডমিন'],
];

const LIMITED_ROLES = [
  ['family', 'পারিবারিক ব্যবহারকারী'],
  ['employee', 'কর্মচারী'],
];

export default function AddUserForm({ canAssignRoles = false, onSaved, onCancel }) {
  const roleOptions = canAssignRoles ? ALL_ROLES : LIMITED_ROLES;
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '',
    role: canAssignRoles ? 'employee' : 'family',
    account_type: canAssignRoles ? 'business' : 'family',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'role' && value === 'family') next.account_type = 'family';
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/users', { method: 'POST', body: JSON.stringify(form) });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      {error && <div className="alert error" style={{ gridColumn: '1 / -1' }}>{error}</div>}
      <label className="field">
        <span>নাম *</span>
        <input value={form.name} onChange={set('name')} required minLength={2} />
      </label>
      <label className="field">
        <span>ইমেইল *</span>
        <input type="email" value={form.email} onChange={set('email')} required />
      </label>
      <label className="field">
        <span>মোবাইল (ঐচ্ছিক)</span>
        <input value={form.phone} onChange={set('phone')} placeholder="01XXXXXXXXX" />
      </label>
      <label className="field">
        <span>পাসওয়ার্ড *</span>
        <input type="password" value={form.password} onChange={set('password')} required minLength={8} />
      </label>
      <label className="field">
        <span>ভূমিকা</span>
        <select value={form.role} onChange={set('role')}>
          {roleOptions.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </label>
      <label className="field">
        <span>অ্যাকাউন্টের ধরন</span>
        <select value={form.account_type} onChange={set('account_type')} disabled={form.role === 'family'}>
          <option value="business">ব্যবসায়িক</option>
          <option value="family">পারিবারিক</option>
        </select>
      </label>
      <div className="form-actions span-2">
        <button type="button" className="btn ghost" onClick={onCancel}>বাতিল</button>
        <button className="btn primary" disabled={busy}>{busy ? 'তৈরি হচ্ছে…' : 'অ্যাকাউন্ট তৈরি করুন'}</button>
      </div>
    </form>
  );
}
