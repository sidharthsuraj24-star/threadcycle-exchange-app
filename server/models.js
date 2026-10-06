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

const swapSchema = new Schema({
  requester: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  offeredListing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
  requestedListing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
  note: { type: String, default: '', trim: true, maxlength: 600 },
  handoffPreference: { type: String, enum: ['local', 'remote', 'flexible'], default: 'flexible' },
  status: { type: String, enum: ['requested', 'accepted', 'declined', 'withdrawn', 'completed', 'disputed'], default: 'requested', index: true },
  confirmedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
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

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Listing = mongoose.models.Listing || mongoose.model('Listing', listingSchema);
const Swap = mongoose.models.Swap || mongoose.model('Swap', swapSchema);
const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
module.exports = { User, Listing, Swap, Message };
