// MongoDB store: the production path. Implements the SAME interface as
// jsonStore.js (documented in repository.js) using the Mongoose models
// from models/schemas.js. All records are serialized to plain objects
// with string ids and ISO-string dates so callers cannot tell which
// store is active.
import {
  User,
  PasswordReset,
  Case,
  Evidence,
  Assessment,
  Review,
  Invitation,
  ShareLink,
  Notification,
} from '../models/schemas.js';

function serialize(doc) {
  if (!doc) return null;
  const raw = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === '_id') {
      out.id = String(value);
    } else if (key === '__v') {
      // skip
    } else {
      out[key] = revive(value);
    }
  }
  return out;
}

function revive(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return value.map(revive);
  if (value && typeof value === 'object') {
    // Mongoose subdocuments may carry their own _id — drop it.
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === '_id') continue;
      out[k] = revive(v);
    }
    return out;
  }
  return value;
}

// Escape user input used inside a $regex so it cannot become a pattern.
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  updated: { updatedAt: -1 },
};

export function makeMongooseRepository() {
  return {
    // ---- users ----
    createUser: async (data) => serialize(await User.create(data)),
    getUserById: async (id) => serialize(await User.findById(id)),
    getUserByEmail: async (email) => serialize(await User.findOne({ email: String(email).toLowerCase() })),
    updateUser: async (id, patch) => serialize(await User.findByIdAndUpdate(id, { $set: patch }, { new: true })),
    deleteUser: async (id) => Boolean(await User.findByIdAndDelete(id)),

    // ---- password resets ----
    createPasswordReset: async (data) => serialize(await PasswordReset.create(data)),
    getPasswordResetByUserId: async (userId) =>
      serialize(await PasswordReset.findOne({ userId }).sort({ createdAt: -1 })),
    updatePasswordReset: async (id, patch) =>
      serialize(await PasswordReset.findByIdAndUpdate(id, { $set: patch }, { new: true })),
    deletePasswordReset: async (id) => Boolean(await PasswordReset.findByIdAndDelete(id)),
    deletePasswordResetsByUser: async (userId) => (await PasswordReset.deleteMany({ userId })).deletedCount,

    // ---- cases ----
    createCase: async (data) => serialize(await Case.create(data)),
    getCaseById: async (id) => serialize(await Case.findById(id)),
    getCaseByIdempotencyKey: async (ownerId, key) =>
      serialize(await Case.findOne({ ownerId, idempotencyKey: key })),
    listCasesByOwner: async (ownerId, opts = {}) => {
      const filter = { ownerId };
      if (opts.status) filter.status = opts.status;
      if (opts.category) filter.category = opts.category;
      if (opts.q) {
        const rx = new RegExp(escapeRegex(opts.q), 'i');
        filter.$or = [{ title: rx }, { summary: rx }];
      }
      if (opts.from || opts.to) {
        filter.createdAt = {};
        if (opts.from) filter.createdAt.$gte = new Date(opts.from);
        if (opts.to) filter.createdAt.$lte = new Date(opts.to);
      }
      const total = await Case.countDocuments(filter);
      const items = await Case.find(filter)
        .sort(SORTS[opts.sort] || SORTS.newest)
        .skip(opts.skip || 0)
        .limit(opts.limit || 50);
      return { items: items.map(serialize), total };
    },
    updateCase: async (id, patch) => serialize(await Case.findByIdAndUpdate(id, { $set: patch }, { new: true })),
    deleteCase: async (id) => Boolean(await Case.findByIdAndDelete(id)),

    // ---- evidence ----
    createEvidence: async (data) => serialize(await Evidence.create(data)),
    getEvidenceById: async (id) => serialize(await Evidence.findById(id)),
    listEvidenceByCase: async (caseId) =>
      (await Evidence.find({ caseId }).sort({ createdAt: 1 })).map(serialize),
    deleteEvidence: async (id) => Boolean(await Evidence.findByIdAndDelete(id)),
    deleteEvidenceByCase: async (caseId) => (await Evidence.deleteMany({ caseId })).deletedCount,

    // ---- assessments ----
    createAssessment: async (data) => serialize(await Assessment.create(data)),
    getAssessmentById: async (id) => serialize(await Assessment.findById(id)),
    listAssessmentsByCase: async (caseId) =>
      (await Assessment.find({ caseId }).sort({ createdAt: -1 })).map(serialize),
    countAssessmentsByCase: async (caseId) => Assessment.countDocuments({ caseId }),
    updateAssessment: async (id, patch) =>
      serialize(await Assessment.findByIdAndUpdate(id, { $set: patch }, { new: true })),
    deleteAssessmentsByCase: async (caseId) => (await Assessment.deleteMany({ caseId })).deletedCount,

    // ---- reviews ----
    createReview: async (data) => serialize(await Review.create(data)),
    getReviewById: async (id) => serialize(await Review.findById(id)),
    getReviewByCaseAndUser: async (caseId, userId) => serialize(await Review.findOne({ caseId, userId })),
    listReviewsByCase: async (caseId) =>
      (await Review.find({ caseId }).sort({ createdAt: -1 })).map(serialize),
    updateReview: async (id, patch) =>
      serialize(await Review.findByIdAndUpdate(id, { $set: patch }, { new: true })),
    deleteReviewsByCase: async (caseId) => (await Review.deleteMany({ caseId })).deletedCount,
    deleteReviewsByUser: async (userId) => (await Review.deleteMany({ userId })).deletedCount,

    // ---- invitations ----
    createInvitation: async (data) => serialize(await Invitation.create(data)),
    getInvitationByTokenHash: async (hash) => serialize(await Invitation.findOne({ tokenHash: hash })),
    listInvitationsByCase: async (caseId) => (await Invitation.find({ caseId })).map(serialize),
    updateInvitation: async (id, patch) =>
      serialize(await Invitation.findByIdAndUpdate(id, { $set: patch }, { new: true })),
    deleteInvitationsByCase: async (caseId) => (await Invitation.deleteMany({ caseId })).deletedCount,

    // ---- share links ----
    createShareLink: async (data) => serialize(await ShareLink.create(data)),
    getShareLinkByTokenHash: async (hash) => serialize(await ShareLink.findOne({ tokenHash: hash })),
    listShareLinksByCase: async (caseId) => (await ShareLink.find({ caseId })).map(serialize),
    deleteShareLinksByCase: async (caseId) => (await ShareLink.deleteMany({ caseId })).deletedCount,

    // ---- notifications ----
    createNotification: async (data) => serialize(await Notification.create({ read: false, ...data })),
    listNotificationsByUser: async (userId, opts = {}) => {
      const total = await Notification.countDocuments({ userId });
      const unreadCount = await Notification.countDocuments({ userId, read: false });
      const items = await Notification.find({ userId })
        .sort({ createdAt: -1 })
        .skip(opts.skip || 0)
        .limit(opts.limit || 50);
      return { items: items.map(serialize), total, unreadCount };
    },
    markNotificationRead: async (id, userId) =>
      serialize(await Notification.findOneAndUpdate({ _id: id, userId }, { $set: { read: true } }, { new: true })),
    deleteNotificationsByUser: async (userId) => (await Notification.deleteMany({ userId })).deletedCount,
  };
}
