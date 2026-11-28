import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import AddUserForm from '../components/AddUserForm.jsx';
import Modal from '../components/Modal.jsx';
import { Icon } from '../components/Icons.jsx';
import { ROLE_LABELS, SCOPE_LABELS } from '../constants.js';
import { bnDigits, fmtDate } from '../format.js';

const ROLE_OPTIONS = [
  ['manager', 'ম্যানেজার'],
  ['employee', 'কর্মচারী'],
  ['family', 'পারিবারিক ব্যবহারকারী'],
  ['superadmin', 'সুপার অ্যাডমিন'],
];

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api('/users');
      setUsers(d.users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (id, body, okMessage) => {
    setError('');
    try {
      await api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      if (okMessage) {
        setNotice(okMessage);
        setTimeout(() => setNotice(''), 3000);
      }
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const resetPassword = async (u) => {
    const pw = window.prompt(`"${u.name}"-এর জন্য নতুন পাসওয়ার্ড দিন (কমপক্ষে ৮ অক্ষর):`);
    if (!pw) return;
    if (pw.length < 8) {
      setError('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে');
      return;
    }
    await patch(u.id, { password: pw }, 'পাসওয়ার্ড পরিবর্তন হয়েছে');
  };

  return (
    <div className="page">
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      <div className="page-row">
        <div>
          <h2 className="welcome">ব্যবহারকারী ব্যবস্থাপনা</h2>
          <p className="muted">মোট {bnDigits(users.length)} জন ব্যবহারকারী</p>
        </div>
        <button className="btn primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> নতুন ব্যবহারকারী
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty">লোড হচ্ছে…</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>নাম</th>
                  <th>ইমেইল</th>
                  <th>ভূমিকা</th>
                  <th>ধরন</th>
                  <th>স্ট্যাটাস</th>
                  <th className="right">রেকর্ড</th>
                  <th>যোগদান</th>
                  <th className="right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === user?.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="user-cell">
                          <span className="avatar sm">{u.name.slice(0, 1)}</span>
                          <div>
                            <div className="strong">{u.name}</div>
                            {u.phone && <div className="note">{u.phone}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="muted">{u.email}</td>
                      <td>
                        <select
                          value={u.role}
                          disabled={isSelf}
                          onChange={(e) => patch(u.id, { role: e.target.value }, 'ভূমিকা পরিবর্তন হয়েছে')}
                        >
                          {ROLE_OPTIONS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                        </select>
                      </td>
                      <td className="muted">{SCOPE_LABELS[u.account_type]}</td>
                      <td>
                        <span className={`badge status ${u.status}`}>
                          {u.status === 'active' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                        </span>
                      </td>
                      <td className="right">{bnDigits(u.expense_count)}</td>
                      <td className="muted nowrap">{fmtDate(String(u.created_at).slice(0, 10))}</td>
                      <td className="right">
                        <div className="row-actions">
                          <button
                            className="icon-btn"
                            title="পাসওয়ার্ড রিসেট"
                            onClick={() => resetPassword(u)}
                          >
                            <Icon name="key" size={17} />
                          </button>
                          <button
                            className={`btn tiny ${u.status === 'active' ? 'danger-ghost' : 'success-ghost'}`}
                            disabled={isSelf}
                            onClick={() => patch(
                              u.id,
                              { status: u.status === 'active' ? 'inactive' : 'active' },
                              u.status === 'active' ? 'অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে' : 'অ্যাকাউন্ট সক্রিয় করা হয়েছে'
                            )}
                          >
                            {u.status === 'active' ? 'নিষ্ক্রিয়' : 'সক্রিয় করুন'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="hint-card">
        <strong>ভূমিকার অনুমতি:</strong> সুপার অ্যাডমিন — সবকিছু; ম্যানেজার — সবার খরচ ও রিপোর্ট;
        কর্মচারী — নিজের এন্ট্রি; পারিবারিক ব্যবহারকারী — শুধু নিজের পারিবারিক খরচ।
        <br />
        <strong>নতুন আইডি:</strong> শুধু সুপার অ্যাডমিন নতুন আইডি খুলতে পারবেন; অন্যান্য
        ব্যবহারকারী নিজে থেকে নিবন্ধন করতে পারবে না।
      </div>

      {adding && (
        <Modal title="নতুন ব্যবহারকারী" onClose={() => setAdding(false)}>
          <AddUserForm
            onCancel={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
              setNotice('নতুন ব্যবহারকারী তৈরি হয়েছে');
              setTimeout(() => setNotice(''), 3000);
              load();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
