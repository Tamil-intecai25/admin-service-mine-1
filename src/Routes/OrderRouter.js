const express = require("express");
const OrderController = require("../Controllers/OrderController");
const verifyToken = require("../Middlewares/verfication");
const app = express();

app.post('/place-order',verifyToken.verifyToken, function (req, res) {

    OrderController.placeOrder(req, res)

});

module.exports = app;
