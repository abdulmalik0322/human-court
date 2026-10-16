// Mongoose schemas for the production (MongoDB) store.
// Field shapes mirror the JSON store so both implement the same interface.
import mongoose from 'mongoose';

const { Schema } = mongoose;

const subdocOpts = { _id: false };

const personSchema = new Schema(
  {
    label: String,
    name: String,
    statement: String,
    claims: [String],
  },
  subdocOpts,
);

const timelineSchema = new Schema(
  {
    at: String,
    event: String,
    detail: String,
  },
  subdocOpts,
);

const reportSchema = new Schema(
  {
    userId: String,
    reason: String,
    at: String,
  },
  subdocOpts,
);

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    notificationPrefs: { type: Schema.Types.Mixed, default: {} },
    privacy: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

const passwordResetSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    otpHash: { type: String, required: true, index: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

const caseSchema = new Schema(
  {
    ownerId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    summary: { type: String, required: true },
    situation: String,
    category: { type: String, required: true },
    personA: personSchema,
    personB: personSchema,
    desiredOutcome: String,
    privacy: { type: String, enum: ['private', 'invite-only', 'public'], default: 'private' },
    reviewAudience: { type: String, enum: ['invite-only', 'public'], default: 'invite-only' },
    displayName: String,
    evidence: { type: [Schema.Types.Mixed], default: [] }, // legacy inline list; uploads live in the Evidence collection
    status: { type: String, default: 'draft', index: true },
    idempotencyKey: { type: String, index: true },
    appeal: {
      reason: String,
      newInfo: String,
      at: String,
      status: String,
    },
    archivedAt: String,
    timeline: { type: [timelineSchema], default: [] },
  },
  { timestamps: true },
);
caseSchema.index({ ownerId: 1, idempotencyKey: 1 });

const evidenceSchema = new Schema(
  {
    caseId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    originalName: String,
    storedName: { type: String, required: true },
    mimeType: String,
    size: Number,
    description: String,
    // Serverless binary storage: on Vercel there is no persistent disk, so
    // file bytes live here. Local JSON-store deployments keep using the
    // upload directory and leave this empty.
    data: { type: Buffer, required: false },
  },
  { timestamps: true },
);

const assessmentSchema = new Schema(
  {
    caseId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    reason: String,
    status: { type: String, enum: ['pending', 'complete', 'failed'], default: 'pending', index: true },
    version: { type: Number, required: true },
    engine: String,
    model: String,
    outcomeCategory: String,
    sections: Schema.Types.Mixed,
    error: String,
    reports: { type: [reportSchema], default: [] },
    completedAt: String,
  },
  { timestamps: true },
);

const reviewSchema = new Schema(
  {
    caseId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    reviewerName: String,
    opinion: { type: String, required: true },
    reasoning: { type: String, required: true },
    missingEvidence: String,
    nextSteps: String,
    reports: { type: [reportSchema], default: [] },
  },
  { timestamps: true },
);
reviewSchema.index({ caseId: 1, userId: 1 }, { unique: true });

const invitationSchema = new Schema(
  {
    caseId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    email: String,
    note: String,
    tokenHash: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ['pending', 'accepted', 'expired'], default: 'pending' },
    expiresAt: { type: Date, required: true },
    acceptedBy: String,
    acceptedAt: String,
  },
  { timestamps: true },
);

const shareLinkSchema = new Schema(
  {
    caseId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    includeTitle: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const notificationSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    type: String,
    title: String,
    body: String,
    caseId: String,
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const User = mongoose.model('User', userSchema);
export const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);
export const Case = mongoose.model('Case', caseSchema);
export const Evidence = mongoose.model('Evidence', evidenceSchema);
export const Assessment = mongoose.model('Assessment', assessmentSchema);
export const Review = mongoose.model('Review', reviewSchema);
export const Invitation = mongoose.model('Invitation', invitationSchema);
export const ShareLink = mongoose.model('ShareLink', shareLinkSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
