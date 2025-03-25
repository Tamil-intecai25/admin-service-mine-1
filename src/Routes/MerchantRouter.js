var express = require('express');
var MerchantController = require('../Controllers/MerchantController')
var AdminController = require('../Controllers/AdminController')
var app = express();
const AccountController = require('../Controllers/AccountController');
const IpController = require("../Controllers/MerchantKeysController");
const Utils = require("../Helpers/Utils");
const MerchantKeysController = require('../Controllers/MerchantKeysController');
const MerchantValidation = require('../Middlewares/Validators/MerchantValidation')

app.get('/list' , function (req, res){

    MerchantController.listMerchant(res, req.query)

})

app.get('/detail' , function (req, res){

    MerchantController.merchantDetails(res , req.query)

})

app.patch('/activateAccount', function (req, res) {
    AccountController.activateAccount(res, req.query.merchant_id)
  })

  app.patch("/merchant-status", (req, res) => {
    return AdminController.merchantStatus(req, res);
  });

app.post("/merchant-addip", MerchantValidation.addIpAddress , (req, res) => {
    return IpController.addIpAddress(res, req.body, Utils.getUserId(req));
});

app.get("/merchant-getip", (req, res) => {
  return IpController.getIpAddress(req, res);
});

app.patch("/merchant-updateip/:ip_id", (req, res) => {
  return IpController.updateIp(req, res);
});

app.get('/get-keys-list', (req, res) => {
  return MerchantKeysController.getMerchantKeys(res, req.query)
})

app.get('/get-keys-detail', (req, res) => {
  return MerchantKeysController.getMerchantKeyDetail(res, req.query)
})

app.post('/update/pricing-settings', (req, res) => {
  return MerchantController.updateMerchantSettings(res, req.body)
})

app.get('/get/pricing-settings', (req, res) => {
  return MerchantController.getMerchantSettings(res, req.query)
})

app.get('/get/range-detail', (req, res) => {
})

module.exports = app;