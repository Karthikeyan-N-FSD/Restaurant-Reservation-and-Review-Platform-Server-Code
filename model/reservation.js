const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema({
  email: { type: String, required: true },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "restaurant", required: true },
  date: { type: String, required: true },
  timeSlot: { type: Number, required: true },
  guests: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Reservation = mongoose.model("reservation", reservationSchema);

module.exports = { Reservation };