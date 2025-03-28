<<<<<<< HEAD
const express = require("express");
const ZoneController = require("../Controllers/ZoneController");
const verifyToken = require("../Middlewares/verfication");
const app = express();


app.post('/create-zone', function (req, res) {

    ZoneController.createZone(res, req)

});

app.post('/create-user', function (req, res) {

    ZoneController.createUser(req, res)

});

app.post('/create-area', function (req, res) {

    ZoneController.createOrUpdateArea(res, req)

});

app.get('/find-sellers', function (req, res) {

    ZoneController.findZonesContainingUser(res, req)

});

app.post('/create-seller', function (req, res) {

    ZoneController.createSeller(res, req)

});

app.post('/create-partner', function (req, res) {

    ZoneController.createPartner(res, req)

});

app.post('/find-delivery-partner', function (req, res) {

    ZoneController.findZonesContainingDeliveryPartner(res, req)

});

app.get('/get-area', function (req, res) {

    ZoneController.getArea(res, req)

});

app.get('/get-zone', function (req, res) {

    ZoneController.getZone(res, req)

});

app.patch('/update-all-area', function (req, res) {

    ZoneController.allAreasUpdate(req, res)

});

app.patch('/multiple-all-area', function (req, res) {

    ZoneController.multipleMapingUpdate(req, res)

});

app.post('/send-otp-user', function (req, res) {

    ZoneController.sendOtp(req, res)

});

app.post('/verify-otp-user', function (req, res) {

    ZoneController.verifyOtp(req, res)

});

app.post('/update-user-details',verifyToken.verifyToken, function (req, res) {

    ZoneController.updateUserDetails(req, res)

});

app.post('/verify-otp-seller', function (req, res) {

    ZoneController.verifyOtp(req, res, "seller")

});

app.post('/send-otp-seller', function (req, res) {

    ZoneController.sendOtp(req, res, "seller")

});

app.post('/add-category-seller',verifyToken.verifyToken, function (req, res) {

    ZoneController.categoryAddFromSeller(req, res)

});

app.post('/add-subcategory-seller',verifyToken.verifyToken, function (req, res) {

    ZoneController.subCategoryAddFromSeller(req, res)

});

app.get('/get-category-seller/:sellerId',verifyToken.verifyToken, function (req, res) {

    ZoneController.getCategoriesBySeller(req, res)

});

app.get('/get-subcategory-seller/:sellerId/:categoryId',verifyToken.verifyToken, function (req, res) {

    ZoneController.getSubcategoriesBySeller(req, res)

});


module.exports = app;
=======
const express = require("express");
const ZoneController = require("../Controllers/ZoneController");
const verifyToken = require("../Middlewares/verfication");
const app = express();


app.post('/create-zone', function (req, res) {

    ZoneController.createZone(res, req)

});

app.post('/create-user', function (req, res) {

    ZoneController.createUser(req, res)

});

app.post('/create-area', function (req, res) {

    ZoneController.createOrUpdateArea(res, req)

});

app.get('/find-sellers', function (req, res) {

    ZoneController.findZonesContainingUser(res, req)

});

app.post('/create-seller', function (req, res) {

    ZoneController.createSeller(res, req)

});

app.post('/create-partner', function (req, res) {

    ZoneController.createPartner(res, req)

});

app.post('/find-delivery-partner', function (req, res) {

    ZoneController.findZonesContainingDeliveryPartner(res, req)

});

app.get('/get-area', function (req, res) {

    ZoneController.getArea(res, req)

});

app.get('/get-zone', function (req, res) {

    ZoneController.getZone(res, req)

});

app.patch('/update-all-area', function (req, res) {

    ZoneController.allAreasUpdate(req, res)

});

app.patch('/multiple-all-area', function (req, res) {

    ZoneController.multipleMapingUpdate(req, res)

});

app.post('/send-otp-user', function (req, res) {

    ZoneController.sendOtp(req, res)

});

app.post('/verify-otp-user', function (req, res) {

    ZoneController.verifyOtp(req, res)

});

app.post('/update-user-details',verifyToken.verifyToken, function (req, res) {

    ZoneController.updateUserDetails(req, res)

});

app.post('/verify-otp-seller', function (req, res) {

    ZoneController.verifyOtp(req, res, "seller")

});

app.post('/send-otp-seller', function (req, res) {

    ZoneController.sendOtp(req, res, "seller")

});

app.post('/add-category-seller',verifyToken.verifyToken, function (req, res) {

    ZoneController.categoryAddFromSeller(req, res)

});

app.post('/add-subcategory-seller',verifyToken.verifyToken, function (req, res) {

    ZoneController.subCategoryAddFromSeller(req, res)

});

app.get('/get-category-seller/:sellerId',verifyToken.verifyToken, function (req, res) {

    ZoneController.getCategoriesBySeller(req, res)

});

app.get('/get-subcategory-seller/:sellerId/:categoryId',verifyToken.verifyToken, function (req, res) {

    ZoneController.getSubcategoriesBySeller(req, res)

});


module.exports = app;
>>>>>>> origin/dev
