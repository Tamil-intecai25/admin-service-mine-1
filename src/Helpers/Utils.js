let request = require("request");
const { customAlphabet } = require("nanoid");
let Config = require("../Configs/Config");
let ejs = require("ejs");
let emailClient = require("elasticemail");
let client = emailClient.createClient({
  username: "info@ippopay.com",
  apiKey: "c802e30d-7ea8-4ecf-b993-1ba53959f872",
});
let keygen = require("keygenerator");
let shortid = require("shortid");
shortid.characters(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ@!"
);
const password = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  7
);
// let AdminModel = require('../Models/ExAdminModel').getAdminModel();
let jwt = require("jsonwebtoken");
let Responder = require("../Helpers/Responder");
const AreaModel = require("../Models/AreaModel");
const SellerModel = require("../Models/SellerModel");
const PartnerModel = require("../Models/PartnerModel");
let { ResMessage } = require("../Helpers/ResMessage");
let moment = require("moment");
let bcrypt = require("bcrypt");
const nanoid = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  10
);

// const { password } = require('keygenerator/lib/keygen');

// const MerchantModel = require("../Models/MerchantModel");
// const MenuMasterModel = require("../Models/MenuMasterModel").getMenuMasterModel();
// const AdminModel = require("../Models/AdminModel");
// const RoleModel = require('../Models/RoleModel').getRoleModel();
// const MenuMapModel = require("../Models/MenuMapModel").getMenuMapModel();

