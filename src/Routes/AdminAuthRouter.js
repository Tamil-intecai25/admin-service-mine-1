const express = require("express");
const app = express();
const Admin = require("../Controllers/AdminAuthController");
const Validation = require("../Middlewares/Validators/AdminValidation");
const { check, validationResult } = require("express-validator");
//const { verifyAdminJwt } = require("../Middlewares/Middleware");
const Responder = require('../Helpers/Responder');

// Admin login
app.post("/login", Validation.login, (req, res) => {
  return Admin.login(req, res);
});

// Admin login
app.post("/two-fa-login", Validation.twoFALogin, (req, res) => {
  return Admin.twoFALogin(req, res);
});

//Admin Forget Password
app.post("/forget-password", Validation.validEmail, (req, res) => {
  return Admin.forgetPassword(req, res);
});

//User OTP Verify
app.post("/verify-otp", Validation.validOtp, (req, res) => {
  return Admin.verifyOtp(req, res);
});

//User Password Reset
app.post("/reset-password", Validation.validPass, (req, res) => {
  return Admin.resetPassword(req, res);
});

module.exports = app;
