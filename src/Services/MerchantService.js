<<<<<<< HEAD
//Require with Variable
const { ResMessage } = require("../Helpers/ResMessage");
const Responder = require("../Helpers/Responder");
const Utils = require("../Helpers/Utils");
const mongoose = require("mongoose");
require("mongoose-pagination");

//Models
const Merchant = require("../Models/MerchantModel");

function MerchantService() {

  this.checkEmail = async (email, id) => {

        if (id != undefined)
            return await Merchant.countDocuments({ merchantId: { $ne: id }, email: email });
        else
            return await Merchant.countDocuments({ email: email });

    }

    this.checkPhone = async (phone, id) => {
        
        if (id != undefined)
            return await Merchant.countDocuments({ merchantId: { $ne: id }, "phone.number": phone });
        else
            return await Merchant.countDocuments({ phone: phone });
    }

    this.checkEntityType = async (entityType, id) => {

        if (id != undefined)
            return await Merchant.countDocuments({ merchantId: { $ne: id }, entityType: entityType });
        else
            return await Merchant.countDocuments({ entityType: entityType });
    }

    this.checkIndustryType = async (industryType, id) => {

        if (id != undefined)
            return await Merchant.countDocuments({ merchantId: { $ne: id }, industryType: industryType });
        else
            return await Merchant.countDocuments({ industryType: industryType });
    }

  //Get User Common
  this.getUser = async (query, select) => {
    return await Merchant.findOne(query, select);
  };

  // Find subUser details
    this.Details = async (Id, parentUser, fields) =>
        await Merchant.findOne(
          {
            merchantId: Id,
            hasDeleted: false,
          },
          fields
        );

  this.updateMerchantDetails = async (query, fields) => await Merchant.findOneAndUpdate(query, fields);

  this.merchantList = async (query,fields,page,limit) => await Merchant.find(query, fields).paginate(page, limit).sort({ _id: -1 });

  // Check Email Exist
  this.checkUserEmailExists = async (condition) =>
    !!(await Merchant.countDocuments(condition));

  // Check Phone Exist
  this.checkUserPhoneExists = async (phone) =>
    !!(await Merchant.countDocuments({"phone.number" : phone}));

  // Check Account Number Exist
  this.checkAccountNumExists = async (bankDetails) =>
    !!(await Merchant.countDocuments({ "bankDetails.accountNumber": bankDetails }));

  // Check Beneficiary Exist
  this.checkBeneficiaryExists = async (bankDetails) =>
    !!(await Merchant.countDocuments({ "bankDetails.beneficiaryName": bankDetails }));

  // Check Ifsc Exist
  this.checkIfscExists = async (bankDetails) =>
    !!(await Merchant.countDocuments({ "bankDetails.ifsc": bankDetails }));

  //check update phone Exist
  this.updatePhoneExists = async (merchantId, phone) =>
    !!(await Merchant.countDocuments({
      merchantId: { $ne: merchantId },
      phone: phone,
    }));

  //Check Password Exists
  this.checkPasswordExists = async (merchantId, password) => {
    const credential = await Merchant.findOne(
      {
        merchantId,
        "credentials.status": false,
      },
      "credentials"
    );

    var isExists = false;
    for (let index = 0; index < credential?.credentials.length; index++) {
      if (
        await Utils.checkPassword(
          password,
          credential.credentials[index].password
        )
      ) {
        isExists = true;
        break;
      }
    }
    return isExists;
  };

  this.merchantDetails = async (query, fields) => await Merchant.findOne(query, fields);

  //Login Fraud Attempts
  this.loginFraudAttempts = async (res, loggedUser) => {
    loggedUser.loginAttempt.attemptCount += 1;
    loggedUser.loginAttempt.lastAttempt = Utils.getCurrentDate;
    await loggedUser.save();
    return Responder.sendFailure(res, ResMessage[109], 200);
  };

  //Check the Login process unlocked
  this.checkLoginAttempt = async (loggedUser) => {
    const count = loggedUser?.loginAttempt?.attemptCount ?? 0;
    if (count < 5) return true;
    else if (
      count > 4 &&
      Utils.getCurrentDate.getTime() >
        loggedUser.loginAttempt.lastAttempt.getTime()
    ) {
      loggedUser.loginAttempt.attemptCount = 0;
      await loggedUser.save();
      return true;
    } else {
      return false;
    }
  };
}

