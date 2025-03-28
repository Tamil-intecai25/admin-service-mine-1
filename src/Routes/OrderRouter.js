const express = require("express");
const OrderController = require("../Controllers/OrderController");
const verifyToken = require("../Middlewares/verfication");
const app = express();

//*****for user*******

app.post("/place-order", verifyToken.verifyToken, function (req, res) {
  OrderController.placeOrder(req, res);
});

//*****for seller*******

app.get("/seller/get-orders", function (req, res) {
  OrderController.getOrdersBySellerId(req, res);
});

app.post("/seller/accept-order", function (req, res) {
  OrderController.acceptOrderForSeller(req, res);
});

//*****for delivery-partners*******

app.get("/partner/get-orders", function (req, res) {
  OrderController.getOrdersByPartnerId(req, res);
});

app.post("/partner/accept-order", function (req, res) {
  OrderController.acceptOrderForPartner(req, res);
});

app.post("/partner/pickup-order", function (req, res) {
  OrderController.acceptOrderForPartner(req, res);
});

module.exports = app;
