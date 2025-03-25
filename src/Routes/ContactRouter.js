var express = require('express');
var ContactController = require('../Controllers/ContactController')
var app = express();


app.get('/list' , function(req, res){

    ContactController.listContact(res , req.query)

})

app.get('/detail' , function (req, res){

    ContactController.getContactDetail(res , req.query)

})

module.exports = app ;