//Require with Variable
const { ResMessage } = require("../Helpers/ResMessage");
const Responder = require("../Helpers/Responder");
const Utils = require("../Helpers/Utils");

//Models
const Admin = require("../Models/AdminModel");

function AdminService() {

  this.checkEmail = async (email, id) => {

        if (id != undefined)
            return await Admin.countDocuments({ userId: { $ne: id }, email: email });
        else
            return await Admin.countDocuments({ email: email });

    }

    this.checkPhone = async (phone, id) => {
        
        if (id != undefined)
            return await Admin.countDocuments({ userId: { $ne: id }, "phone.number": phone });
        else
            return await Admin.countDocuments({ phone: phone });
    }

  this.updateUserDetails = async (query, fields) => await Admin.findOneAndUpdate(query, fields);

  this.userDetails = async (query, fields) => await Admin.findOne(query, fields);

  this.adminList = async (query,fields,page,limit) => await Admin.find(query, fields).paginate(page, limit).sort({ _id: -1 });

  // Find subUser details
    this.subUserDetails = async (Id, parentId, fields) => await Admin.findOne({ userId : Id, "hasDeleted": false, parentId: parentId  }, fields);

  //Get User Common
  this.getUser = async (query, select) => {
    return await Admin.findOne(query, select);
  };
  // Check Email Exist
  this.checkUserEmailExists = async (condition) =>
    !!(await Admin.countDocuments(condition));

  // Check Phone Exist
  this.checkUserPhoneExists = async (phone) =>
     !!(await Admin.countDocuments(phone));
   
  //check update phone Exist
  this.updatePhoneExists = async (userId, phone) =>
    !!(await Admin.countDocuments({ userId: { $ne: userId }, phone: phone }));

  //Check Password Exists
  this.checkPasswordExists = async (userId, password) => {
    const credential = await Admin.findOne(
      {
        userId,
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

module.exports = new AdminService();
