<<<<<<< HEAD
let express = require('express');
let app = express();
// const { verifyAdmin } = require("../Middlewares/Middleware");


// app.use('/api/payout/admin/auth', require('./AdminAuthRouter'));
// app.use('/api/payout/admin',verifyAdmin, require('./AdminRouter'));
// app.use('/api/payout/admin/role-permission', verifyAdmin, require('./RoleAndPermissionRouter'));
// app.use('/api/payout/admin/contact',verifyAdmin, require('./ContactRouter'))
// app.use('/api/payout/admin/account',verifyAdmin, require('./AccountRouter'))
// app.use("/api/payout/admin/transaction",verifyAdmin, require("./TransactionRouter"));
// app.use("/api/payout/admin/merchant",verifyAdmin, require('./MerchantRouter'))
app.use("/api/oneapp/admin/zone", require('./ZoneRouter'));
app.use("/api/oneapp/admin/order", require('./OrderRouter'));


// app.use('/api/payout/export-acl-route-group', require('./MerchantRouter'));



module.exports = app;
=======
let express = require('express');
let app = express();
// const { verifyAdmin } = require("../Middlewares/Middleware");


// app.use('/api/payout/admin/auth', require('./AdminAuthRouter'));
// app.use('/api/payout/admin',verifyAdmin, require('./AdminRouter'));
// app.use('/api/payout/admin/role-permission', verifyAdmin, require('./RoleAndPermissionRouter'));
// app.use('/api/payout/admin/contact',verifyAdmin, require('./ContactRouter'))
// app.use('/api/payout/admin/account',verifyAdmin, require('./AccountRouter'))
// app.use("/api/payout/admin/transaction",verifyAdmin, require("./TransactionRouter"));
// app.use("/api/payout/admin/merchant",verifyAdmin, require('./MerchantRouter'))
app.use("/api/oneapp/admin/zone", require('./ZoneRouter'));
app.use("/api/oneapp/admin/order", require('./OrderRouter'));


// app.use('/api/payout/export-acl-route-group', require('./MerchantRouter'));



module.exports = app;
>>>>>>> origin/dev
