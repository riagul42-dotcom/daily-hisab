import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Modal from '../components/Modal.jsx';
import { Icon } from '../components/Icons.jsx';
import { CATEGORIES, SCOPE_LABELS, UNITS } from '../constants.js';
import { bnDigits, firstOfMonthISO, fmtDate, fmtQty, fmtTK, todayISO } from '../format.js';

function ItemNameInput({ value, onChange, options, required = false }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const query = value.trim().toLowerCase();
  const matches = (query
    ? options.filter((name) => name.toLowerCase().includes(query))
    : options
  ).slice(0, 8);
  const highlighted = active >= 0 ? active : 0;

  const pick = (name) => {
    onChange(name);
    setOpen(false);
    setActive(-1);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(matches.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter' && open && matches.length > 0) {
      event.preventDefault();
      pick(matches[highlighted]);
    }
  };

  return (
    <div className="suggest-wrap">
      <input
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder="যেমন: আলু, চাল, মাছ"
        autoComplete="off"
        required={required}
      />
      {open && matches.length > 0 && (
        <div className="suggest-box" role="listbox">
          {matches.map((name, index) => (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={index === highlighted}
              className={`suggest-item ${index === highlighted ? 'active' : ''}`}
              onMouseDown={(event) => {
                event.preventDefault();
                pick(name);
              }}
              onMouseEnter={() => setActive(index)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const emptyRow = () => ({
  item_name: '',
  category: 'বাজার/মুদি',
  quantity: 1,
  unit: 'কেজি',
  unit_price: '',
});

function ExpenseForm({ initial, onSaved, onCancel }) {
  const { user } = useAuth();
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState(() => ({
    item_name: initial?.item_name || '',
    category: initial?.category || 'বাজার/মুদি',
    quantity: initial?.quantity ?? 1,
    unit: initial?.unit || 'কেজি',
    unit_price: initial?.unit_price ?? '',
    expense_date: initial?.expense_date || todayISO(),
    scope: initial?.scope || (user?.role === 'family' ? 'family' : user?.account_type || 'family'),
    note: initial?.note || '',
  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [itemNames, setItemNames] = useState([]);
  const [bulk, setBulk] = useState(false);
  const [rows, setRows] = useState(() => [emptyRow()]);
  const canAssign = !isEdit && (user?.role === 'superadmin' || user?.role === 'manager');
  const [people, setPeople] = useState([]);
  const [ownerId, setOwnerId] = useState('');

  useEffect(() => {
    api('/expenses/items')
      .then((d) => setItemNames(d.items || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!canAssign) return;
    api('/users/options')
      .then((d) => setPeople(d.users || []))
      .catch(() => {});
  }, [canAssign]);

  const allowBulk = !isEdit;
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setValue = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const total = (Number(form.quantity) || 0) * (Number(form.unit_price) || 0);

  const updateRow = (index, key) => (e) => {
    const value = e.target.value;
    setRows((list) => list.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };
  const updateRowValue = (index, key) => (value) => {
    setRows((list) => list.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };
  const addRow = () => setRows((list) => [...list, emptyRow()]);
  const removeRow = (index) => {
    setRows((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
  };
  const bulkTotal = rows.reduce(
    (sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.unit_price) || 0),
    0
  );

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (bulk) {
      const invalid = rows.findIndex(
        (row) => !String(row.item_name).trim() || !(Number(row.quantity) > 0) || !(Number(row.unit_price) >= 0)
      );
      if (invalid !== -1) {
        setError(`সারি ${invalid + 1}: পণ্যের নাম, পরিমাণ ও একক মূল্য সঠিকভাবে দিন`);
        return;
      }
    }
    setBusy(true);
    try {
      const assignee = canAssign && ownerId ? { user_id: Number(ownerId) } : {};
      if (bulk) {
        const items = rows.map((row) => ({
          item_name: String(row.item_name).trim(),
          category: row.category,
          quantity: Number(row.quantity),
          unit: row.unit,
          unit_price: Number(row.unit_price) || 0,
          expense_date: form.expense_date,
          scope: form.scope,
          note: form.note,
        }));
        await api('/expenses/bulk', { method: 'POST', body: JSON.stringify({ items, ...assignee }) });
      } else {
        const payload = {
          ...form,
          ...assignee,
          quantity: Number(form.quantity),
          unit_price: Number(form.unit_price),
        };
        if (isEdit) {
          await api(`/expenses/${initial.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
          await api('/expenses', { method: 'POST', body: JSON.stringify(payload) });
        }
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

      {allowBulk && (
        <div className="mode-switch span-2">
          <button type="button" className={!bulk ? 'active' : ''} onClick={() => setBulk(false)}>
            একটি হিসাব
          </button>
          <button type="button" className={bulk ? 'active' : ''} onClick={() => setBulk(true)}>
            একসাথে অনেক হিসাব
          </button>
        </div>
      )}

      {canAssign && (
        <label className="field">
          <span>কে হিসাব দিচ্ছেন</span>
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            <option value="">আমি (নিজের নামে)</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      )}

      {bulk ? (
        <>
          <label className="field">
            <span>তারিখ *</span>
            <input type="date" value={form.expense_date} onChange={set('expense_date')} required />
          </label>

          <label className="field">
            <span>ধরন</span>
            <select value={form.scope} onChange={set('scope')} disabled={user?.role === 'family'}>
              <option value="family">পারিবারিক</option>
              <option value="business">ব্যবসায়িক</option>
            </select>
          </label>

          <div className="bulk-rows span-2">
            {rows.map((row, index) => {
              const rowTotal = (Number(row.quantity) || 0) * (Number(row.unit_price) || 0);
              return (
                <div className="bulk-row" key={index}>
                  <label className="field">
                    <span>পণ্যের নাম *</span>
                    <ItemNameInput
                      value={row.item_name}
                      onChange={updateRowValue(index, 'item_name')}
                      options={itemNames}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>ক্যাটাগরি</span>
                    <select value={row.category} onChange={updateRow(index, 'category')}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>পরিমাণ</span>
                    <input type="number" min="0.01" step="0.01" value={row.quantity} onChange={updateRow(index, 'quantity')} required />
                  </label>
                  <label className="field">
                    <span>একক</span>
                    <select value={row.unit} onChange={updateRow(index, 'unit')}>
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>একক মূল্য (৳)</span>
                    <input type="number" min="0" step="0.01" value={row.unit_price} onChange={updateRow(index, 'unit_price')} placeholder="০.০০" required />
                  </label>
                  <div className="row-total">
                    <span>মোট</span>
                    <strong>{fmtTK(rowTotal)}</strong>
                    <button
                      type="button"
                      className="icon-btn danger"
                      title="সারি মুছুন"
                      disabled={rows.length === 1}
                      onClick={() => removeRow(index)}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bulk-toolbar span-2">
            <button type="button" className="btn ghost" onClick={addRow}>
              <Icon name="plus" size={16} /> আরও হিসাব যোগ করুন
            </button>
            <div className="total-preview compact">
              <span>সব মিলিয়ে মোট</span>
              <div className="total-value">{fmtTK(bulkTotal)}</div>
            </div>
          </div>

          <label className="field span-2">
            <span>নোট (ঐচ্ছিক)</span>
            <textarea rows={2} value={form.note} onChange={set('note')} placeholder="অতিরিক্ত তথ্য (সব সারিতে প্রযোজ্য)" />
          </label>
        </>
      ) : (
        <>
          <label className="field span-2">
            <span>পণ্যের নাম *</span>
            <ItemNameInput value={form.item_name} onChange={setValue('item_name')} options={itemNames} required />
          </label>

          <label className="field">
            <span>ক্যাটাগরি</span>
            <select value={form.category} onChange={set('category')}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
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
            <span>পরিমাণ *</span>
            <input type="number" min="0.01" step="0.01" value={form.quantity} onChange={set('quantity')} required />
          </label>

          <label className="field">
            <span>একক</span>
            <select value={form.unit} onChange={set('unit')}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>

          <label className="field">
            <span>একক মূল্য (৳) *</span>
            <input type="number" min="0" step="0.01" value={form.unit_price} onChange={set('unit_price')} placeholder="০.০০" required />
          </label>

          <label className="field">
            <span>তারিখ *</span>
            <input type="date" value={form.expense_date} onChange={set('expense_date')} required />
          </label>

          <div className="field total-preview">
            <span>মোট</span>
            <div className="total-value">{fmtTK(total)}</div>
          </div>

          <label className="field span-2">
            <span>নোট (ঐচ্ছিক)</span>
            <textarea rows={2} value={form.note} onChange={set('note')} placeholder="অতিরিক্ত তথ্য" />
          </label>
        </>
      )}

      <div className="form-actions span-2">
        <button type="button" className="btn ghost" onClick={onCancel}>বাতিল</button>
        <button className="btn primary" disabled={busy}>
          {busy
            ? 'সংরক্ষণ হচ্ছে…'
            : isEdit
              ? 'আপডেট করুন'
              : bulk && rows.length > 1
                ? `${bnDigits(rows.length)}টি হিসাব সংরক্ষণ করুন`
                : 'সংরক্ষণ করুন'}
        </button>
      </div>
    </form>
  );
}

export default function Expenses() {
  const { user } = useAuth();
  const canManageAll = user?.role === 'superadmin' || user?.role === 'manager';
  const [filters, setFilters] = useState({ from: firstOfMonthISO(), to: todayISO(), scope: '' });
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ expenses: [], total: 0, sum: 0 });
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
      const d = await api(`/expenses?${params.toString()}`);
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

  const remove = async (expense) => {
    if (!window.confirm(`"${expense.item_name}" রেকর্ডটি মুছে ফেলবেন?`)) return;
    try {
      await api(`/expenses/${expense.id}`, { method: 'DELETE' });
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
          <h2 className="welcome">খরচের তালিকা</h2>
          <p className="muted">
            মোট {fmtTK(data.sum)} · {bnDigits(data.total)} টি রেকর্ড
          </p>
        </div>
        <button className="btn primary sm" onClick={() => setModal('new')}>
          <Icon name="plus" size={16} /> নতুন খরচ
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
                placeholder="পণ্য, ক্যাটাগরি বা নোট"
              />
            </div>
          </label>
          <button className="btn ghost" type="submit">খুঁজুন</button>
        </form>

        {loading ? (
          <div className="empty">লোড হচ্ছে…</div>
        ) : data.expenses.length === 0 ? (
          <div className="empty">এই ফিল্টারে কোনো রেকর্ড পাওয়া যায়নি</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>তারিখ</th>
                  <th>পণ্য</th>
                  <th>ক্যাটাগরি</th>
                  <th className="right">পরিমাণ</th>
                  <th className="right">একক মূল্য</th>
                  <th className="right">মোট</th>
                  <th>ব্যবহারকারী</th>
                  <th className="right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {data.expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="nowrap">{fmtDate(e.expense_date)}</td>
                    <td>
                      {e.item_name}
                      <span className={`badge ${e.scope}`}>{SCOPE_LABELS[e.scope]}</span>
                      {e.note && <div className="note">{e.note}</div>}
                    </td>
                    <td className="muted">{e.category}</td>
                    <td className="right nowrap">{fmtQty(e.quantity)} {e.unit}</td>
                    <td className="right nowrap">{fmtTK(e.unit_price)}</td>
                    <td className="right strong nowrap">{fmtTK(e.total)}</td>
                    <td className="muted nowrap">{e.user_name}</td>
                    <td className="right">
                      {(canManageAll || e.user_id === user?.id) && (
                        <div className="row-actions">
                          <button className="icon-btn" onClick={() => setModal(e)} title="সম্পাদনা">
                            <Icon name="edit" size={17} />
                          </button>
                          <button className="icon-btn danger" onClick={() => remove(e)} title="মুছুন">
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
          title={modal === 'new' ? 'নতুন খরচ যোগ করুন' : 'খরচ সম্পাদনা'}
          onClose={() => setModal(null)}
          wide
        >
          <ExpenseForm
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
