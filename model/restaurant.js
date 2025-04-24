const mongoose = require("mongoose");

const restaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rating: { type: Number, required: true },
  ratingCount: { type: Number, required: true },
  cuisines: { type: [String], required: true },
  priceForTwo: { type: Number, required: true },
  address: { type: String, required: true },
  location: { type: String, required: true },
  openingTime: { type: String, required: true },
  closingTime: { type: String, required: true },
  phone: { type: String, required: true },
  mainImage: { type: String },
  otherImages: { type: [String] },
  menuImages: { type: [String] },
  timeSlots: { type: [Number] },
  direction: { type: String },
  info: { type: [String] },
  totalSeats: { type: Number },
});

const Restaurant = mongoose.model("restaurant", restaurantSchema);

module.exports = { Restaurant };