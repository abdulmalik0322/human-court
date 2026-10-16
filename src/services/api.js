// Human Court — API client.
//
// Thin wrapper around fetch for the same-origin JSON API:
//   - base path '/api', credentials: 'include' (cookie-based session)
//   - JSON request/response bodies by default
//   - errors surface as ApiError { status, code, message } parsed from
//     the server's { error: { code, message } } envelope
//   - 120s default timeout via AbortController
//   - api.uploadWithProgress(url, formData, onProgress) uses XMLHttpRequest
//     because fetch has no upload-progress support

// API base: same-origin '/api' in local dev. For production (frontend on
// GitHub Pages, backend on Vercel) set VITE_API_URL to the backend origin,
// e.g. https://human-court-api.vercel.app — the '/api' path is appended.
const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const BASE = `${API_ORIGIN}/api`;
const DEFAULT_TIMEOUT_MS = 120_000;

export class ApiError extends Error {
  constructor({ status, code, message }) {
    super(message || 'Request failed.');
    this.name = 'ApiError';
    this.status = status ?? null;
    this.code = code || null;
    this.message = message || 'Request failed.';
  }
}

// Build a URL with query params; skips null/undefined/'' values.
function buildUrl(path, params = {}) {
  const url = new URL(BASE + path, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  // Same-origin dev: relative URL is fine. Production (API_ORIGIN set):
  // return the absolute URL so fetch hits the backend origin.
  return API_ORIGIN ? url.href : url.pathname + url.search + url.hash;
}

// Extract a friendly error from the server's { error: { code, message } }
// envelope, falling back to status text / body text.
async function throwForStatus(res) {
  let code = null;
  let message = `Request failed with status ${res.status}.`;
  try {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await res.json();
      if (body && body.error) {
        code = body.error.code || null;
        if (body.error.message) message = body.error.message;
      } else if (typeof body?.message === 'string') {
        message = body.message;
      }
    } else {
      const text = await res.text();
      if (text) message = text.slice(0, 500);
    }
  } catch {
    // Ignore parse errors — fall back to the status-based message.
  }
  throw new ApiError({ status: res.status, code, message });
}

async function request(path, { method = 'GET', params, body, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const url = buildUrl(path, params);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      throw new ApiError({ status: 0, code: 'TIMEOUT', message: 'The request timed out. Please try again.' });
    }
    throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message: err?.message || 'Network error. Please check your connection.' });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) await throwForStatus(res);
  // 204 No Content — return null instead of trying to parse JSON.
  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return res.text();
}

export const api = {
  get: (path, { params, timeoutMs } = {}) => request(path, { method: 'GET', params, timeoutMs }),
  post: (path, body, opts) => request(path, { method: 'POST', body, ...(opts || {}) }),
  patch: (path, body, opts) => request(path, { method: 'PATCH', body, ...(opts || {}) }),
  put: (path, body, opts) => request(path, { method: 'PUT', body, ...(opts || {}) }),
  delete: (path, body, opts) => request(path, { method: 'DELETE', body, ...(opts || {}) }),

  // Trigger a file download (e.g. the data-export endpoint) via fetch so the
  // session cookie is sent, then save it with the given filename.
  async download(path, filename, { params } = {}) {
    const url = buildUrl(path, params);
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) await throwForStatus(res);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  },

  // Multipart upload with progress events (0–100). fetch cannot report
  // upload progress, so this uses XMLHttpRequest. Rejects with ApiError.
  uploadWithProgress(path, formData, onProgress, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', buildUrl(path));
      xhr.withCredentials = true; // send the session cookie
      xhr.timeout = timeoutMs;

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && typeof onProgress === 'function') {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const contentType = xhr.getResponseHeader('content-type') || '';
          try {
            resolve(
              contentType.includes('application/json') ? JSON.parse(xhr.responseText) : xhr.responseText
            );
          } catch {
            resolve(xhr.responseText);
          }
        } else {
          let code = null;
          let message = `Upload failed with status ${xhr.status}.`;
          try {
            const body = JSON.parse(xhr.responseText);
            if (body?.error) {
              code = body.error.code || null;
              if (body.error.message) message = body.error.message;
            }
          } catch {
            // keep the default message
          }
          reject(new ApiError({ status: xhr.status, code, message }));
        }
      });

      xhr.addEventListener('error', () =>
        reject(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Upload failed: network error.' }))
      );
      xhr.addEventListener('timeout', () =>
        reject(new ApiError({ status: 0, code: 'TIMEOUT', message: 'Upload timed out. Please try again.' }))
      );
      xhr.addEventListener('abort', () =>
        reject(new ApiError({ status: 0, code: 'ABORTED', message: 'Upload was cancelled.' }))
      );

      xhr.send(formData);
    });
  },
};

export default api;
