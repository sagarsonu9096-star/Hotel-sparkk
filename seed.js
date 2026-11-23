require("dotenv").config();
const mongoose = require("mongoose");
const Room = require("./models/Room");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const rooms = [
    ["DELUXE", "Deluxe Room", 2500, 3],
    ["ROUND", "Round Bed Room", 2800, 1],
    ["PREMIUM", "Premium Room", 3200, 2],
    ["CLASSIC", "Classic Double Room", 2200, 3],
    ["STANDARD", "Standard Room", 1800, 4],
    ["COMFORT", "Comfort Room", 2000, 2]
  ];
  for (const [code, name, pricePerNight, totalUnits] of rooms) {
    await Room.updateOne({ code }, { $setOnInsert: { code, name, pricePerNight, totalUnits, active: true } }, { upsert: true });
  }
  console.log("Room types inserted. Review prices and quantities in MongoDB/admin API.");
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
