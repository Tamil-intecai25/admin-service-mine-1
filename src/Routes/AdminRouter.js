const app = require("express")();

const AdminAuthController = require("../Controllers/AdminController");
const Admin = require("../Controllers/AdminAuthController");
// const { verifyAdmin } = require("../Middlewares/Middleware");
const AdminValidation = require("../Middlewares/Validators/AdminValidation");
const Utils = require('../Helpers/Utils')
const Validation = require("../Middlewares/Validators/MerchantValidation");

// app.use(verifyAdmin);

// Admin profile view 

app.get('/dashboard', function (req, res) {
    return AdminAuthController.getDashboard(res, req.query)
})

app.get("/profile", (req, res) => {
   console.log("jsdkjhskh")
   return AdminAuthController.profileView(req, res);
});
// Change Password
app.post("/change-password", AdminValidation.changePassword, (req,res) => {
   return AdminAuthController.changePassword(req, res);
});

// Admin and user login activites
app.get('/login-activity', (req, res) => {
   return AdminAuthController.loginActivity(req, res)
});


//enable and disable 2fa
app.patch('/twofa-enable', (req, res) => {
   return AdminAuthController.twoFAEnable(req, res)
});

//2fa data 
app.get('/twofa-status', (req, res) => {
   return AdminAuthController.twoFAStatus(req, res)
});

app.post("/logout", (req, res) => {
   console.log("jsdkjhskh")
   
    return AdminAuthController.logout(req, res);
});

 app.post("/add-user", AdminValidation.addUser, (req, res) => {
  return AdminAuthController.addUsers(req, res);
});

app.patch("/update-user", AdminValidation.addUser, (req, res) => {
  return AdminAuthController.updateUser(req, res);
});

app.get("/view-user", (req, res) => {
  return AdminAuthController.userView(req, res);
});

 app.get("/api-routes", (req, res) => {
    return AdminAuthController.loginAdminRouteList(req, res);
 });

app.get("/user-list", (req, res) => {
  return AdminAuthController.userList(req, res);
});

app.patch("/user-status", (req, res) => {
  return AdminAuthController.userStatus(req, res);
});

app.delete("/user-delete", (req, res) => {
  return AdminAuthController.userDelete(req, res);
});

 
app.post("/add-merchant", Validation.addMerchant, (req, res) => {
  return AdminAuthController.createMerchant(req, res);
});


app.get("/merchant-list", (req, res) => {
  return AdminAuthController.Merchantlist(req, res);
});

app.patch("/merchant-update", Validation.editMerchant, (req, res) => {
  return AdminAuthController.updateMerchant(req, res);
});

app.delete("/merchant-delete", (req, res) => {
  return AdminAuthController.merchantDelete(req, res);
});

app.post("/export-acl-route-group", (req, res) => {
    return AdminAuthController.exportAllRoutesbyAcl(req, res);
 });


 app.post("/delete-all-service-route", (req, res) => {
   console.log("sjhskdskjd")
    return AdminAuthController.deleteService(req, res);
 });
 

 app.post('/add-setting', (req, res) => {
   return AdminAuthController.addSetting(res, req.body, Utils.getUserId(req))
 })

 app.get('/default-setting', (req, res) => {
   return AdminAuthController.getDefaultSettings(res, req.query)
 })

module.exports = app;

