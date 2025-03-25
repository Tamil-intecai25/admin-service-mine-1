let Config = require('../Configs/Config');
let mongoose = require('mongoose').Mongoose;


let admin = new mongoose();
let merchant = new mongoose();
let properties = new mongoose();
let transaction = new mongoose();

let {merchant : merchantDbUrl, admin : adminDbUrl, properties : propertiesDbUrl, transaction : transactionsDbUrl } = Config.dbUrl;


function DBConnection() {
    
    this.createConnection = function () {

        admin.connect(adminDbUrl, { useNewUrlParser: true, useUnifiedTopology: true }).
            then(() => console.log('admin DB Connected')).
            catch(err => console.error('admin Caught', err.message));
        admin.set("debug", true)
        merchant.connect(merchantDbUrl, { useNewUrlParser: true, useUnifiedTopology: true }).
            then(() => console.log('merchant DB Connected')).
            catch(err => console.error('merchant Caught', err.message));
        merchant.set("debug", true)
        properties.connect(propertiesDbUrl, { useNewUrlParser: true, useUnifiedTopology: true }).
            then(() => console.log('properties DB Connected')).
            catch(err => console.error('properties Caught', err.message));
        properties.set("debug", true)
        transaction.connect(transactionsDbUrl, { useNewUrlParser: true, useUnifiedTopology: true }).
            then(() => console.log('transaction DB Connected')).
            catch(err => console.error('transaction Caught', err.message));
    };


    this.getAdminDB = function () {
        return admin;
    };

    this.getMerchantDB = function () {
        return merchant;
    };

    this.getPropertiesDB = function () {
        return properties;
    };

    this.getTransactionDB = function () {
        return transaction;
    };

}

module.exports = new DBConnection();




// const mongoose = require('mongoose');

// function makeNewConnection(uri) {
//     const db = mongoose.createConnection(uri, {
//         useNewUrlParser: true,
//         useUnifiedTopology: true
//     });

//     db.on('error', function (error) {
//         console.log(`MongoDB E:: connection ${this.name} ${JSON.stringify(error)}`);
//         db.close().catch(() => console.log(`MongoDB :: failed to close connection ${this.name}`));
//     });

//     db.on('connected', function () {
//         mongoose.set('debug', function (col, method, query, doc) {
//             console.log(`MongoDB  C:: ${this.conn.name} ${col}.${method}(${JSON.stringify(query)},${JSON.stringify(doc)})`);
//         });
//         console.log(`MongoDB :: connected ${this.name}`);
//     });

//     db.on('disconnected', function () {
//         console.log(`MongoDB D:: disconnected ${this.name}`);
//     });

//     return db;
// }

// // Use

// const admin = makeNewConnection(adminDbUrl);
// const merchant = makeNewConnection(merchantDbUrl);




// module.exports = {
//    admin,
//    merchant,
// }

