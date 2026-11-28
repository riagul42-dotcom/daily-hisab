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
  bnDigits, fmtDate, fmtTK, monthLabel, monthShort, toISO, todayISO,
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
  const currentYm = todayISO().slice(0, 7);
  const currentYear = new Date().getFullYear();
  const [mode, setMode] = useState('month');
  const [datePick, setDatePick] = useState(todayISO());
  const [monthPick, setMonthPick] = useState(currentYm);
  const [yearPick, setYearPick] = useState(String(currentYear));
  const [rangeFrom, setRangeFrom] = useState(`${currentYm}-01`);
  const [rangeTo, setRangeTo] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [today, setToday] = useState({ total: 0, count: 0, incomeTotal: 0 });
  const [period, setPeriod] = useState({ total: 0, count: 0, byCategory: [], incomeTotal: 0 });
  const [yearData, setYearData] = useState({ total: 0, count: 0, incomeTotal: 0 });
  const [monthly, setMonthly] = useState([]);
  const [recent, setRecent] = useState([]);
  const [refreshTick, setRefreshTick] = useState(0);

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

  const scopeQuery = useMemo(
    () => (scope === 'all' ? '' : `scope=${scope}&`),
    [scope]
  );

  const range = useMemo(() => {
    if (mode === 'day') return { from: datePick, to: datePick };
    if (mode === 'year') {
      return {
        from: `${yearPick}-01-01`,
        to: Number(yearPick) === currentYear ? todayISO() : `${yearPick}-12-31`,
      };
    }
    if (mode === 'range') {
      const [from, to] = rangeFrom <= rangeTo ? [rangeFrom, rangeTo] : [rangeTo, rangeFrom];
      return { from, to };
    }
    const [y, m] = monthPick.split('-').map(Number);
    return {
      from: `${monthPick}-01`,
      to: monthPick === currentYm ? todayISO() : toISO(new Date(y, m, 0)),
    };
  }, [mode, datePick, monthPick, yearPick, rangeFrom, rangeTo, currentYm, currentYear]);

  const contextYear = Number(range.to.slice(0, 4));

  const rangeDays = Math.max(
    1,
    Math.round((new Date(`${range.to}T00:00:00`) - new Date(`${range.from}T00:00:00`)) / 86400000) + 1
  );
  const yearFrom = `${contextYear}-01-01`;
  const yearTo = contextYear === currentYear ? todayISO() : `${contextYear}-12-31`;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const t = todayISO();
    Promise.all([
      api(`/reports/summary?${scopeQuery}from=${t}&to=${t}`),
      api(`/reports/summary?${scopeQuery}from=${range.from}&to=${range.to}`),
      api(`/reports/summary?${scopeQuery}from=${yearFrom}&to=${yearTo}`),
      api(`/reports/monthly?months=12&${scopeQuery.replace(/&$/, '')}`),
      api(`/expenses?from=${range.from}&to=${range.to}&limit=8&${scopeQuery.replace(/&$/, '')}`),
    ])
      .then(([td, pe, yr, ml, rc]) => {
        if (!alive) return;
        setToday(td);
        setPeriod(pe);
        setYearData(yr);
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
  }, [scopeQuery, range.from, range.to, yearFrom, yearTo, refreshTick]);

  const pieData = (period.byCategory || []).map((c) => ({ name: c.category, value: Math.round(c.total) }));

  const rangeLabel = mode === 'range' ? `${fmtDate(range.from)} – ${fmtDate(range.to)}` : '';

  const periodName = mode === 'day'
    ? fmtDate(datePick)
    : mode === 'year'
      ? `${bnDigits(contextYear)} সাল`
      : mode === 'range'
        ? rangeLabel
        : monthLabel(monthPick);

  const spendLabel = mode === 'day'
    ? `${fmtDate(datePick)} তারিখের খরচ`
    : mode === 'year'
      ? `${bnDigits(contextYear)} সালের খরচ`
      : mode === 'range'
        ? `${rangeLabel} সময়ের খরচ`
        : `${monthLabel(monthPick)} মাসের খরচ`;

  const last12 = monthly.reduce(
    (acc, m) => ({ total: acc.total + m.total, count: acc.count + m.count }),
    { total: 0, count: 0 }
  );

  return (
    <div className="page">
      {error && <div className="alert error">{error}</div>}

      <div className="page-row">
        <div>
          <h2 className="welcome">স্বাগতম, {user?.name}</h2>
          <p className="muted">আপনার খরচের সারসংক্ষেপ এক নজরে</p>
        </div>
        <div className="dash-controls">
          <div className="field compact">
            <span>সময় বাছাই</span>
            <div className="period-row">
              <div className="seg">
                {[['day', 'তারিখ'], ['month', 'মাস'], ['year', 'বছর'], ['range', 'সীমা']].map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    className={`seg-btn ${mode === v ? 'active' : ''}`}
                    onClick={() => setMode(v)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {mode === 'day' && (
                <input
                  type="date"
                  value={datePick}
                  max={todayISO()}
                  onChange={(e) => setDatePick(e.target.value || todayISO())}
                />
              )}
              {mode === 'month' && (
                <input
                  type="month"
                  value={monthPick}
                  max={currentYm}
                  onChange={(e) => setMonthPick(e.target.value || currentYm)}
                />
              )}
              {mode === 'year' && (
                <input
                  type="number"
                  min={2000}
                  max={currentYear}
                  value={yearPick}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (!Number.isFinite(value) || !value) return;
                    setYearPick(String(Math.min(currentYear, Math.max(2000, Math.round(value)))));
                  }}
                />
              )}
              {mode === 'range' && (
                <>
                  <input
                    type="date"
                    aria-label="শুরুর তারিখ"
                    title="শুরুর তারিখ"
                    value={rangeFrom}
                    max={todayISO()}
                    onChange={(e) => setRangeFrom(e.target.value || `${currentYm}-01`)}
                  />
                  <span className="period-dash">–</span>
                  <input
                    type="date"
                    aria-label="শেষের তারিখ"
                    title="শেষের তারিখ"
                    value={rangeTo}
                    max={todayISO()}
                    onChange={(e) => setRangeTo(e.target.value || todayISO())}
                  />
                </>
              )}
            </div>
          </div>
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
        </div>
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
          label={spendLabel}
          value={loading ? '—' : fmtTK(period.total)}
          hint={`${bnDigits(period.count)} টি রেকর্ড`}
          icon="calendar"
          tone="teal"
        />
        <StatCard
          label={mode === 'year' || mode === 'range' ? 'শেষ ১২ মাসের খরচ' : `${bnDigits(contextYear)} সালের খরচ`}
          value={loading ? '—' : fmtTK(mode === 'year' || mode === 'range' ? last12.total : yearData.total)}
          hint={`${bnDigits(mode === 'year' || mode === 'range' ? last12.count : yearData.count)} টি রেকর্ড`}
          icon="chart"
          tone="amber"
        />
        <StatCard
          label="দৈনিক গড় খরচ"
          value={loading || !period.count ? '—' : fmtTK(period.total / rangeDays)}
          hint={`${bnDigits(rangeDays)} দিনের গড়`}
          icon="receipt"
          tone="blue"
        />
        <StatCard
          label={spendLabel.replace('খরচ', 'আয়')}
          value={loading ? '—' : fmtTK(period.incomeTotal)}
          hint={`${bnDigits(period.incomeCount || 0)} টি রেকর্ড`}
          icon="money"
          tone="teal"
        />
        <StatCard
          label="বর্তমান ব্যালেন্স"
          value={loading ? '—' : fmtTK(period.balance)}
          hint="সর্বমোট আয় − সর্বমোট খরচ"
          icon="chart"
          tone={period.balance < 0 ? 'red' : 'green'}
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
            <h3>ক্যাটাগরি অনুযায়ী ({periodName})</h3>
          </div>
          {pieData.length === 0 ? (
            <div className="empty">এই সময়ে কোনো খরচ নেই</div>
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
          <h3>{spendLabel}</h3>
          <Link className="link" to="/expenses">সব দেখুন</Link>
        </div>
        {recent.length === 0 ? (
          <div className="empty">এই সময়ে কোনো খরচ যোগ করা হয়নি</div>
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
