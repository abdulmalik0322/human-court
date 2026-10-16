// Uploaded evidence files. Files live under HC_UPLOAD_DIR with
// crypto-random names and are NEVER served statically — downloads go
// through an authorized controller that streams them.
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { newToken } from '../utils/ids.js';

export async function ensureUploadDir(uploadDir) {
  await mkdir(uploadDir, { recursive: true });
}

export async function saveUpload(uploadDir, buffer, extension) {
  const storedName = `${newToken(16)}${extension.toLowerCase()}`;
  await writeFile(join(uploadDir, storedName), buffer);
  return storedName;
}

export async function deleteUpload(uploadDir, storedName) {
  if (!storedName) return;
  try {
    await unlink(join(uploadDir, storedName));
  } catch {
    // Already gone — not an error worth surfacing.
  }
}

export function uploadPath(uploadDir, storedName) {
  return join(uploadDir, storedName);
}
