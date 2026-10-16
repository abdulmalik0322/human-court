import crypto from 'node:crypto';

export const newId = () => crypto.randomUUID();

export const newToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

export const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
