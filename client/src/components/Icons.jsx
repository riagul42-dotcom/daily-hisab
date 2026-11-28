export function Icon({ name, size = 20 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  switch (name) {
    case 'menu':
      return (
        <svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      );
    case 'close':
      return (
        <svg {...common}><path d="M6 6l12 12M18 6L6 18" /></svg>
      );
    case 'logout':
      return (
        <svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
      );
    case 'plus':
      return (
        <svg {...common}><path d="M12 5v14M5 12h14" /></svg>
      );
    case 'edit':
      return (
        <svg {...common}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
      );
    case 'trash':
      return (
        <svg {...common}><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
      );
    case 'download':
      return (
        <svg {...common}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
      );
    case 'search':
      return (
        <svg {...common}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
      );
    case 'dashboard':
      return (
        <svg {...common}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
      );
    case 'receipt':
      return (
        <svg {...common}><path d="M6 2h12v20l-3-2-3 2-3-2-3 2Z" /><path d="M9 7h6M9 11h6M9 15h4" /></svg>
      );
    case 'chart':
      return (
        <svg {...common}><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" /><rect x="12" y="8" width="3" height="10" /><rect x="17" y="5" width="3" height="13" /></svg>
      );
    case 'users':
      return (
        <svg {...common}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 5.5a3 3 0 0 1 0 5.5" /><path d="M17.5 14.5A6 6 0 0 1 21.5 20" /></svg>
      );
    case 'money':
      return (
        <svg {...common}><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9.5v.01M18 14.5v.01" /></svg>
      );
    case 'calendar':
      return (
        <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
      );
    case 'pdf':
      return (
        <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 15h1.5a1.5 1.5 0 0 0 0-3H8v6" /><path d="M14 12v6" /></svg>
      );
    case 'excel':
      return (
        <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M9 12l5 6M14 12l-5 6" /></svg>
      );
    case 'android':
      return (
        <svg {...common}><path d="M5 9h14v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" /><path d="M7 9a5 5 0 0 1 10 0" /><path d="M8 5l1.2 2.2M16 5l-1.2 2.2" /><path d="M9.5 13.5v.01M14.5 13.5v.01" /></svg>
      );
    case 'user':
      return (
        <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
      );
    case 'key':
      return (
        <svg {...common}><circle cx="7.5" cy="15.5" r="4.5" /><path d="M10.7 12.3 21 2M15 7l3 3" /></svg>
      );
    case 'check':
      return (
        <svg {...common}><path d="M20 6 9 17l-5-5" /></svg>
      );
    case 'chat':
      return (
        <svg {...common}><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H8l-4.5 3 1.2-4.1A8.5 8.5 0 1 1 21 11.5Z" /><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" /></svg>
      );
    case 'send':
      return (
        <svg {...common}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4Z" /></svg>
      );
    case 'back':
      return (
        <svg {...common}><path d="M15 18l-6-6 6-6" /></svg>
      );
    default:
      return null;
  }
}
