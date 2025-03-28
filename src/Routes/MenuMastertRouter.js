<<<<<<< HEAD
let express = require('express');
let app = express();

const MenuMasterController = require('../Controllers/MenuMasterController');
const MenuMasterValidation = require('../Middlewares/Validators/MenuMasterValidation');


app.post('/create', MenuMasterValidation.createMenu(), MenuMasterController.menuCreate);
app.patch('/update/:menuId', MenuMasterValidation.updateMenu(), MenuMasterController.menuUpdate);
app.get('/list', MenuMasterController.menuList);
app.get('/detail/:menuId', MenuMasterController.menuDetail);
app.patch('/status/:menuId',  MenuMasterController.menuStatus);
app.delete('/delete/:menuId', MenuMasterController.menuDelete);
app.post('/parent-menu-list', MenuMasterValidation.MenuListByType(), MenuMasterController.getParentMenuList);
app.post('/route-create', MenuMasterController.routeCreate);


=======
let express = require('express');
let app = express();

const MenuMasterController = require('../Controllers/MenuMasterController');
const MenuMasterValidation = require('../Middlewares/Validators/MenuMasterValidation');


app.post('/create', MenuMasterValidation.createMenu(), MenuMasterController.menuCreate);
app.patch('/update/:menuId', MenuMasterValidation.updateMenu(), MenuMasterController.menuUpdate);
app.get('/list', MenuMasterController.menuList);
app.get('/detail/:menuId', MenuMasterController.menuDetail);
app.patch('/status/:menuId',  MenuMasterController.menuStatus);
app.delete('/delete/:menuId', MenuMasterController.menuDelete);
app.post('/parent-menu-list', MenuMasterValidation.MenuListByType(), MenuMasterController.getParentMenuList);
app.post('/route-create', MenuMasterController.routeCreate);


>>>>>>> origin/dev
module.exports = app;