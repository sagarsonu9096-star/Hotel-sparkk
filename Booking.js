const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  bookingRef: { type: String, required: true, unique: true },
  customerName: { type: String, required: true, trim: true },
  customerEmail: { type: String, default: "", trim: true, lowercase: true },
  customerPhone: { type: String, required: true, trim: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
  roomName: { type: String, required: true },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  guests: { type: Number, required: true, min: 1, max: 10 },
  nights: { type: Number, required: true },
  amountPaise: { type: Number, required: true, min: 1 },
  currency: { type: String, default: "INR" },
  status: {
    type: String,
    enum: ["pending_payment", "confirmed", "cancelled", "payment_failed"],
    default: "pending_payment"
  },
  paymentStatus: { type: String, enum: ["created", "paid", "failed", "refunded"], default: "created" },
  razorpayOrderId: { type: String, default: "" },
  razorpayPaymentId: { type: String, default: "" },
  paymentSignature: { type: String, default: "" },
  holdExpiresAt: { type: Date, required: true }
}, { timestamps: true });

bookingSchema.index({ room: 1, checkIn: 1, checkOut: 1, status: 1 });
module.exports = mongoose.model("Booking", bookingSchema);
