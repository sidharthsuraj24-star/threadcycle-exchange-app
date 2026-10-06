const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 48 },
  email: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
  passwordHash: { type: String, select: false },
  city: { type: String, default: '', trim: true, maxlength: 60 },
  bio: { type: String, default: '', trim: true, maxlength: 300 },
  role: { type: String, enum: ['member', 'admin'], default: 'member' },
  suspended: { type: Boolean, default: false },
  isDemo: { type: Boolean, default: false },
  demoLabel: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

const imageSchema = new Schema({
  data: { type: Buffer, required: true },
  mime: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
  bytes: { type: Number, required: true }
}, { _id: false });

const listingSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 90 },
  category: { type: String, required: true, enum: ['Tops', 'Outerwear', 'Dresses', 'Bottoms', 'Shoes', 'Accessories', 'Bundle'] },
  size: { type: String, required: true, trim: true, maxlength: 24 },
  brand: { type: String, required: true, trim: true, maxlength: 60 },
  brandTier: { type: String, required: true, enum: ['Everyday', 'Premium', 'Designer', 'Unbranded'], default: 'Everyday' },
  condition: { type: String, required: true, enum: ['New with tags', 'Excellent', 'Good', 'Well loved'] },
  description: { type: String, required: true, trim: true, maxlength: 800 },
  city: { type: String, required: true, trim: true, maxlength: 60 },
  estimatedValue: { type: Number, required: true, min: 0, max: 50000 },
  comparableRetailPrice: { type: Number, min: 1, max: 10000000 },
  status: { type: String, enum: ['available', 'reserved', 'swapped', 'removed', 'hidden'], default: 'available', index: true },
  images: { type: [imageSchema], default: [], select: false },
  imageCount: { type: Number, default: 0 },
  demoImageNo: { type: Number, min: 1, max: 8 },
  demoKey: { type: String, sparse: true, unique: true },
  isDemo: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });
listingSchema.index({ category: 1, size: 1, city: 1, status: 1, createdAt: -1 });

const transitionSchema = new Schema({
  from: { type: String, enum: ['none', 'requested', 'accepted', 'declined', 'withdrawn', 'completed', 'disputed'], required: true },
  to: { type: String, enum: ['requested', 'accepted', 'declined', 'withdrawn', 'completed', 'disputed'], required: true },
  actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  at: { type: Date, required: true, default: Date.now }
}, { _id: false });
const agreementConfirmationSchema = new Schema({
  member: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  at: { type: Date, required: true, default: Date.now }
}, { _id: false });
const completionConfirmationSchema = new Schema({
  member: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  at: { type: Date, required: true, default: Date.now }
}, { _id: false });
const agreementSchema = new Schema({
  revision: { type: Number, required: true },
  terms: { type: String, required: true, maxlength: 1000 },
  proposedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  proposedAt: { type: Date, required: true, default: Date.now },
  confirmedBy: { type: [agreementConfirmationSchema], default: [] }
}, { _id: false });
const shipmentTransitionSchema = new Schema({
  from: { type: String, enum: ['not_started', 'dispatched', 'in_transit', 'delivered', 'issue', 'not_applicable'], required: true },
  to: { type: String, enum: ['not_started', 'dispatched', 'in_transit', 'delivered', 'issue', 'not_applicable'], required: true },
  actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  at: { type: Date, required: true, default: Date.now }
}, { _id: false });

const swapSchema = new Schema({
  requester: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  offeredListing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
  requestedListing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
  note: { type: String, default: '', trim: true, maxlength: 600 },
  handoffPreference: { type: String, enum: ['local', 'remote', 'flexible'], default: 'flexible' },
  status: { type: String, enum: ['requested', 'accepted', 'declined', 'withdrawn', 'completed', 'disputed'], default: 'requested', index: true },
  statusHistory: { type: [transitionSchema], default: [] },
  agreements: { type: [agreementSchema], default: [] },
  confirmedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  completionConfirmations: { type: [completionConfirmationSchema], default: [] },
  shipment: {
    serviceLabel: { type: String, default: '', maxlength: 80 },
    trackingReference: { type: String, default: '', maxlength: 120 },
    status: { type: String, enum: ['not_started', 'dispatched', 'in_transit', 'delivered', 'issue', 'not_applicable'], default: 'not_started' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedAt: { type: Date, default: null },
    history: { type: [shipmentTransitionSchema], default: [] }
  },
  adminNote: { type: String, default: '', maxlength: 600 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });
swapSchema.index({ requester: 1, recipient: 1, status: 1 });

const messageSchema = new Schema({
  swap: { type: Schema.Types.ObjectId, ref: 'Swap', required: true, index: true },
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  body: { type: String, required: true, trim: true, maxlength: 1200 },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });
messageSchema.index({ swap: 1, createdAt: 1 });

const activityEventSchema = new Schema({
  member: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true, enum: [
    'account_registered', 'profile_updated', 'listing_created', 'listing_updated', 'listing_removed',
    'swap_requested', 'swap_accepted', 'swap_declined', 'swap_withdrawn', 'message_sent',
    'agreement_proposed', 'agreement_confirmed', 'completion_confirmed', 'dispute_reported', 'shipment_updated'
  ] },
  createdAt: { type: Date, required: true, default: Date.now }
}, { versionKey: false });
activityEventSchema.index({ createdAt: 1, member: 1 });
activityEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 35 });

const rateLimitCounterSchema = new Schema({
  store: { type: String, required: true },
  key: { type: String, required: true },
  totalHits: { type: Number, required: true, min: 0 },
  resetTime: { type: Date, required: true },
  expiresAt: { type: Date, required: true }
}, { versionKey: false });
rateLimitCounterSchema.index({ store: 1, key: 1 }, { unique: true });
rateLimitCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Listing = mongoose.models.Listing || mongoose.model('Listing', listingSchema);
const Swap = mongoose.models.Swap || mongoose.model('Swap', swapSchema);
const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
const ActivityEvent = mongoose.models.ActivityEvent || mongoose.model('ActivityEvent', activityEventSchema);
const RateLimitCounter = mongoose.models.RateLimitCounter || mongoose.model('RateLimitCounter', rateLimitCounterSchema);
module.exports = { User, Listing, Swap, Message, ActivityEvent, RateLimitCounter };
