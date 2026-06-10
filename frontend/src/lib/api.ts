export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request(path: string, opts: RequestInit = {}) {
  const res = await fetch('/api' + path, { credentials: 'include', ...opts });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    throw new ApiError(res.status, (data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  get: (p: string) => request(p),
  post: (p: string, body?: unknown) =>
    request(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) }),
  put: (p: string, body?: unknown) =>
    request(p, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) }),
  patch: (p: string, body?: unknown) =>
    request(p, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) }),
  del: (p: string) => request(p, { method: 'DELETE' }),
  upload: (p: string, form: FormData) => request(p, { method: 'POST', body: form })
};

export function downloadUrl(fileId: number, inline = false) {
  return `/api/files/${fileId}/download${inline ? '?inline=1' : ''}`;
}
