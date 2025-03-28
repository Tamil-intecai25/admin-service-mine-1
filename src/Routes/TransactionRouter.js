const express = require("express");
const TransactionController = require("../Controllers/TransactionController");
const app = express();


app.get('/list', function (req, res) {

    TransactionController.TransactionList(res, req.query)

});

app.get('/detail', function (req, res) {

    TransactionController.TransactionDetail(res, req.query)

});

module.exports = app;
