// JSON-file store: the zero-config default. One JSON array file per
// collection under the data dir. Implements the repository interface
// documented in repository.js.
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { newId } from '../utils/ids.js';

const now = () => new Date().toISOString();

function loadArray(file) {
  try {
    const raw = readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Atomic-ish write (tmp file + rename) so a crash mid-write cannot
// leave a half-written collection behind.
function saveArray(file, arr) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(arr, null, 2));
  renameSync(tmp, file);
}

const clone = (doc) => (doc ? JSON.parse(JSON.stringify(doc)) : null);

class Collection {
  constructor(dir, name) {
    this.file = join(dir, `${name}.json`);
    this.docs = loadArray(this.file);
  }

  save() {
    saveArray(this.file, this.docs);
  }

  insert(doc) {
    const withMeta = {
      id: doc.id || newId(),
      createdAt: doc.createdAt || now(),
      updatedAt: doc.updatedAt || now(),
      ...doc,
    };
    this.docs.push(withMeta);
    this.save();
    return clone(withMeta);
  }

  findById(id) {
    return clone(this.docs.find((d) => d.id === id) || null);
  }

  findOne(predicate) {
    return clone(this.docs.find(predicate) || null);
  }

  find(predicate) {
    return this.docs.filter(predicate).map(clone);
  }

  update(id, patch) {
    const doc = this.docs.find((d) => d.id === id);
    if (!doc) return null;
    Object.assign(doc, patch, { updatedAt: now() });
    this.save();
    return clone(doc);
  }

  remove(id) {
    const idx = this.docs.findIndex((d) => d.id === id);
    if (idx === -1) return false;
    this.docs.splice(idx, 1);
    this.save();
    return true;
  }

  removeWhere(predicate) {
    const before = this.docs.length;
    this.docs = this.docs.filter((d) => !predicate(d));
    if (this.docs.length !== before) this.save();
    return before - this.docs.length;
  }

  count(predicate) {
    return this.docs.filter(predicate).length;
  }
}

function sortCases(items, sort) {
  const arr = [...items];
  if (sort === 'oldest') arr.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  else if (sort === 'updated') arr.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  else arr.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)); // newest
  return arr;
}

