export async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    /* খালি রেসপন্স */
  }

  if (!res.ok) {
    const err = new Error(data.error || 'সমস্যা হয়েছে, আবার চেষ্টা করুন');
    err.status = res.status;
    throw err;
  }
  return data;
}