module.exports = new MerchantService();
=======
//Require with Variable
const { ResMessage } = require("../Helpers/ResMessage");
const Responder = require("../Helpers/Responder");
const Utils = require("../Helpers/Utils");
const mongoose = require("mongoose");
require("mongoose-pagination");

//Models
const Merchant = require("../Models/MerchantModel");

function MerchantService() {

  this.checkEmail = async (email, id) => {

        if (id != undefined)
            return await Merchant.countDocuments({ merchantId: { $ne: id }, email: email });
        else
            return await Merchant.countDocuments({ email: email });

    }

    this.checkPhone = async (phone, id) => {
        
        if (id != undefined)
            return await Merchant.countDocuments({ merchantId: { $ne: id }, "phone.number": phone });
        else
            return await Merchant.countDocuments({ phone: phone });
    }

    this.checkEntityType = async (entityType, id) => {

        if (id != undefined)
            return await Merchant.countDocuments({ merchantId: { $ne: id }, entityType: entityType });
        else
            return await Merchant.countDocuments({ entityType: entityType });
    }

    this.checkIndustryType = async (industryType, id) => {

        if (id != undefined)
            return await Merchant.countDocuments({ merchantId: { $ne: id }, industryType: industryType });
        else
            return await Merchant.countDocuments({ industryType: industryType });
    }

  //Get User Common
  this.getUser = async (query, select) => {
    return await Merchant.findOne(query, select);
  };

  // Find subUser details
    this.Details = async (Id, parentUser, fields) =>
        await Merchant.findOne(
          {
            merchantId: Id,
            hasDeleted: false,
          },
          fields
        );

  this.updateMerchantDetails = async (query, fields) => await Merchant.findOneAndUpdate(query, fields);

  this.merchantList = async (query,fields,page,limit) => await Merchant.find(query, fields).paginate(page, limit).sort({ _id: -1 });

  // Check Email Exist
  this.checkUserEmailExists = async (condition) =>
    !!(await Merchant.countDocuments(condition));

  // Check Phone Exist
  this.checkUserPhoneExists = async (phone) =>
    !!(await Merchant.countDocuments({"phone.number" : phone}));

  // Check Account Number Exist
  this.checkAccountNumExists = async (bankDetails) =>
    !!(await Merchant.countDocuments({ "bankDetails.accountNumber": bankDetails }));

  // Check Beneficiary Exist
  this.checkBeneficiaryExists = async (bankDetails) =>
    !!(await Merchant.countDocuments({ "bankDetails.beneficiaryName": bankDetails }));

  // Check Ifsc Exist
  this.checkIfscExists = async (bankDetails) =>
    !!(await Merchant.countDocuments({ "bankDetails.ifsc": bankDetails }));

  //check update phone Exist
  this.updatePhoneExists = async (merchantId, phone) =>
    !!(await Merchant.countDocuments({
      merchantId: { $ne: merchantId },
      phone: phone,
    }));

  //Check Password Exists
  this.checkPasswordExists = async (merchantId, password) => {
    const credential = await Merchant.findOne(
      {
        merchantId,
        "credentials.status": false,
      },
      "credentials"
    );

    var isExists = false;
    for (let index = 0; index < credential?.credentials.length; index++) {
      if (
        await Utils.checkPassword(
          password,
          credential.credentials[index].password
        )
      ) {
        isExists = true;
        break;
      }
    }
    return isExists;
  };

  this.merchantDetails = async (query, fields) => await Merchant.findOne(query, fields);

  //Login Fraud Attempts
  this.loginFraudAttempts = async (res, loggedUser) => {
    loggedUser.loginAttempt.attemptCount += 1;
    loggedUser.loginAttempt.lastAttempt = Utils.getCurrentDate;
    await loggedUser.save();
    return Responder.sendFailure(res, ResMessage[109], 200);
  };

  //Check the Login process unlocked
  this.checkLoginAttempt = async (loggedUser) => {
    const count = loggedUser?.loginAttempt?.attemptCount ?? 0;
    if (count < 5) return true;
    else if (
      count > 4 &&
      Utils.getCurrentDate.getTime() >
        loggedUser.loginAttempt.lastAttempt.getTime()
    ) {
      loggedUser.loginAttempt.attemptCount = 0;
      await loggedUser.save();
      return true;
    } else {
      return false;
    }
  };
}

module.exports = new MerchantService();
>>>>>>> origin/dev
