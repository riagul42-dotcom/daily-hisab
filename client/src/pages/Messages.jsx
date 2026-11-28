import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon } from '../components/Icons.jsx';
import { ROLE_LABELS } from '../constants.js';
import { bnDigits, fmtDate, fmtDateTime, toISO } from '../format.js';

function lastActivity(contact) {
  if (!contact.last_at) return 'কোনো বার্তা নেই';
  const prefix = contact.last_sender_id === contact.id ? '' : 'আপনি: ';
  return `${prefix}${contact.last_body}`;
}

function lastTime(contact) {
  if (!contact.last_at) return '';
  const iso = toISO(new Date(contact.last_at));
  return iso === toISO(new Date()) ? '' : fmtDate(iso);
}

export default function Messages() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await api('/messages/contacts');
        if (!alive) return;
        setContacts(data.contacts);
        setSelected((prev) => {
          if (!prev) return prev;
          return data.contacts.find((c) => c.id === prev.id) || prev;
        });
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoadingContacts(false);
      }
    };
    load();
    const timer = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return undefined;
    }
    let alive = true;
    const load = async () => {
      try {
        const data = await api(`/messages/${selected.id}`);
        if (alive) setMessages(data.messages);
      } catch (err) {
        if (alive) setError(err.message);
      }
    };
    load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [selected?.id]);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ block: 'end' });
  }, [messages.length, selected?.id]);

  const openThread = (contact) => {
    setError('');
    setSelected(contact);
    setContacts((list) => list.map((c) => (c.id === contact.id ? { ...c, unread: 0 } : c)));
  };

  const send = async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !selected || sending) return;
    setSending(true);
    setError('');
    try {
      await api('/messages', {
        method: 'POST',
        body: JSON.stringify({ recipient_id: selected.id, body }),
      });
      setDraft('');
      const data = await api(`/messages/${selected.id}`);
      setMessages(data.messages);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page">
      {error && <div className="alert error">{error}</div>}

      <div className="page-row">
        <div>
          <h2 className="welcome">মেসেঞ্জার</h2>
          <p className="muted">সব অ্যাকাউন্টের সাথে সরাসরি কথা বলুন</p>
        </div>
      </div>

      <div className={`chat-shell ${selected ? 'has-thread' : ''}`}>
        <aside className="chat-card chat-people">
          <div className="chat-people-head">সবাই ({bnDigits(contacts.length)})</div>
          <div className="chat-people-list">
            {loadingContacts ? (
              <div className="chat-empty">লোড হচ্ছে…</div>
            ) : contacts.length === 0 ? (
              <div className="chat-empty">আর কোনো ব্যবহারকারী নেই</div>
            ) : (
              contacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`chat-person ${selected?.id === c.id ? 'active' : ''}`}
                  onClick={() => openThread(c)}
                >
                  <span className="avatar sm">{c.name.slice(0, 1)}</span>
                  <span className="chat-person-body">
                    <span className="chat-person-top">
                      <span className="chat-person-name">{c.name}</span>
                      {c.unread > 0 && <span className="chat-unread">{bnDigits(c.unread)}</span>}
                    </span>
                    <span className="chat-person-last">
                      {lastActivity(c)}
                      {lastTime(c) && <span className="chat-person-date"> · {lastTime(c)}</span>}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="chat-card chat-thread">
          {selected ? (
            <>
              <div className="chat-thread-head">
                <button
                  type="button"
                  className="icon-btn chat-back"
                  onClick={() => setSelected(null)}
                  aria-label="ফিরে যান"
                >
                  <Icon name="back" />
                </button>
                <span className="avatar sm">{selected.name.slice(0, 1)}</span>
                <div className="chat-thread-meta">
                  <div className="chat-thread-title">{selected.name}</div>
                  <div className="chat-thread-sub">{ROLE_LABELS[selected.role] || ''}</div>
                </div>
              </div>

              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div className="chat-empty">এখনো কোনো বার্তা নেই — শুরু করুন</div>
                ) : (
                  messages.map((m, index) => {
                    const day = toISO(new Date(m.created_at));
                    const prevDay = index > 0 ? toISO(new Date(messages[index - 1].created_at)) : null;
                    return (
                      <div key={m.id} className="chat-msg-group">
                        {day !== prevDay && <div className="chat-date">{fmtDate(day)}</div>}
                        <div className={`chat-msg ${m.sender_id === user?.id ? 'mine' : 'theirs'}`}>
                          {m.body}
                          <div className="chat-msg-time">{fmtDateTime(m.created_at).split(', ')[1]}</div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <form className="chat-form" onSubmit={send}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="বার্তা লিখুন…"
                  maxLength={2000}
                  autoComplete="off"
                />
                <button className="btn primary" type="submit" disabled={sending || !draft.trim()}>
                  <Icon name="send" size={17} />
                  পাঠান
                </button>
              </form>
            </>
          ) : (
            <div className="chat-empty">
              বাম দিকের তালিকা থেকে একজনকে বেছে নিয়ে কথা শুরু করুন
            </div>
          )}
        </section>
      </div>
    </div>
  );
}