function Utils() {
  let self = this;

  this.sendOtp = async (phoneNumber) => {
    const user = await Admin.auth().createUser({ phoneNumber });
    console.log("OTP sent to:", phoneNumber);
  };

  this.findZonesContainingUser = async function (res, req) {
    try {
      // console.log(req.query);return;

      let userLat = parseFloat(req.query.lat);
      let userLong = parseFloat(req.query.long);

      // console.log(typeof userLong);return;

      if (!userLat || !userLong) {
        return Responder.sendFailure(
          res,
          "Latitude and Longitude are required",
          400
        );
      }

      // Step 1: Find the area where user's lat-long falls in
      let allAreas = await AreaModel.find();
      let matchedZoneId = null;

      for (const area of allAreas) {
        let polygon = area.polygoneLatelong.map((coord) => [
          coord.lat,
          coord.lng,
        ]);
        // console.log("polygon",polygon,"polygon");return;
        // console.log(Utils.isPointInPolygon([userLat, userLong], polygon),"IAMM");return;
        if (this.isPointInPolygon([userLat, userLong], polygon)) {
          matchedZoneId = area.zoneId;
          break;
        }
      }

      if (!matchedZoneId) {
        return Responder.sendFailure(
          res,
          "No zones found for the given location",
          404
        );
      }

      let zoneAreas = await AreaModel.find({ zoneId: matchedZoneId });

      let sellersInZone = [];

      for (const zoneArea of zoneAreas) {
        let areaPolygon = zoneArea.polygoneLatelong.map((coord) => [
          coord.lat,
          coord.lng,
        ]);

        let sellers = await SellerModel.find({
          "location.branch.lat": { $exists: true },
          "location.branch.long": { $exists: true },
        });

        sellers.forEach((seller) => {
          let sellerLat = seller.location.branch.lat;
          let sellerLong = seller.location.branch.long;

          if (this.isPointInPolygon([sellerLat, sellerLong], areaPolygon)) {
            sellersInZone.push(seller);
          }
        });
      }

      if (sellersInZone.length > 0) {
        return sellersInZone;
      } else {
        return Responder.sendFailure(
          res,
          "No sellers found inside the zone",
          404
        );
      }
    } catch (error) {
      console.error("Error finding zones and sellers:", error);
      return Responder.sendFailure(res, "Something went wrong", 500);
    }
  };

  this.calculateDistance = function (lat1, lon1, lat2, lon2) {
    const toRadians = (degree) => (degree * Math.PI) / 180;

    const R = 6371; // Radius of the Earth in kilometers
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in kilometers
  };

  this.isPointInPolygon = function (point, polygon) {
    let [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      let [xi, yi] = polygon[i];
      let [xj, yj] = polygon[j];

      let intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  };

  this.convertSecondsToMinutes = function (seconds) {
    let minutes = Math.floor(seconds / 60); // Get whole minutes
    let remainingSeconds = seconds % 60; // Get remaining seconds
    return `${minutes} min${minutes !== 1 ? "s" : ""} ${
      remainingSeconds > 0 ? remainingSeconds + " sec" : ""
    }`;
  };

  const axios = require("axios");

  this.findZonesContainingDeliveryPartner = async function (res, req) {
    try {
      let sellerLat = req.body.lat; 
      let sellerLong = req.body.long;

      if (!sellerLat || !sellerLong) {
        return Responder.sendFailure(
          res,
          "Latitude and Longitude are required",
          400
        );
      }

      // Step 1: Find the Area ID where the seller's location falls
      let allAreas = await AreaModel.find();
      let matchedArea = allAreas.find((area) =>
        this.isPointInPolygon(
          [sellerLat, sellerLong],
          area.polygoneLatelong.map((coord) => [coord.lat, coord.lng])
        )
      );

      if (!matchedArea) {
        return undefined;
      }

      let zoneId = matchedArea.zoneId;

      // Step 2: Get all areas mapped to the same Zone ID
      let mappedAreas = await AreaModel.find({ zoneId });

      // Step 3: Get all partners in these mapped areas
      let partnersInZone = [];
      for (const area of mappedAreas) {
        let areaPolygon = area.polygoneLatelong.map((coord) => [
          coord.lat,
          coord.lng,
        ]);

        let partners = await PartnerModel.find({
          "location.lat": { $exists: true },
          "location.long": { $exists: true },
        });

        partners.forEach((partner) => {
          let partnerLat = partner.location.lat;
          let partnerLong = partner.location.long;
          if (this.isPointInPolygon([partnerLat, partnerLong], areaPolygon)) {
            partnersInZone.push(partner);
          }
        });
      }

      if (partnersInZone.length === 0) {
        return Responder.sendFailure(
          res,
          "No delivery partners found in this zone",
          404
        );
      }

      // Step 4: Find the nearest delivery partner using Google Distance Matrix API
      let destinations = partnersInZone
        .map((partner) => `${partner.location.lat},${partner.location.long}`)
        .join("|");

      let googleMapsAPIKey = "AIzaSyBdgzn86CxjJDfA5PHD6Wq07a6Dlyh7F0s";

      let distanceMatrixUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${sellerLat},${sellerLong}&destinations=${destinations}&key=${googleMapsAPIKey}`;

      let distanceResponse = await axios.get(distanceMatrixUrl);

      let distances = distanceResponse.data.rows[0].elements;

      console.log(distances, "...................>distances");

      let nearestPartner = null;
      let minDistance = Infinity;

      partnersInZone.forEach((partner, index) => {
        let distance = distances[index].distance?.value || Infinity;
        if (distance < minDistance) {
          minDistance = distance;
          console.log(distance, "----------->dis");
          nearestPartner = { partner, ...distances[index] };
        }
      });

      if (!nearestPartner) {
        return Responder.sendFailure(res, "No nearby partner found", 404);
      }

      // // Step 5: Get directions and ETA using Google Directions API
      // let directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${sellerLat},${sellerLong}&destination=${nearestPartner.location.lat},${nearestPartner.location.long}&key=${googleMapsAPIKey}`;

      // let directionsResponse = await axios.get(directionsUrl);

      // console.log(directionsResponse, "------------->direction response");
      // let routeData = directionsResponse.data.routes[0];

      // console.log(routeData, "routeData=>>>>>>>>>>>>>>>>>>>>>");
      // let eta = routeData.legs[0].duration.text; // Estimated time of arrival
      // let distanceText = routeData.legs[0].distance.text; // Distance in km/miles
      // let steps = routeData.legs[0].steps.map((step) => step.html_instructions); // Step-by-step directions

      // console.log(
      //   eta,
      //   distanceText,
      //   steps,
      //   "---------------------------------->all"
      // );

      return {
        nearestPartner,
        allPartners: partnersInZone,
        // eta,
        // distance: distanceText,
        // directions: steps,
      };
    } catch (error) {
      console.error("Error finding nearest partner:", error);
      return Responder.sendFailure(res, "Something went wrong", 500);
    }
  };

  this.createUserInKong = function (username, callback) {
    request.post(
      {
        url: Config.KONG_API,
        form: {
          username: username,
        },
      },
      function (error, response, body) {
        console.log("1", error);
        if (body && !error) {
          assignAclGroup(username);
          callback(null, { success: true });
          // self.generateAuthToken(username, callback);
        } else callback(error, null);
      }
    );
  };

  let assignAclGroup = function (user) {
    request.post({
      url: Config.KONG_API + user + "/acls",
      form: {
        group: "store",
      },
    });
  };

  this.generatePublicKey = function () {
    return (
      "pk_" +
      "dev" +
      "_" +
      keygen._({
        length: 12,
      })
    );
  };

  this.generateSecretKey = function () {
    return (
      "sk_" +
      "dev" +
      "_" +
      keygen._({
        length: 40,
      })
    );
  };

  this.generateAuthToken = async (user) => {
    const token = await jwt.sign({ user }, Config.secretKey.jwt_secret_key);
    return token;
  };

  this.getRandomNumber = function () {
    return Math.floor(Math.random() * 899999 + 100000);
  };

  this.createBeneficiaryCode = function () {
    return Math.floor(Math.random() * 8999999999 + 1000000000);
  };

  this.getUserId = function (req) {
    return req.headers["x-consumer-username"].split("_")[1];
  };

  this.getUser_Id = function (req) {
    return req.headers["x-consumer-username"];
  };

  this.getUser = async (req) => {
    let userId = this.getUserId(req);
    let roleUser = await AdminModel.findOne({
      userId,
      hasDeleted: { $ne: true },
    });
    return roleUser;
  };
  this.getMerchant = async (req) => {
    let merchantId = this.getUserId(req);
    console.log(merchantId, "hsdjkhskdsh");
    let roleUser = await MerchantModel.findOne({
      merchantId,
      hasDeleted: { $ne: true },
    });
    return roleUser;
  };

  this.getTransactionId = function () {
    return Math.floor(Math.random() * 8999999999 + 1000000000);
  };

  this.getShortId = function () {
    return shortid.generate();
  };

  this.getBeneCode = function () {
    // return shortid.generate();
    return Math.floor(Math.random() * 899999999 + 100000000);
  };

  this.getmerchantId = function () {
    return Math.floor(Math.random() * 8999999 + 1000000);
  };

  this.getBankDetails = function () {};

  this.beneficiary = function (data, callback) {
    let benificiary = {
      maintainBene: {
        CustId: "12576171",

        BeneficiaryCd: data.beneficiary_id,

        SrcAccountNo: "059481400004339",

        PaymentType: "OTHR",

        BeneName: data.name.full,

        BeneType: "V",

        CurrencyCd: "INR",

        BankName: data.bank_info.name,

        IfscCode: data.bank_info.ifsc,

        BeneAccountNo: data.bank_info.acc_no,

        Action: "ADD",
      },
    };
    let options = {
      url: "https://storeapi.ippopay.com/api/v2/upi/benificiary/addBeneficiary",

      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(benificiary),
    };
    request.post(options, function (error, response, body) {
      console.log("error", error, "Body", body);
      callback(error, response, body);
    });
  };

  this.createBeneficiarynew = function (data, callback) {
    //console.log(bank_info)
    let beneficiary = {
      merchantId: data.merchantId,
      acc_number: data.account.number,
      ifsc: data.account.ifsc,
      name: data.bank_info.account_holder_name,
      bank_id: "12576171",
      request_id: self.createBeneficiaryCode(),
      product: "stack",
      bene_type: "master",
    };
    console.log("Data", data, beneficiary);
    //   console.log(auth)
    let options = {
      url: "http://172.31.41.195:7001/api/bank/yes/ft/beneficiary/add",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(beneficiary),
    };
    console.log(options);
    request.post(options, function (error, response, body) {
      console.log("error", error, "Body", body);
      callback(error, response, body);
    });
  };

  this.generateId = function () {
    return nanoid();
  };

  this.validateCaptcha = function (captcha, callback) {
    let options = {
      url:
        Config.CAPTCHA.URL +
        "?secret=" +
        Config.CAPTCHA.SECRET_KEY +
        "&response=" +
        captcha,
    };
    console.log(options);
    request.post(options, function (err, response, body) {
      body = JSON.parse(body);
      console.log(body);
      callback(body);
    });
  };

  this.sendMail = function (email, otp, merchant, callback) {
    let data = {
      merchant: {
        verification_code: otp,
        name: merchant.name.full,
      },
    };
    ejs.renderFile(
      "./Helpers/emailtemplates/register.html",
      data,
      {},
      function (err, html) {
        console.log(err);
        if (!err && html) {
          let msg = {
            from: "info@ippopay.com",
            from_name: "Ippopay",
            to: email,
            subject: "Verify your account and to set password",
            body_html: html,
          };
          console.log(msg);
          client.mailer.send(msg, function (err, result) {
            console.log("mailer", err, result);
            callback(err, result);
          });
        }
      }
    );
  };

  this.storetransfer = function (data, callback) {
    console.log("Data", data);
    let tr = {
      username: "12576171",
      password: "XWBY91gfkh",
      transfer: data,
    };
    // let username = (query.username)? query.username :"12576171"
    //  let password = (query.password)? query.password :"VABD51uqdk"
    //auth = "Basic " + new Buffer(username + ":" + password).toString("base64");
    // console.log(username , password ,auth)
    let options = {
      url: "https://storeapi.ippopay.com/api/v2/upi/direct/transfer",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tr),
    };
    console.log(options);
    request.post(options, function (error, response, body) {
      //console.log("error" , error , "Body" , body , "response" , response)
      callback(error, response, body);
      // return Responder.sendSuccessData(res, "Transfer initiated" , {err : err , resp : resp , body : body})
    });
  };

  this.checkMenuAccess = async (roleCode, menuId) => {
    let role = await RoleModel.findOne({
      roleCode,
      status: "active",
      hasDeleted: { $ne: true },
    });

    if (roleCode === "SUPERADMIN11") return true;
    if (!role) return false;

    let haveMenuAccess;

    let menu = await MenuMasterModel.findOne({
      menuId,
      hasDeleted: { $ne: true },
    });

    if (menu.menuType == "merchant") return true;

    if (menu.isParentMenu == true) {
      let childMenus = await MenuMasterModel.find(
        { parentId: menuId, hasDeleted: { $ne: true } },
        "menuId -_id"
      );
      childMenus = await childMenus.map((childMenu) => childMenu.menuId);
      console.log(childMenus, menuId, "skljdhdjsh");
      haveMenuAccess = await MenuMapModel.findOne({
        roleId: role.roleId,
        menuId: { $in: childMenus },
      });
    } else
      haveMenuAccess = await MenuMapModel.findOne({
        roleId: role.roleId,
        menuId,
      });

    if (!haveMenuAccess) return false;
    else return true;
  };

  this.transferDomesticnew = function (data, callback) {
    //   65.2.20.236:17000/api/bank/yes/ft/transfer/request
    let options = {
      url: "http://172.31.41.195:17000/api/bank/yes/ft/transfer/request",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    };
    request.post(options, function (error, response, body) {
      console.log("error", error, "Body", body);
      callback(error, response, body);
    });
  };

  this.getTransferResponseObjectNew = function (data) {
    console.log(data);
    let transfer_response = {
      yes: {
        ConsentId: data.Data.ConsentId,
        transaction_identification:
          data.Data.Initiation.InstructionIdentification,
        status: data.Data.Status,
        status_updatedTime: data.Data.StatusUpdateDateTime,
        status_createdTime: data.Data.CreationDateTime,
        intruction_identification:
          data.Data.Initiation.InstructionIdentification,
        amount: data.Data.Initiation.InstructedAmount.Amount,
        transfer_type: data.Data.Initiation.ClearingSystemIdentification,
        creditor_benificiarycode:
          data.Data.Initiation.CreditorAccount.BeneficiaryCode,
      },
    };
    return transfer_response;
  };

  this.checkLoginAttempt = async (login) =>
    login?.loginProceed === true ? true : false;

  this.checkPassword = async (plain, hashPassword) =>
    await bcrypt.compare(plain, hashPassword);

  this.checkPasswordPattern = (password) => {
    if (password.length < 8) return "Password must be 8 characters";
    else if (!/^(?=.*[0-9]).{1}.*$/.test(password))
      return "Enter at least one number";
    else if (!/^(?=.*[a-z]).{1}.*$/.test(password))
      return "Enter at least one lower case character";
    else if (!/^(?=.*[A-Z]).{1}.*$/.test(password))
      return "res", "Enter at least one upper case character";
    else if (!/^(?=.*\W).{1}.*$/.test(password))
      return "Enter at least one special character";
    else if (!/^(?!.*(.)\1\1.*).*$/.test(password))
      return "Repeating characters not allowed";
    else return true;
  };

  this.empty = (value) => {
    if (typeof value == "object" && value != null) {
      if (value.length == 0 || Object.keys(value).length === 0) return true;
    }
    somevalue = [
      "",
      "0",
      0,
      0.0,
      null,
      undefined,
      Infinity,
      false,
      NaN,
    ].includes(value);
    if (somevalue) return true;
    else return false;
  };

  this.generateRandomStr = (round) =>
    (Math.random() + 1).toString(36).substring(round).toUpperCase();

  this.getCurrentDate = new Date();

  this.loginFraudAttempts = async (res, loggedUser) => {
    loggedUser.loginAttempt.lastAttempt = this.getCurrentDate;
    if (loggedUser.loginAttempt.attemptCount === 5) {
      loggedUser.loginAttempt.attemptCount = 0;
      loggedUser.login.loginProceed = "inactive";
      loggedUser.status = "inactive";
    } else {
      loggedUser.loginAttempt.attemptCount += 1;
    }

    await loggedUser.save();
    return Responder.sendFailure(res, ResMessage[2], 400, {});
  };

  this.emailExist = async function (user, callback) {
    if (user) {
      var adminCheck = await AdminModel.findOne({ email: user });
      var merchantCheck = await MerchantModel.findOne({ email: user });
      if (adminCheck || merchantCheck) {
        var data = adminCheck ? adminCheck : merchantCheck;
        return callback(data);
      } else {
        return callback(null);
      }
    } else {
      return callback(null);
    }
  };

  //  get Role Code
  this.getRoleCode = async (roleName) =>
    (await Roles.findOne({ roleName }, "roleCode -_id"))?.roleCode ?? "unknown";

  // Genarate JWT Local token
  this.genarateLocalJwtToken = (payLoad, expiresIn) =>
    jwt.sign({ payLoad }, Config?.common?.jwtSecretKey, { expiresIn });

  // Genarate JWT Kong token
  this.genarateJwtToken = (payLoad, expiryTime) =>
    jwt.sign(
      { iss: payLoad.key.toString(), exp: expiryTime },
      payLoad.secret.toString()
    );

  // Minutes
  this.getMinutuesHelp = (minutes) =>
    new Date(new Date().getTime() + minutes * 60000);

  // Days
  this.getDaysHelp = (days) =>
    new Date().setDate(new Date().getDate() + parseInt(days));

  this.createHashPwd = async (password) => {
    return await bcrypt.hash(password, 10);
  };

  this.createHash = async function (plainTextPassword) {
    // Hashing user's salt and password with 10 iterations,
    const saltRounds = 10;
    // First method to generate a salt and then create hash
    const salt = await bcrypt.genSalt(saltRounds);
    return await bcrypt.hash(plainTextPassword, salt);
    // Second mehtod - Or we can create salt and hash in a single method also
    // return await bcrypt.hash(plainTextPassword, saltRounds);
  };

  this.compareHashPassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
  };

  this.searchQuery = (searchTerm, searchFields) => {
    let searchQuery = {};

    if (searchTerm) {
      let searchQueryArr = [];
      searchFields.forEach(function (item, index) {
        let searchData = {};
        searchData[item] = { $regex: new RegExp(searchTerm, "i") };
        searchQueryArr.push(searchData);
      });
      searchQuery["$or"] = searchQueryArr;
      return searchQuery;
    } else {
      return searchQuery;
    }
  };

  this.getNanoId = function () {
    return nanoid();
  };

  this.addMonths = () => {
    let d = new Date();
    d.setMonth(d.getMonth() + 3);
    let addTreemMonths = new Date(moment(d).format("YYYY-MM-DD"));
    return addTreemMonths;
  };

  this.createUserKongToken = function (data, action, cb) {
    let options = {
      url: Config.kong.kongUrl + "/" + Config.THIRD_PARTY_SERVICE.KONG[action],
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    };
    request.post(options, (err, response, result) => {
      console.log(result);
      if (!err) return cb(result);
      else return cb(null);
    });
  };

  // Check Email Exist
  this.checkUserEmailExists = async (condition) =>
    !!(await User.countDocuments(condition));

  // Check Phone Exist
  this.checkUserPhoneExists = async (phone) =>
    !!(await User.countDocuments(phone));

  // Try Catch error Handling
  this.getErr = async (err) => {
    console.log(err);

    if (err?.code === 11000)
      return `${Object.keys(err.keyPattern)[0]} already exist`;
    else if (err.errors) return ResMessage[102];
    else if (err.errors === undefined) return ResMessage[102];
  };

  // Genarate 4 digit OTP
  this.generateOtp = async () =>
    Config?.common?.sendEmail === "yes"
      ? Math.floor(100000 + Math.random() * 900000)
      : 123456;

  this.createHash = async function (plainTextPassword) {
    // Hashing user's salt and password with 10 iterations,
    const saltRounds = 10;
    // First method to generate a salt and then create hash
    const salt = await bcrypt.genSalt(saltRounds);
    return await bcrypt.hash(plainTextPassword, salt);
    // Second mehtod - Or we can create salt and hash in a single method also
    // return await bcrypt.hash(plainTextPassword, saltRounds);
  };

  this.checkMenuAccess = async (roleCode, menuId) => {
    let role = await RoleModel.findOne({
      roleCode,
      status: "active",
      hasDeleted: { $ne: true },
    });

    if (roleCode === "SUPERADMIN11") return true;
    if (!role) return false;

    let haveMenuAccess;

    let menu = await MenuMasterModel.findOne({
      menuId,
      hasDeleted: { $ne: true },
    });

    if (menu.menuType == "merchant") return true;

    if (menu.isParentMenu == true) {
      let childMenus = await MenuMasterModel.find(
        { parentId: menuId, hasDeleted: { $ne: true } },
        "menuId -_id"
      );
      childMenus = await childMenus.map((childMenu) => childMenu.menuId);
      console.log(childMenus, menuId, "skljdhdjsh");
      haveMenuAccess = await MenuMapModel.findOne({
        roleId: role.roleId,
        menuId: { $in: childMenus },
      });
    } else
      haveMenuAccess = await MenuMapModel.findOne({
        roleId: role.roleId,
        menuId,
      });

    if (!haveMenuAccess) return false;
    else return true;
  };

  this.apiRouteCheckListByRole = (roleType) => {
    let routelist = [];
    if (roleType == "admin") {
      let deepCloned = JSON.parse(JSON.stringify(AdminRouteList.admin));
      routelist = deepCloned.map((e) => {
        let group = e.route_list.map((groupObj) => groupObj.group);
        return group;
      });
    } else if (roleType == "merchant") {
      let deepCloned = JSON.parse(JSON.stringify(MerchantRoutelist.merchant));
      routelist = deepCloned.map((e) => {
        let group = e.route_list.map((groupObj) => groupObj.group);
        return group;
      });
    }

    return routelist;
  };

  this.getUserRoleApiRouteCheckListByRole = async (authUser, roleType) => {
    let createRoutelist = [];

    if (roleType == "admin") {
      if (authUser?.accType == "superAdmin") {
        const deepCloned = JSON.parse(JSON.stringify(AdminRouteList.admin));
        createRoutelist = deepCloned;
      } else {
        let authUserRole = await RoleModel.findOne({
          roleCode: authUser.role?.roleCode,
          hasDeleted: { $ne: true },
        });
        let privileges = authUserRole.privileges;

        const deepCloned = JSON.parse(JSON.stringify(AdminRouteList.admin));
        createRoutelist = deepCloned.filter((e) => {
          let filtered_route_list = e.route_list.filter((groupObj) =>
            privileges.includes(groupObj.group)
          );
          e.route_list = filtered_route_list;
          return e.route_list != false;
        });
      }
    } else if (roleType == "merchant") {
      let deepCloned = JSON.parse(JSON.stringify(MerchantRoutelist.merchant));
      createRoutelist = deepCloned;
    }

    return createRoutelist;
  };

  this.getUserRoleUpdateApiRouteCheckList = async (authUser, role) => {
    let updateRoutelist = [];

    console.log(
      "jhhdksjdhksj",
      authUser?.accType,
      role?.roleType,
      "hjkhdksjhdsj"
    );

    if (role?.roleType == "admin") {
      if (authUser?.accType == "superAdmin") {
        const deepCloned = JSON.parse(JSON.stringify(AdminRouteList.admin));
        updateRoutelist = deepCloned.map((e) => {
          e.route_list.map((groupObj) => {
            if (role?.privileges.includes(groupObj.group)) {
              groupObj.is_enabled = true;
            }
          });
          return e;
        });
      } else {
        updateRoutelist = await this.getUserRoleApiRouteCheckListByRole(
          authUser,
          role?.roleType
        );

        updateRoutelist = await updateRoutelist.map((e) => {
          e.route_list.map((groupObj) => {
            if (role?.privileges.includes(groupObj.group)) {
              groupObj.is_enabled = true;
            }
          });
          return e;
        });
        console.log(updateRoutelist);
      }
    } else if (role?.roleType == "merchant") {
      let deepCloned = JSON.parse(JSON.stringify(MerchantRoutelist.merchant));

      updateRoutelist = await deepCloned.map((e) => {
        e.route_list.map((groupObj) => {
          if (role?.privileges.includes(groupObj.group)) {
            groupObj.is_enabled = true;
          }
        });
        return e;
      });
    }

    return updateRoutelist;
  };

  this.getDefautApiRouteGroups = (roleType) => {
    let routelist = [];
    if (roleType == "admin") {
      routelist = AdminRouteList?.adminDefaultApiGroups;
    } else if (roleType == "merchant") {
      routelist = MerchantRoutelist?.merchantDefaultApiGroups;
    }
    return routelist;
  };

  this.activateAccount = function (data, callback) {
    //console.log(bank_info)
    console.log(data.merchantId);
    let body = {
      name: data.fullName,
      mobile: {
        national_number: data.phone.number,
      },
      email: data?.email,
    };
    //   console.log(auth)
    let options = {
      url: "http://172.31.33.43:8085/api/payout/merchant/account/create",
      headers: {
        "Content-Type": "application/json",
        "x-consumer-username": `merchant_${data.merchantId}`,
      },
      body: JSON.stringify(body),
    };
    console.log(options);
    request.post(options, function (error, response, body) {
      console.log("error", error, "Body", body);
      callback(error, body);
    });
  };

  this.sendOTPSMS = function (data) {};

  this.quickBerrySMSFunc = function (data, callback) {
    let options = {
      url: "https://alerts.qikberry.com/api/v2/sms/send",
      method: "POST",
      headers: {
        Authorization: "Bearer fc92a8d1d825afacba62d7e732ef6827",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: "IPPOPA",
        service: "T",
        message,
        to,
      }),
    };
    request.post(options, function (err, resp, body) {
      if (body) callback(null, body);
      else callback(err, null);
    });
  };
}

module.exports = new Utils();
