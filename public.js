const express = require("express");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const Room = require("../models/Room");
const Booking = require("../models/Booking");

const router = express.Router();
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

function dateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function nightsBetween(a, b) {
  return Math.round((b - a) / 86400000);
}

router.get("/rooms", async (req, res, next) => {
  try {
    const rooms = await Room.find({ active: true }).select("code name description pricePerNight totalUnits");
    res.json({ rooms });
  } catch (e) { next(e); }
});

router.get("/availability", async (req, res, next) => {
  try {
    const checkIn = dateOnly(req.query.checkIn);
    const checkOut = dateOnly(req.query.checkOut);
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      return res.status(400).json({ error: "Valid check-in and later check-out dates are required." });
    }
    const rooms = await Room.find({ active: true });
    const result = [];
    for (const room of rooms) {
      const overlapping = await Booking.countDocuments({
        room: room._id,
        status: { $in: ["pending_payment", "confirmed"] },
        $or: [{ holdExpiresAt: { $gt: new Date() } }, { status: "confirmed" }],
        checkIn: { $lt: checkOut },
        checkOut: { $gt: checkIn }
      });
      if (overlapping < room.totalUnits) {
        result.push({
          code: room.code, name: room.name, description: room.description,
          pricePerNight: room.pricePerNight, availableUnits: room.totalUnits - overlapping
        });
      }
    }
    res.json({ checkIn: req.query.checkIn, checkOut: req.query.checkOut, rooms: result });
  } catch (e) { next(e); }
});

router.post("/bookings/create-order", async (req, res, next) => {
  try {
    const { name, email, phone, roomCode, checkIn: ci, checkOut: co, guests } = req.body || {};
    const checkIn = dateOnly(ci), checkOut = dateOnly(co);
    const guestCount = Number(guests);
    if (!name || String(name).trim().length < 2 || !phone || !/^[0-9+\-\s]{8,18}$/.test(phone)) {
      return res.status(400).json({ error: "Enter a valid name and phone number." });
    }
    if (!checkIn || !checkOut || checkOut <= checkIn || checkIn < dateOnly(new Date().toISOString().slice(0,10))) {
      return res.status(400).json({ error: "Choose valid future check-in and check-out dates." });
    }
    if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 10) {
      return res.status(400).json({ error: "Guests must be between 1 and 10." });
    }
    const room = await Room.findOne({ code: roomCode, active: true });
    if (!room) return res.status(404).json({ error: "Room type not found." });

    const nights = nightsBetween(checkIn, checkOut);
    const amountPaise = Math.round(room.pricePerNight * nights * 100);
    if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) {
      return res.status(400).json({ error: "Invalid booking amount." });
    }

    // A short hold prevents most simultaneous checkout collisions. Availability is rechecked
    // immediately before creating the hold; for high-volume use, move this flow to a MongoDB
    // transaction with a per-room/per-night inventory collection.
    const now = new Date();
    const overlap = await Booking.countDocuments({
      room: room._id,
      status: { $in: ["pending_payment", "confirmed"] },
      $or: [{ holdExpiresAt: { $gt: now } }, { status: "confirmed" }],
      checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn }
    });
    if (overlap >= room.totalUnits) return res.status(409).json({ error: "This room is no longer available for those dates." });

    const bookingRef = "HS" + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString("hex").toUpperCase();
    const holdExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const booking = await Booking.create({
      bookingRef, customerName: String(name).trim(), customerEmail: String(email || "").trim(),
      customerPhone: String(phone).trim(), room: room._id, roomName: room.name,
      checkIn, checkOut, guests: guestCount, nights, amountPaise,
      currency: process.env.CURRENCY || "INR", holdExpiresAt
    });

    try {
      const order = await razorpay.orders.create({
        amount: amountPaise, currency: booking.currency,
        receipt: bookingRef,
        notes: { bookingRef, roomCode: room.code }
      });
      booking.razorpayOrderId = order.id;
      await booking.save();
      res.status(201).json({
        bookingRef, orderId: order.id, amount: amountPaise, currency: booking.currency,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        customer: { name: booking.customerName, email: booking.customerEmail, phone: booking.customerPhone },
        roomName: room.name, nights, expiresAt: holdExpiresAt
      });
    } catch (err) {
      booking.status = "payment_failed";
      booking.paymentStatus = "failed";
      await booking.save();
      throw err;
    }
  } catch (e) { next(e); }
});

router.post("/payments/verify", async (req, res, next) => {
  try {
    const { bookingRef, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!bookingRef || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment verification fields." });
    }
    const booking = await Booking.findOne({ bookingRef });
    if (!booking || booking.razorpayOrderId !== razorpay_order_id) {
      return res.status(404).json({ error: "Booking/order not found." });
    }
    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    const a = Buffer.from(expected), b = Buffer.from(razorpay_signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      booking.paymentStatus = "failed"; booking.status = "payment_failed"; await booking.save();
      return res.status(400).json({ error: "Payment signature verification failed." });
    }
    booking.paymentStatus = "paid";
    booking.status = "confirmed";
    booking.razorpayPaymentId = razorpay_payment_id;
    booking.paymentSignature = razorpay_signature;
    await booking.save();
    res.json({ success: true, bookingRef, status: booking.status, message: "Booking confirmed." });
  } catch (e) { next(e); }
});

module.exports = router;
