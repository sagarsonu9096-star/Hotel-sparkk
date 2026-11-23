const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Room = require("../models/Room");
const Booking = require("../models/Booking");
const adminOnly = require("../middleware/admin");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const validEmail = email && email === process.env.ADMIN_EMAIL;
  const validPassword = password && await bcrypt.compare(
    String(password), await bcrypt.hash(String(process.env.ADMIN_PASSWORD || "unset"), 10)
  );
  // Constant-time comparison is not needed for a local admin password, but never expose the password.
  if (!validEmail || !validPassword) return res.status(401).json({ error: "Invalid login." });
  const token = jwt.sign({ role: "admin", email }, process.env.JWT_SECRET, { expiresIn: "8h" });
  res.json({ token, expiresIn: "8h" });
});

router.use(adminOnly);

router.get("/dashboard", async (req, res, next) => {
  try {
    const [total, confirmed, pending, revenue] = await Promise.all([
      Booking.countDocuments(), Booking.countDocuments({ status: "confirmed" }),
      Booking.countDocuments({ status: "pending_payment", holdExpiresAt: { $gt: new Date() } }),
      Booking.aggregate([{ $match: { paymentStatus: "paid" } }, { $group: { _id: null, total: { $sum: "$amountPaise" } } }])
    ]);
    res.json({ totalBookings: total, confirmedBookings: confirmed, pendingPayments: pending, revenueRupees: (revenue[0]?.total || 0) / 100 });
  } catch (e) { next(e); }
});

router.get("/bookings", async (req, res, next) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 }).populate("room", "code name");
    res.json({ bookings });
  } catch (e) { next(e); }
});

router.patch("/bookings/:id/status", async (req, res, next) => {
  try {
    const allowed = ["confirmed", "cancelled"];
    if (!allowed.includes(req.body.status)) return res.status(400).json({ error: "Status must be confirmed or cancelled." });
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!booking) return res.status(404).json({ error: "Booking not found." });
    res.json({ booking });
  } catch (e) { next(e); }
});

router.post("/rooms", async (req, res, next) => {
  try {
    const { code, name, description, pricePerNight, totalUnits } = req.body || {};
    const room = await Room.create({ code, name, description, pricePerNight: Number(pricePerNight), totalUnits: Number(totalUnits) });
    res.status(201).json({ room });
  } catch (e) { next(e); }
});

router.patch("/rooms/:id", async (req, res, next) => {
  try {
    const allowed = ["name", "description", "pricePerNight", "totalUnits", "active"];
    const update = {};
    for (const key of allowed) if (req.body[key] !== undefined) update[key] = req.body[key];
    const room = await Room.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!room) return res.status(404).json({ error: "Room not found." });
    res.json({ room });
  } catch (e) { next(e); }
});

module.exports = router;