export function makeJsonRepository(dataDir) {
  mkdirSync(dataDir, { recursive: true });

  const users = new Collection(dataDir, 'users');
  const passwordResets = new Collection(dataDir, 'passwordResets');
  const cases = new Collection(dataDir, 'cases');
  const evidence = new Collection(dataDir, 'evidence');
  const assessments = new Collection(dataDir, 'assessments');
  const reviews = new Collection(dataDir, 'reviews');
  const invitations = new Collection(dataDir, 'invitations');
  const shareLinks = new Collection(dataDir, 'shareLinks');
  const notifications = new Collection(dataDir, 'notifications');

  return {
    // ---- users ----
    createUser: (data) => users.insert(data),
    getUserById: (id) => users.findById(id),
    getUserByEmail: (email) => users.findOne((u) => u.email === String(email).toLowerCase()),
    updateUser: (id, patch) => users.update(id, patch),
    deleteUser: (id) => users.remove(id),

    // ---- password resets ----
    createPasswordReset: (data) => passwordResets.insert(data),
    getPasswordResetByUserId: (userId) =>
      passwordResets
        .find((r) => r.userId === userId)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0] || null,
    updatePasswordReset: (id, patch) => passwordResets.update(id, patch),
    deletePasswordReset: (id) => passwordResets.remove(id),
    deletePasswordResetsByUser: (userId) => passwordResets.removeWhere((r) => r.userId === userId),

    // ---- cases ----
    createCase: (data) => cases.insert(data),
    getCaseById: (id) => cases.findById(id),
    getCaseByIdempotencyKey: (ownerId, key) =>
      cases.findOne((c) => c.ownerId === ownerId && c.idempotencyKey === key),
    listCasesByOwner: (ownerId, opts = {}) => {
      let items = cases.find((c) => c.ownerId === ownerId);
      if (opts.status) items = items.filter((c) => c.status === opts.status);
      if (opts.category) items = items.filter((c) => c.category === opts.category);
      if (opts.q) {
        const q = String(opts.q).toLowerCase();
        items = items.filter((c) => `${c.title || ''} ${c.summary || ''}`.toLowerCase().includes(q));
      }
      if (opts.from) items = items.filter((c) => c.createdAt >= opts.from);
      if (opts.to) items = items.filter((c) => c.createdAt <= opts.to);
      const total = items.length;
      const sorted = sortCases(items, opts.sort);
      const paged = sorted.slice(opts.skip || 0, (opts.skip || 0) + (opts.limit || 50));
      return { items: paged, total };
    },
    updateCase: (id, patch) => cases.update(id, patch),
    deleteCase: (id) => cases.remove(id),

    // ---- evidence ----
    createEvidence: (data) => evidence.insert(data),
    getEvidenceById: (id) => evidence.findById(id),
    listEvidenceByCase: (caseId) =>
      evidence.find((e) => e.caseId === caseId).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    deleteEvidence: (id) => evidence.remove(id),
    deleteEvidenceByCase: (caseId) => evidence.removeWhere((e) => e.caseId === caseId),

    // ---- assessments ----
    createAssessment: (data) => assessments.insert(data),
    getAssessmentById: (id) => assessments.findById(id),
    listAssessmentsByCase: (caseId) =>
      assessments
        .find((a) => a.caseId === caseId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    countAssessmentsByCase: (caseId) => assessments.count((a) => a.caseId === caseId),
    updateAssessment: (id, patch) => assessments.update(id, patch),
    deleteAssessmentsByCase: (caseId) => assessments.removeWhere((a) => a.caseId === caseId),

    // ---- reviews ----
    createReview: (data) => reviews.insert(data),
    getReviewById: (id) => reviews.findById(id),
    getReviewByCaseAndUser: (caseId, userId) =>
      reviews.findOne((r) => r.caseId === caseId && r.userId === userId),
    listReviewsByCase: (caseId) =>
      reviews.find((r) => r.caseId === caseId).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    updateReview: (id, patch) => reviews.update(id, patch),
    deleteReviewsByCase: (caseId) => reviews.removeWhere((r) => r.caseId === caseId),
    deleteReviewsByUser: (userId) => reviews.removeWhere((r) => r.userId === userId),

    // ---- invitations ----
    createInvitation: (data) => invitations.insert(data),
    getInvitationByTokenHash: (hash) => invitations.findOne((i) => i.tokenHash === hash),
    listInvitationsByCase: (caseId) => invitations.find((i) => i.caseId === caseId),
    updateInvitation: (id, patch) => invitations.update(id, patch),
    deleteInvitationsByCase: (caseId) => invitations.removeWhere((i) => i.caseId === caseId),

    // ---- share links ----
    createShareLink: (data) => shareLinks.insert(data),
    getShareLinkByTokenHash: (hash) => shareLinks.findOne((s) => s.tokenHash === hash),
    listShareLinksByCase: (caseId) => shareLinks.find((s) => s.caseId === caseId),
    deleteShareLinksByCase: (caseId) => shareLinks.removeWhere((s) => s.caseId === caseId),

    // ---- notifications ----
    createNotification: (data) => notifications.insert({ read: false, ...data }),
    listNotificationsByUser: (userId, opts = {}) => {
      const all = notifications
        .find((n) => n.userId === userId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      const total = all.length;
      const unreadCount = all.filter((n) => !n.read).length;
      const paged = all.slice(opts.skip || 0, (opts.skip || 0) + (opts.limit || 50));
      return { items: paged, total, unreadCount };
    },
    markNotificationRead: (id, userId) => {
      const n = notifications.findOne((x) => x.id === id && x.userId === userId);
      if (!n) return null;
      return notifications.update(id, { read: true });
    },
    deleteNotificationsByUser: (userId) => notifications.removeWhere((n) => n.userId === userId),
  };
}

export function dataFileExists(dataDir) {
  return existsSync(join(dataDir, 'cases.json'));
}
