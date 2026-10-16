// Evidence uploads. Allowlist: jpg/jpeg/png/webp/pdf/txt. Extension,
// client mimetype, AND magic bytes (via file-type) are all verified;
// executables are rejected. Files get crypto-random names under the
// upload dir and are never served statically.
import path from 'node:path';
import { createReadStream, existsSync } from 'node:fs';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { HttpError } from '../middleware/errorHandler.js';
import { getOwnedCase, requireViewableCase, timelineEvent, evidenceMetadata } from './helpers.js';
import { saveUpload, deleteUpload, uploadPath } from '../services/storage.js';
import { newToken } from '../utils/ids.js';
import { notify } from '../services/notifications.js';

const MAX_SIZE = 10 * 1024 * 1024;

const ALLOWED = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
};

function safeOriginalName(name) {
  const base = path.basename(String(name || 'file')).replace(/[^\w.\-() ]/g, '_').slice(0, 120);
  return base || 'file';
}

async function validateUpload(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const expectedMime = ALLOWED[ext];
  if (!expectedMime) {
    throw new HttpError(
      400,
      'invalid_file_type',
      `File type not allowed. Allowed: ${Object.keys(ALLOWED).join(', ')}`,
    );
  }
  if (file.mimetype !== expectedMime) {
    throw new HttpError(400, 'invalid_file_type', 'File mimetype does not match its extension.');
  }
  if (file.size === 0) throw new HttpError(400, 'invalid_file_type', 'File is empty.');

  // Executable guard on raw magic bytes, independent of file-type.
  const head2 = file.buffer.subarray(0, 2).toString('binary');
  const head4 = file.buffer.subarray(0, 4).toString('binary');
  if (head2 === 'MZ' || head4 === '\x7fELF' || head2 === '#!') {
    throw new HttpError(400, 'invalid_file_type', 'Executable files are not allowed.');
  }

  const detected = await fileTypeFromBuffer(file.buffer);
  if (ext === '.txt') {
    if (detected) {
      throw new HttpError(400, 'invalid_file_type', 'File is not plain text.');
    }
    if (file.buffer.includes(0)) {
      throw new HttpError(400, 'invalid_file_type', 'File is not plain text.');
    }
  } else if (!detected || detected.mime !== expectedMime) {
    throw new HttpError(400, 'invalid_file_type', 'File contents do not match its extension.');
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED[ext]) {
      cb(new HttpError(400, 'invalid_file_type', `File type not allowed. Allowed: ${Object.keys(ALLOWED).join(', ')}`));
      return;
    }
    cb(null, true);
  },
});

export function createEvidenceController(ctx) {
  const { repo, uploadDir, storeName } = ctx;
  // On serverless (MongoDB store) there is no persistent disk — file bytes
  // live in the Evidence document. Local JSON-store deployments keep the
  // upload directory.
  const useBinaryStore = storeName === 'mongodb';
  const single = upload.single('file');

  function runMulter(req, res) {
    return new Promise((resolve, reject) => {
      single(req, res, (err) => (err ? reject(err) : resolve()));
    });
  }

  async function addEvidence(req, res) {
    const c = await getOwnedCase(repo, req.params.id, req.user.id);
    if (c.status === 'archived') {
      throw new HttpError(409, 'invalid_transition', 'Cannot add evidence to an archived case.');
    }
    await runMulter(req, res);
    const file = req.file;
    if (!file) throw new HttpError(400, 'validation_error', 'No file uploaded (field name: "file").');
    await validateUpload(file);

    const { description } = req.body || {};
    if (description !== undefined && (typeof description !== 'string' || description.length > 2000)) {
      throw new HttpError(400, 'validation_error', 'description must be a string (max 2000 characters).');
    }

    const ext = path.extname(file.originalname).toLowerCase();
    // Serverless: keep bytes in the document. Local: keep the upload dir.
    const storedName = useBinaryStore
      ? `${newToken(16)}${ext.toLowerCase()}`
      : await saveUpload(uploadDir, file.buffer, ext);
    const record = await repo.createEvidence({
      caseId: c.id,
      ownerId: req.user.id,
      originalName: safeOriginalName(file.originalname),
      storedName,
      mimeType: ALLOWED[ext],
      size: file.size,
      description: description || null,
      ...(useBinaryStore ? { data: file.buffer } : {}),
    });
    await repo.updateCase(c.id, { timeline: timelineEvent(c, 'evidence_added', record.originalName) });
    await notify(repo, req.user.id, {
      type: 'evidence_added',
      title: 'Evidence added',
      body: `"${record.originalName}" was added to "${c.title}".`,
      caseId: c.id,
    });
    res.status(201).json({ evidence: evidenceMetadata(record) });
  }

  async function listEvidence(req, res) {
    const c = await requireViewableCase(repo, req.params.id, req.user.id);
    const items = (await repo.listEvidenceByCase(c.id)).map(evidenceMetadata);
    res.json({ items });
  }

  async function downloadEvidence(req, res) {
    const c = await requireViewableCase(repo, req.params.id, req.user.id);
    const ev = await repo.getEvidenceById(req.params.evidenceId);
    if (!ev || ev.caseId !== c.id) throw new HttpError(404, 'not_found', 'Evidence not found.');
    res.setHeader('Content-Type', ev.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeOriginalName(ev.originalName)}"`);
    res.setHeader('Content-Length', ev.size);
    // Serverless binary store: bytes live in the document.
    if (ev.data) {
      const buf = Buffer.isBuffer(ev.data) ? ev.data : Buffer.from(ev.data);
      return res.end(buf);
    }
    const filePath = uploadPath(uploadDir, ev.storedName);
    if (!existsSync(filePath)) {
      throw new HttpError(404, 'file_missing', 'The uploaded file is no longer available.');
    }
    createReadStream(filePath).pipe(res);
  }

  async function deleteEvidence(req, res) {
    const c = await getOwnedCase(repo, req.params.id, req.user.id);
    const ev = await repo.getEvidenceById(req.params.evidenceId);
    if (!ev || ev.caseId !== c.id) throw new HttpError(404, 'not_found', 'Evidence not found.');
    // Only the local disk store needs explicit file deletion; binary-store
    // bytes vanish with the document.
    if (!useBinaryStore) await deleteUpload(uploadDir, ev.storedName);
    await repo.deleteEvidence(ev.id);
    await repo.updateCase(c.id, { timeline: timelineEvent(c, 'evidence_removed', ev.originalName) });
    res.json({ ok: true });
  }

  return { addEvidence, listEvidence, downloadEvidence, deleteEvidence };
}
