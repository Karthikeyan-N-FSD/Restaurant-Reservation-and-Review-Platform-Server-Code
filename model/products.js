const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
    title: String,
    price: {
        type: Number,
        required: true
    }
});

const Product = mongoose.model("product", productSchema);

module.exports = { Product }