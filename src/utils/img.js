// Resolve public/ asset paths against the Vite base URL.
// Works both locally (BASE_URL='/') and on GitHub Pages (BASE_URL='/human-court/').
export const img = (p) => `${import.meta.env.BASE_URL}${String(p).replace(/^\/+/, '')}`;
