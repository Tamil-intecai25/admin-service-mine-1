const express = require("express");
const AnalyzeController = require("../Controllers/AnalyzeController");
const verifyToken = require("../Middlewares/verfication");
const app = express();

//*****for user*******

app.post("/bulk-upload", function (req, res) {
    AnalyzeController.bulkUpload(req, res);
});

module.exports = app;   
