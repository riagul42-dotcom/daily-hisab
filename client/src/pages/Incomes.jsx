import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Modal from '../components/Modal.jsx';
import { Icon } from '../components/Icons.jsx';
import { INCOME_CATEGORIES, SCOPE_LABELS } from '../constants.js';
import { bnDigits, firstOfMonthISO, fmtDate, fmtTK, todayISO } from '../format.js';

function IncomeForm({ initial, onSaved, onCancel }) {
  const { user } = useAuth();
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState(() => ({
    source: initial?.source || '',
    category: initial?.category || 'বেতন',
    amount: initial?.amount ?? '',
    income_date: initial?.income_date || todayISO(),
    scope: initial?.scope || (user?.role === 'family' ? 'family' : user?.account_type || 'family'),
    note: initial?.note || '',
  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canAssign = user?.role === 'superadmin' || user?.role === 'manager';
  const [people, setPeople] = useState([]);
  const [ownerId, setOwnerId] = useState(initial?.user_id ? String(initial.user_id) : '');

  useEffect(() => {
    if (!canAssign) return;
    api('/users/options')
      .then((d) => setPeople(d.users || []))
      .catch(() => {});
  }, [canAssign]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        ...(canAssign && ownerId ? { user_id: Number(ownerId) } : {}),
      };
      if (isEdit) {
        await api(`/incomes/${initial.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api('/incomes', { method: 'POST', body: JSON.stringify(payload) });
      }
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

      <label className="field span-2">
        <span>আয়ের উৎস *</span>
        <input
          value={form.source}
          onChange={set('source')}
          placeholder="যেমন: মাসিক বেতন, দোকানের বিক্রয়"
          required
        />
      </label>

      {canAssign && (
        <label className="field">
          <span>কার নামে</span>
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            <option value="">আমি (নিজের নামে)</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      )}

      <label className="field">
        <span>ক্যাটাগরি</span>
        <select value={form.category} onChange={set('category')}>
          {INCOME_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>

      <label className="field">
        <span>ধরন</span>
        <select value={form.scope} onChange={set('scope')} disabled={user?.role === 'family'}>
          <option value="family">পারিবারিক</option>
          <option value="business">ব্যবসায়িক</option>
        </select>
      </label>

      <label className="field">
        <span>টাকার পরিমাণ (৳) *</span>
        <input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} placeholder="০.০০" required />
      </label>

      <label className="field">
        <span>তারিখ *</span>
        <input type="date" value={form.income_date} onChange={set('income_date')} required />
      </label>

      <label className="field span-2">
        <span>নোট (ঐচ্ছিক)</span>
        <textarea rows={2} value={form.note} onChange={set('note')} placeholder="অতিরিক্ত তথ্য" />
      </label>

      <div className="form-actions span-2">
        <button type="button" className="btn ghost" onClick={onCancel}>বাতিল</button>
        <button className="btn primary" disabled={busy}>
          {busy ? 'সংরক্ষণ হচ্ছে…' : isEdit ? 'আপডেট করুন' : 'সংরক্ষণ করুন'}
        </button>
      </div>
    </form>
  );
}

export default function Incomes() {
  const { user } = useAuth();
  const canManageAll = user?.role === 'superadmin' || user?.role === 'manager';
  const [filters, setFilters] = useState({ from: firstOfMonthISO(), to: todayISO(), scope: '' });
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ incomes: [], total: 0, sum: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const limit = 15;

  useEffect(() => {
    const bump = () => {
      if (document.visibilityState === 'visible') setRefreshTick((t) => t + 1);
    };
    document.addEventListener('visibilitychange', bump);
    window.addEventListener('focus', bump);
    return () => {
      document.removeEventListener('visibilitychange', bump);
      window.removeEventListener('focus', bump);
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        from: filters.from,
        to: filters.to,
        page: String(page),
        limit: String(limit),
      });
      if (filters.scope) params.set('scope', filters.scope);
      if (query) params.set('q', query);
      const d = await api(`/incomes?${params.toString()}`);
      setData(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters.from, filters.to, filters.scope, query, page, refreshTick]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(data.total / limit));

  const applySearch = (e) => {
    e.preventDefault();
    setPage(1);
    setQuery(search.trim());
  };

  const remove = async (income) => {
    if (!window.confirm(`"${income.source}" রেকর্ডটি মুছে ফেলবেন?`)) return;
    try {
      await api(`/incomes/${income.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const setFilter = (key) => (e) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: e.target.value }));
  };

  return (
    <div className="page">
      {error && <div className="alert error">{error}</div>}

      <div className="page-row">
        <div>
          <h2 className="welcome">আয়ের তালিকা</h2>
          <p className="muted">
            মোট {fmtTK(data.sum)} · {bnDigits(data.total)} টি রেকর্ড
          </p>
        </div>
        <button className="btn primary" onClick={() => setModal('new')}>
          <Icon name="plus" size={18} /> নতুন আয়
        </button>
      </div>

      <div className="card">
        <form className="filter-bar" onSubmit={applySearch}>
          <label className="field compact">
            <span>শুরুর তারিখ</span>
            <input type="date" value={filters.from} onChange={setFilter('from')} />
          </label>
          <label className="field compact">
            <span>শেষ তারিখ</span>
            <input type="date" value={filters.to} onChange={setFilter('to')} />
          </label>
          <label className="field compact">
            <span>ধরন</span>
            <select value={filters.scope} onChange={setFilter('scope')}>
              <option value="">সব</option>
              <option value="family">পারিবারিক</option>
              <option value="business">ব্যবসায়িক</option>
            </select>
          </label>
          <label className="field compact grow">
            <span>খুঁজুন</span>
            <div className="search-box">
              <Icon name="search" size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="উৎস, ক্যাটাগরি বা নোট"
              />
            </div>
          </label>
          <button className="btn ghost" type="submit">খুঁজুন</button>
        </form>

        {loading ? (
          <div className="empty">লোড হচ্ছে…</div>
        ) : data.incomes.length === 0 ? (
          <div className="empty">এই ফিল্টারে কোনো আয় পাওয়া যায়নি</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>তারিখ</th>
                  <th>উৎস</th>
                  <th>ক্যাটাগরি</th>
                  <th className="right">টাকা</th>
                  <th>ব্যবহারকারী</th>
                  <th className="right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {data.incomes.map((item) => (
                  <tr key={item.id}>
                    <td className="nowrap">{fmtDate(item.income_date)}</td>
                    <td>
                      {item.source}
                      <span className={`badge ${item.scope}`}>{SCOPE_LABELS[item.scope]}</span>
                      {item.note && <div className="note">{item.note}</div>}
                    </td>
                    <td className="muted">{item.category}</td>
                    <td className="right strong nowrap">{fmtTK(item.amount)}</td>
                    <td className="muted nowrap">{item.user_name}</td>
                    <td className="right">
                      {(canManageAll || item.user_id === user?.id) && (
                        <div className="row-actions">
                          <button className="icon-btn" onClick={() => setModal(item)} title="সম্পাদনা">
                            <Icon name="edit" size={17} />
                          </button>
                          <button className="icon-btn danger" onClick={() => remove(item)} title="মুছুন">
                            <Icon name="trash" size={17} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pager">
          <button className="btn ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            পূর্ববর্তী
          </button>
          <span className="muted">পৃষ্ঠা {bnDigits(page)} / {bnDigits(pages)}</span>
          <button className="btn ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            পরবর্তী
          </button>
        </div>
      </div>

      {modal && (
        <Modal
          title={modal === 'new' ? 'নতুন আয় যোগ করুন' : 'আয় সম্পাদনা'}
          onClose={() => setModal(null)}
        >
          <IncomeForm
            initial={modal === 'new' ? null : modal}
            onCancel={() => setModal(null)}
            onSaved={() => {
              setModal(null);
              load();
            }}
          />
        </Modal>
      )}
    </div>
  );
}