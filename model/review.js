const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "restaurant", required: true },
  userEmail: { type: String, required: true },
  userName: { type: String, required: true }, 
  rating: { type: Number, required: true },
  text: { type: String, required: true },
  date: { type: Date, default: Date.now },
});

const Review = mongoose.model("review", reviewSchema);

module.exports = { Review };