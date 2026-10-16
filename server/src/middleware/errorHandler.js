// Centralized error handling. Every error response has the shape
// { error: { code, message } }. Stack traces and secrets stay server-side.
import multer from 'multer';

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

function toHttpError(err) {
  if (err instanceof HttpError) return err;
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new HttpError(413, 'file_too_large', 'File is larger than the 10 MB limit.');
    }
    return new HttpError(400, 'upload_error', 'File upload failed.');
  }
  if (err && err.type === 'entity.parse.failed') {
    return new HttpError(400, 'validation_error', 'Request body is not valid JSON.');
  }
  return new HttpError(err.status || 500, err.code || 'internal_error', err.message || 'Something went wrong.');
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const httpErr = toHttpError(err);
  const status = httpErr.status || 500;
  if (status >= 500) {
    // Server-side only. Never include tokens, passwords, or request bodies.
    console.error(`[error] ${req.method} ${req.originalUrl} -> ${status} (${httpErr.code})`);
    if (httpErr.stack) console.error(httpErr.stack.split('\n').slice(0, 3).join('\n'));
  }
  // TEMP DEBUG: expose real message on serverless (revert after debugging)
  const debugDetail = process.env.VERCEL ? ` [${httpErr.code}: ${httpErr.message || 'no message'}]`.slice(0, 300) : '';
  const message = status >= 500 ? 'Something went wrong.' + debugDetail : httpErr.message || 'Something went wrong.';
  res.status(status).json({ error: { code: httpErr.code || 'internal_error', message } });
}
