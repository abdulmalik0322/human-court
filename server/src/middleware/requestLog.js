// Minimal request logging: method, path, status, duration.
// Never logs headers, cookies, or bodies.
export function requestLog(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
}
