import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import StatCard from '../components/StatCard.jsx';
import { SCOPE_LABELS } from '../constants.js';
import {
  bnDigits, firstOfMonthISO, fmtDate, fmtNum, fmtTK, monthShort, startOfYearISO, todayISO,
} from '../format.js';

const PIE_COLORS = ['#0e7a3f', '#16a34a', '#4ade80', '#86efac', '#0ea5e9', '#b7791f', '#d97706', '#f59e0b', '#94a3b8', '#64748b'];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="chart-tip">
      <div className="chart-tip-label">{label}</div>
      <div className="chart-tip-value">{fmtTK(payload[0].value)}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [scope, setScope] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [today, setToday] = useState({ total: 0, count: 0 });
  const [month, setMonth] = useState({ total: 0, count: 0, byCategory: [] });
  const [year, setYear] = useState({ total: 0, count: 0 });
  const [monthly, setMonthly] = useState([]);
  const [recent, setRecent] = useState([]);

  const scopeQuery = useMemo(
    () => (scope === 'all' ? '' : `scope=${scope}&`),
    [scope]
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const t = todayISO();
    Promise.all([
      api(`/reports/summary?${scopeQuery}from=${t}&to=${t}`),
      api(`/reports/summary?${scopeQuery}from=${firstOfMonthISO()}&to=${t}`),
      api(`/reports/summary?${scopeQuery}from=${startOfYearISO()}&to=${t}`),
      api(`/reports/monthly?months=12&${scopeQuery.replace(/&$/, '')}`),
      api(`/expenses?limit=8&${scopeQuery.replace(/&$/, '')}`),
    ])
      .then(([td, mo, yr, ml, rc]) => {
        if (!alive) return;
        setToday(td);
        setMonth(mo);
        setYear(yr);
        setMonthly(
          ml.months.map((m) => ({
            name: monthShort(m.month),
            total: Math.round(m.total),
            count: m.count,
          }))
        );
        setRecent(rc.expenses);
      })
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [scopeQuery]);

  const pieData = (month.byCategory || []).map((c) => ({ name: c.category, value: Math.round(c.total) }));
  const isFamily = user?.role === 'family';

  return (
    <div className="page">
      {error && <div className="alert error">{error}</div>}

      <div className="page-row">
        <div>
          <h2 className="welcome">স্বাগতম, {user?.name}</h2>
          <p className="muted">আপনার খরচের সারসংক্ষেপ এক নজরে</p>
        </div>
        {!isFamily && (
          <div className="seg">
            {[['all', 'সব'], ['family', 'পারিবারিক'], ['business', 'ব্যবসায়িক']].map(([v, label]) => (
              <button
                key={v}
                className={`seg-btn ${scope === v ? 'active' : ''}`}
                onClick={() => setScope(v)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="stat-grid">
        <StatCard
          label="আজকের খরচ"
          value={loading ? '—' : fmtTK(today.total)}
          hint={`${bnDigits(today.count)} টি রেকর্ড`}
          icon="money"
          tone="green"
        />
        <StatCard
          label="এই মাসের খরচ"
          value={loading ? '—' : fmtTK(month.total)}
          hint={`${bnDigits(month.count)} টি রেকর্ড`}
          icon="calendar"
          tone="teal"
        />
        <StatCard
          label="এই বছরের খরচ"
          value={loading ? '—' : fmtTK(year.total)}
          hint={`${bnDigits(year.count)} টি রেকর্ড`}
          icon="chart"
          tone="amber"
        />
        <StatCard
          label="এই মাসের গড় খরচ"
          value={loading || !month.count ? '—' : fmtTK(month.total / new Date().getDate())}
          hint="প্রতিদিনের গড়"
          icon="receipt"
          tone="blue"
        />
      </div>

      <div className="chart-grid">
        <div className="card">
          <div className="card-head">
            <h3>শেষ ১২ মাসের খরচ</h3>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2ece5" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#5d6f63', fontFamily: 'inherit' }} tickLine={false} axisLine={{ stroke: '#d7e5db' }} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11, fill: '#5d6f63' }} tickLine={false} axisLine={false} tickFormatter={(v) => bnDigits(v >= 1000 ? `${Math.round(v / 1000)}ক` : v)} width={44} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f9f4' }} />
                <Bar dataKey="total" fill="#16a34a" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>ক্যাটাগরি অনুযায়ী (এই মাস)</h3>
          </div>
          {pieData.length === 0 ? (
            <div className="empty">এই মাসে এখনো কোনো খরচ নেই</div>
          ) : (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {pieData.map((entry, idx) => (
                      <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmtTK(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>সাম্প্রতিক খরচ</h3>
          <Link className="link" to="/expenses">সব দেখুন</Link>
        </div>
        {recent.length === 0 ? (
          <div className="empty">এখনো কোনো খরচ যোগ করা হয়নি</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>তারিখ</th>
                  <th>পণ্য</th>
                  <th>ক্যাটাগরি</th>
                  <th className="right">মোট</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((e) => (
                  <tr key={e.id}>
                    <td className="nowrap">{fmtDate(e.expense_date)}</td>
                    <td>
                      {e.item_name}
                      <span className={`badge ${e.scope}`}>{SCOPE_LABELS[e.scope]}</span>
                    </td>
                    <td className="muted">{e.category}</td>
                    <td className="right strong">{fmtTK(e.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
