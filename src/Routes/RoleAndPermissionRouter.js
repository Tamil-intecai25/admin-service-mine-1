let express = require('express');
let app = express();

const RoleAndPermissionController = require('../Controllers/RoleAndPermissionController');
const RoleAndPermissionValidation = require('../Middlewares/Validators/RoleAndPermissionValidation');



app.post('/create', RoleAndPermissionValidation.createRole(), RoleAndPermissionController.roleAndPermissionCreate);
app.get('/get-all-routes', RoleAndPermissionController.roleAndPermissionCreate);
app.patch('/update/:roleId', RoleAndPermissionValidation.updateRole(), RoleAndPermissionController.roleAndPermissionUpdate);
app.get('/get-all-update-routes/:roleId', RoleAndPermissionController.roleAndPermissionUpdate);
// app.get('/update/:roleId', RoleAndPermissionController.roleAndPermissionUpdate);
app.get('/list', RoleAndPermissionController.roleAndPermissionList);
app.get('/detail/:roleId', RoleAndPermissionController.roleAndPermissionDetail);
app.patch('/status/:roleId', RoleAndPermissionController.roleAndPermissionStatus);
app.delete('/delete/:roleId', RoleAndPermissionController.roleAndPermissionDelete);

module.exports = app;