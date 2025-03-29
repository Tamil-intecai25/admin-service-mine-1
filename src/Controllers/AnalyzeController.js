var Utils = require("../Helpers/Utils");
var Socket = require("../Helpers/socketIo");
var Responder = require("../Helpers/Responder");
const LocationModel = require("../Models/LocationModel");
const jwt = require("jsonwebtoken");
const MulterHelper = require("../Helpers/MulterHelper");
const fs = require("fs");
const csv = require('csv-parser')


function Controller() {

    this.bulkUpload = async function (req, res) {
        MulterHelper.upload(req, res, async function (err) {
            if (req.file) {
                const bulkData = [];
                // console.log(req.file.path,"req.file.path");return;
                fs.createReadStream(req.file.path)
                    .on("error", () => {
                        return Responder.sendFailure(res, "Error while reading document", 422, {});
                    })
                    .pipe(csv())
                    .on("data", (row) => {
                        const sanitizedRow = {};
                        Object.keys(row).forEach((key) => {
                            const cleanKey = key.trim();
                            sanitizedRow[cleanKey] = row[key]; 
                        });
                        // console.log("sanitizedRow",sanitizedRow,"sanitizedRow");
                        const payload = {
                            locationId: "location_" + Utils.getNanoId(),
                            country: sanitizedRow?.country?.trim() ?? '',
                            state: sanitizedRow?.state?.trim() ?? '',
                            city: sanitizedRow?.city?.trim() ?? '',
                            pincode: sanitizedRow?.pincode?.trim() ?? '',
                        };
                        // console.log("payload",payload,"payload");return;

                        let missingFields = [];
                        if (!payload.country) missingFields.push("country");
                        if (!payload.state) missingFields.push("state");
                        if (!payload.city) missingFields.push("city");
                        if (!payload.pincode) missingFields.push("pincode");
    
                        if (missingFields.length > 0) {
                            payload["requiredFields"] = false;
                            payload["failureReason"] = `${missingFields.join(", ")} should not be empty`;
                        }
                        // console.log("payload",payload,"payload");return;
                        // console.log("bulkData",bulkData,"bulkData");return;
                        bulkData.push(payload);
                    })
                    .on("end", async () => {
                        try {
                            const insertedData = await LocationModel.insertMany(bulkData);
                            fs.unlink(req.file.path, (err) => {
                                if (err) {
                                    console.error("Error deleting file:", err);
                                } else {
                                    console.log("File deleted successfully:", req.file.path);
                                }
                            });
    
                            return Responder.sendSuccess(res, "Locations uploaded successfully", 200, { count: insertedData.length });
                        } catch (err) {
                            console.log(err);
                            return Responder.sendFailure(res, "Error inserting location data", 422, {});
                        }
                    });
            } else if (err) {
                console.log(err);
                return Responder.sendFailure(res, err.message, 422, "");
            } else {
                return Responder.sendFailure(res, "Unable to upload the file", 422, "");
            }
        });
    };
        
    

      this.createBulkTransfer = async function (batchId) {
        let count = 0
        let sendTransfer = async function () {
          let batchTransaction = await TempTransaction.findOne({ "batchId": batchId, "requiredFields": true, "transactionIntiatedStatus": "pending" })
          console.log(batchTransaction)
          if (batchTransaction) {
            let transferObject = {
              "account": {
                "number": batchTransaction?.accountNumber,
                "ifsc": batchTransaction?.ifsc
              },
              "name": {
                "full": batchTransaction?.name
              },
              "amount": batchTransaction?.amount,
              "pay_mode": (batchTransaction?.payMode) ? batchTransaction?.payMode : "IMPS",
              "mPin": await EncDec.decrypt(batchTransaction?.mPin),
              "batchId": batchId,
              "remarks": batchTransaction?.remarks,
              "merchantId": batchTransaction?.merchantId,
              "trans_ref": batchTransaction?.referenceNumber
            }
            if (batchTransaction?.upiId) {
              delete transferObject.account
              transferObject["vpa"] = batchTransaction?.upiId
            }
            console.log(transferObject)
            TransactionController.createQuickTransfer(transferObject, function (err, body) {
              if (!err)
                batchTransaction['transactionIntiatedStatus'] = "initiated"
              else if (err) batchTransaction['transactionIntiatedStatus'] = "failed"
              batchTransaction.save()
                .then((savedBatchTransaction) => {
                  sendTransfer()
                })
                .catch((err) => {
                  sendTransfer()
                })
            })
          } else {
            console.log(1, "Done")
          }
        }
        sendTransfer(count)
      }

}

module.exports = new Controller();
