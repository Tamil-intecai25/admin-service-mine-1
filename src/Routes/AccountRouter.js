var express = require("express");
var app = express();
var AccountController = require("../Controllers/AccountController");
const Utils = require('../Helpers/Utils')
app.get("/detail", function (req, res) {
  AccountController.accountDetail(res, req.query);
});

app.get("/list", function (req, res) {
  AccountController.listAccounts(res, req.query);
});

app.get("/balance", function (req, res) {
  AccountController.getAccountBalance(res, req?.query?.merchantId);
});

app.get("/overall/balance", function (req, res) {
  AccountController.getOverallBalance(res);
});

module.exports = app;
