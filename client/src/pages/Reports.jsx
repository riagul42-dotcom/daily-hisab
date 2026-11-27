import { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon } from '../components/Icons.jsx';
import {
  BN_MONTHS, bnDigits, fmtDate, fmtDateTime, fmtTK, firstOfMonthISO,
  monthLabel, toISO, todayISO,
} from '../format.js';

const pad = (n) => String(n).padStart(2, '0');

export default function Reports() {
  const { user } = useAuth();
  const now = new Date();
  const [mode, setMode] = useState('month');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [customFrom, setCustomFrom] = useState(firstOfMonthISO());
  const [customTo, setCustomTo] = useState(todayISO());
  const [scope, setScope] = useState('');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);

  const years = useMemo(() => {
    const y = now.getFullYear();
    return [y, y - 1, y - 2, y - 3, y - 4];
  }, []);

  const range = useMemo(() => {
    if (mode === 'month') {
      return {
        from: `${year}-${pad(month)}-01`,
        to: toISO(new Date(year, month, 0)),
        label: `${BN_MONTHS[month - 1]} ${bnDigits(year)}`,
      };
    }
    if (mode === 'year') {
      return { from: `${year}-01-01`, to: `${year}-12-31`, label: `${bnDigits(year)} সাল` };
    }
    return { from: customFrom, to: customTo, label: `${fmtDate(customFrom)} — ${fmtDate(customTo)}` };
  }, [mode, year, month, customFrom, customTo]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ from: range.from, to: range.to });
    if (scope) params.set('scope', scope);
    api(`/reports/summary?${params.toString()}`)
      .then((d) => alive && setSummary(d))
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [range.from, range.to, scope]);

  const label = mode === 'month'
    ? `${BN_MONTHS[month - 1]} ${bnDigits(year)}`
    : mode === 'year'
      ? `${bnDigits(year)} সাল`
      : `${fmtDate(customFrom)} — ${fmtDate(customTo)}`;

  const fileTag = mode === 'month'
    ? `${year}-${pad(month)}`
    : mode === 'year'
      ? String(year)
      : `${customFrom}_${customTo}`;

  const rowsForPeriod = useMemo(() => {
    if (!summary) return [];
    if (mode === 'month') {
      return summary.byDay.map((d) => ({ key: d.date, label: fmtDate(d.date), total: d.total, count: d.count }));
    }
    return summary.byMonth.map((m) => ({ key: m.month, label: monthLabel(m.month), total: m.total, count: m.count }));
  }, [summary, mode]);

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        windowWidth: reportRef.current.scrollWidth,
      });
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = 210;
      const pageH = 297;
      const margin = 8;
      const usableW = pageW - margin * 2;
      const usableH = pageH - margin * 2;
      const imgH = (canvas.height * usableW) / canvas.width;
      let heightLeft = imgH;
      let position = margin;
      pdf.addImage(img, 'PNG', margin, position, usableW, imgH);
      heightLeft -= usableH;
      while (heightLeft > 0) {
        position = margin - (imgH - heightLeft);
        pdf.addPage();
        pdf.addImage(img, 'PNG', margin, position, usableW, imgH);
        heightLeft -= usableH;
      }
      pdf.save(`Daily-Hisab-${fileTag}.pdf`);
    } catch (err) {
      setError('PDF তৈরি করা যায়নি: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const downloadExcel = () => {
    if (!summary) return;
    const aoa = [
      ['Daily Hisab — দৈনিক বাজার হিসাব'],
      ['রিপোর্ট', mode === 'month' ? 'মাসিক' : mode === 'year' ? 'বার্ষিক' : 'কাস্টম'],
      ['সময়কাল', label],
      ['তৈরি', fmtDateTime(new Date().toISOString())],
      [],
      ['মোট খরচ (৳)', Math.round(summary.total * 100) / 100],
      ['মোট আয় (৳)', Math.round((summary.incomeTotal || 0) * 100) / 100],
      ['বর্তমান ব্যালেন্স (৳)', Math.round((summary.balance || 0) * 100) / 100],
      ['রেকর্ড সংখ্যা', summary.count],
      [],
      ['ক্যাটাগরি', 'রেকর্ড', 'মোট (৳)'],
      ...summary.byCategory.map((c) => [c.category, c.count, Math.round(c.total * 100) / 100]),
      [],
      ['আয়ের ক্যাটাগরি', 'রেকর্ড', 'মোট (৳)'],
      ...(summary.incomeByCategory || []).map((c) => [c.category, c.count, Math.round(c.total * 100) / 100]),
      [],
      [mode === 'month' ? 'তারিখ' : 'মাস', 'রেকর্ড', 'মোট (৳)'],
      ...rowsForPeriod.map((r) => [r.label, r.count, Math.round(r.total * 100) / 100]),
    ];
    aoa.push([], ['ব্যবহারকারী', 'রেকর্ড', 'মোট (৳)']);
    summary.byUser.forEach((u) => aoa.push([u.user_name, u.count, Math.round(u.total * 100) / 100]));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'রিপোর্ট');
    XLSX.writeFile(wb, `Daily-Hisab-${fileTag}.xlsx`);
  };

  return (
    <div className="page">
      {error && <div className="alert error">{error}</div>}

      <div className="card no-print">
        <div className="filter-bar">
          <div className="seg">
            {[['month', 'মাসিক'], ['year', 'বার্ষিক'], ['custom', 'কাস্টম']].map(([v, t]) => (
              <button key={v} className={`seg-btn ${mode === v ? 'active' : ''}`} onClick={() => setMode(v)}>
                {t}
              </button>
            ))}
          </div>

          {mode !== 'custom' && (
            <label className="field compact">
              <span>বছর</span>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => <option key={y} value={y}>{bnDigits(y)}</option>)}
              </select>
            </label>
          )}

          {mode === 'month' && (
            <label className="field compact">
              <span>মাস</span>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {BN_MONTHS.map((m, idx) => <option key={m} value={idx + 1}>{m}</option>)}
              </select>
            </label>
          )}

          {mode === 'custom' && (
            <>
              <label className="field compact">
                <span>শুরুর তারিখ</span>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </label>
              <label className="field compact">
                <span>শেষ তারিখ</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </label>
            </>
          )}

          <label className="field compact">
            <span>ধরন</span>
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="">সব</option>
              <option value="family">পারিবারিক</option>
              <option value="business">ব্যবসায়িক</option>
            </select>
          </label>

          <div className="export-actions">
            <button className="btn ghost" onClick={downloadPDF} disabled={!summary || exporting}>
              <Icon name="pdf" size={18} /> {exporting ? 'তৈরি হচ্ছে…' : 'PDF'}
            </button>
            <button className="btn ghost" onClick={downloadExcel} disabled={!summary}>
              <Icon name="excel" size={18} /> Excel
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card"><div className="empty">লোড হচ্ছে…</div></div>
      ) : !summary ? null : (
        <div className="report-page card" ref={reportRef}>
          <div className="report-head">
            <div>
              <div className="report-brand">Daily Hisab</div>
              <div className="report-title">
                {mode === 'month' ? 'মাসিক' : mode === 'year' ? 'বার্ষিক' : 'কাস্টম'} খরচ রিপোর্ট — {label}
              </div>
            </div>
            <div className="report-meta">
              <div>তৈরি: {fmtDateTime(new Date().toISOString())}</div>
              <div>ব্যবহারকারী: {user?.name}</div>
            </div>
          </div>

          <div className="report-stats">
            <div className="report-stat">
              <div className="report-stat-label">মোট খরচ</div>
              <div className="report-stat-value">{fmtTK(summary.total)}</div>
            </div>
            <div className="report-stat">
              <div className="report-stat-label">মোট আয়</div>
              <div className="report-stat-value">{fmtTK(summary.incomeTotal || 0)}</div>
            </div>
            <div className="report-stat">
              <div className="report-stat-label">বর্তমান ব্যালেন্স</div>
              <div className="report-stat-value">{fmtTK(summary.balance || 0)}</div>
            </div>
            <div className="report-stat">
              <div className="report-stat-label">রেকর্ড সংখ্যা</div>
              <div className="report-stat-value">{bnDigits(summary.count)}</div>
            </div>
            <div className="report-stat">
              <div className="report-stat-label">গড় রেকর্ড</div>
              <div className="report-stat-value">{fmtTK(summary.avgRecord)}</div>
            </div>
            <div className="report-stat">
              <div className="report-stat-label">দৈনিক গড়</div>
              <div className="report-stat-value">{fmtTK(summary.avgPerDay)}</div>
            </div>
          </div>

          {summary.byCategory.length > 0 && (
            <div className="report-section">
              <h4>ক্যাটাগরি অনুযায়ী খরচ</h4>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>ক্যাটাগরি</th><th className="right">রেকর্ড</th><th className="right">মোট</th><th className="right">শতাংশ</th></tr>
                  </thead>
                  <tbody>
                    {summary.byCategory.map((c) => (
                      <tr key={c.category}>
                        <td>{c.category}</td>
                        <td className="right">{bnDigits(c.count)}</td>
                        <td className="right strong">{fmtTK(c.total)}</td>
                        <td className="right">{bnDigits(summary.total ? Math.round((c.total / summary.total) * 100) : 0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {summary.incomeByCategory && summary.incomeByCategory.length > 0 && (
            <div className="report-section">
              <h4>আয় ক্যাটাগরি অনুযায়ী</h4>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>ক্যাটাগরি</th><th className="right">রেকর্ড</th><th className="right">মোট</th></tr>
                  </thead>
                  <tbody>
                    {summary.incomeByCategory.map((c) => (
                      <tr key={`inc-${c.category}`}>
                        <td>{c.category}</td>
                        <td className="right">{bnDigits(c.count)}</td>
                        <td className="right strong">{fmtTK(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {rowsForPeriod.length > 0 && (
            <div className="report-section">
              <h4>{mode === 'month' ? 'দৈনিক খরচ' : 'মাস অনুযায়ী খরচ'}</h4>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>{mode === 'month' ? 'তারিখ' : 'মাস'}</th><th className="right">রেকর্ড</th><th className="right">মোট</th></tr>
                  </thead>
                  <tbody>
                    {rowsForPeriod.map((r) => (
                      <tr key={r.key}>
                        <td>{r.label}</td>
                        <td className="right">{bnDigits(r.count)}</td>
                        <td className="right strong">{fmtTK(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {summary.byUser.length > 0 && (
            <div className="report-section">
              <h4>ব্যবহারকারী অনুযায়ী খরচ</h4>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>ব্যবহারকারী</th><th className="right">রেকর্ড</th><th className="right">মোট</th></tr>
                  </thead>
                  <tbody>
                    {summary.byUser.map((u) => (
                      <tr key={u.user_id}>
                        <td>{u.user_name}</td>
                        <td className="right">{bnDigits(u.count)}</td>
                        <td className="right strong">{fmtTK(u.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {summary.count === 0 && <div className="empty">এই সময়কালে কোনো খরচ নেই</div>}

          <div className="report-foot">
            Daily Hisab — দৈনিক বাজার হিসাব ও খরচ ব্যবস্থাপনা
          </div>
        </div>
      )}
    </div>
  );
}
