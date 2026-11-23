const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  pricePerNight: { type: Number, required: true, min: 1 },
  totalUnits: { type: Number, required: true, min: 1, default: 1 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Room", roomSchema);
