var Utils = require("../Helpers/Utils");
var Responder = require("../Helpers/Responder");
const ZoneModel = require("../Models/ZoneModel");
const AreaModel = require("../Models/AreaModel");
const OneAppUserModel = require("../Models/OneAppUserModel");
const SellerModel = require("../Models/SellerModel");
const CategoryModel = require("../Models/CategoryModel");
const SubCategoryModel = require("../Models/SubCategoryModel");
const PartnerModel = require("../Models/PartnerModel");
const Admin = require("firebase-admin");
const serviceAccount = require("../Helpers/one-app-427bf-firebase-adminsdk-xer87-95a00e6f87.json");
const otp_expiry_time = 5 * 60 * 1000;
const generateOtp = () => "1234"; 
const jwt = require("jsonwebtoken");
const otpStore = new Map();
Admin.initializeApp({
    credential: Admin.credential.cert(serviceAccount)
});
require("mongoose-pagination");

function Controller(){

    this.createZone = async function (res, req) {

        try {
            // let body = req.body;
            // console.log(req.body.zoneName);return;
            let zoneId = "zone_"+Utils.getNanoId();
            let zone = {
                zoneId : zoneId ?? "",
                zoneName : req.body.zoneName ?? ""
            }
            let addZone = new ZoneModel(zone);
            let result = await addZone.save();
            if(result){
                return Responder.sendSuccess(res, "Zone Created Successfully", 201);
            }else{
                return Responder.sendFailure(res, "Error while creating zone:", 400);
            }
            
        } catch (error) {
            console.error("Error while creating zone:", error);
            return Responder.sendFailure(res, "Something went wrong", 500);
        }
        
    }

    this.getZone = async function (res, req) {
        try {
                let getZone = await ZoneModel.find();

                // console.log(getArea);return;
    
            if (getZone) {
                return Responder.sendSuccess(res, "Zone Detials",200, getZone);
            } else {
                return Responder.sendFailure(res, "Error while getting zone", 400);
            }
    
        } catch (error) {
            console.error("Error while creating zone:", error);
            return Responder.sendFailure(res, "Something went wrong", 500);
        }
    };    

    // this.createArea = async function (res, req) {
    //     try {
    //         let areaId = "area_" + Utils.getNanoId();
    
    //         let area = {
    //             areaId: areaId ?? "",
    //             zoneId: req.body.zoneId ?? "",
    //             zoneArea: req.body.zoneArea ?? "",
    //             polygoneLatelong: req.body.polygoneLatelong || []
    //         };
    
    //         let addArea = new AreaModel(area);
    //         let result = await addArea.save();
    
    //         if (result) {
    //             return Responder.sendSuccess(res, "Area Created Successfully", 201);
    //         } else {
    //             return Responder.sendFailure(res, "Error while creating area", 400);
    //         }
    
    //     } catch (error) {
    //         console.error("Error while creating area:", error);
    //         return Responder.sendFailure(res, "Something went wrong", 500);
    //     }
    // };

    this.createOrUpdateArea = async function (res, req) {
        // try {
            let { areaId, zoneId, zoneArea, polygoneLatelong } = req.body;
            if (!areaId || areaId == undefined || areaId == null) {

                let newAreaId = "area_" + Utils.getNanoId();
    
                let area = new AreaModel({
                    areaId: newAreaId,
                    zoneId: zoneId ?? "",
                    zoneArea: zoneArea ?? "",
                    polygoneLatelong: polygoneLatelong || []
                });
    
                let result = await area.save();
    
                if (result) {
                    return Responder.sendSuccess(res, "Area Created Successfully", 201);
                } else {
                    return Responder.sendFailure(res, "Error while creating area", 400);
                }
            } else {
                let existingArea = await AreaModel.findOne({ areaId: areaId });
    
                if (!existingArea) {
                    return Responder.sendFailure(res, "Area not found", 404);
                }
    
                existingArea.zoneId = zoneId;
    
                let updatedResult = await existingArea.save();
    
                if (updatedResult) {
                    return Responder.sendSuccess(res, "Area Mapping Updated Successfully", 200);
                } else {
                    return Responder.sendFailure(res, "Error while updating area", 400);
                }
            }
    
        // } catch (error) {
        //     // console.error("Error in createOrUpdateArea:", error);
        //     return Responder.sendFailure(res, "Something went wrong", 500);
        // }
    };

    this.multipleMapingUpdate = async function (req, res) {
        try {
            let { zoneId, areas } = req.body;

            let areaIds = areas.map(area => area.areaId);

            let firstArea = await AreaModel.findOne({ areaId: areaIds[0] });

            let previousZoneId = firstArea.zoneId;

            await AreaModel.updateMany(
                { zoneId: previousZoneId, areaId: { $nin: areaIds } },
                { $set: { zoneId: "" } }
            );
    
            if (!zoneId || !Array.isArray(areas) || areas.length === 0) {
                return Responder.sendFailure(res, "Invalid request data", 400);
            }
    
            // Fetch all areas across all zones
            let allExistingAreas = await AreaModel.find({});
    
            // Create a map of all areas by areaId for quick lookup
            let areaMap = new Map(allExistingAreas.map(area => [area.areaId, area]));
    
            let operations = areas.map(async (areaData) => {
                let { areaId, polygoneLatelong } = areaData;
    
                if (!areaId) {
                    // Create new area if areaId is not provided
                    let newAreaId = "area_" + Utils.getNanoId();
                    let newArea = new AreaModel({
                        areaId: newAreaId,
                        zoneId,
                        // zoneArea,
                        polygoneLatelong: polygoneLatelong || [], // Ensure new areas get polygon data
                    });
    
                    return await newArea.save();
                } else {
                    // Look up area across all zones
                    let existingArea = areaMap.get(areaId);
    
                    if (!existingArea) {
                        return { error: `Area not found for areaId: ${areaId}` };
                    }
    
                    // Update zoneId and zoneArea to allow remapping
                    existingArea.zoneId = zoneId;
                    // existingArea.zoneArea = zoneArea;
    
                    // Update polygoneLatelong if provided
                    if (polygoneLatelong && polygoneLatelong.length > 0) {
                        existingArea.polygoneLatelong = polygoneLatelong;
                    }
    
                    return await existingArea.save();
                }
            });
    
            let results = await Promise.all(operations);
    
            return Responder.sendSuccess(res, "Areas updated successfully", 200, results);
        } catch (error) {
            console.error("Error in multipleAreaUpdate:", error);
            return Responder.sendFailure(res, "Something went wrong", 500);
        }
    };
    
    
    

    this.allAreasUpdate = async function (req, res) {
        // try {
            let { zones } = req.body; // Extracting 'zones' from request body
            if (!Array.isArray(zones) || zones.length === 0) {
                return Responder.sendFailure(res, "Invalid request data", 400);
            }
    
            let operations = zones.map(async (areaData) => {
                let { areaId, zoneId, zoneArea, polygoneLatelong } = areaData;
    
                if (!areaId) {
                    let newAreaId = "area_" + Utils.getNanoId();
                    let newArea = new AreaModel({
                        areaId: newAreaId,
                        zoneId: zoneId ?? "",
                        zoneArea: zoneArea ?? "",
                        polygoneLatelong: polygoneLatelong || [],
                    });
    
                    return await newArea.save();
                } else {
                    let existingArea = await AreaModel.findOne({ areaId: areaId });
    
                    if (!existingArea) {
                        return { error: `Area not found for areaId: ${areaId}` };
                    }
    
                    if (zoneId) {
                        existingArea.zoneId = zoneId;
                    }
    
                    if (polygoneLatelong && polygoneLatelong.length > 0) {
                        existingArea.polygoneLatelong = [
                            // ...existingArea.polygoneLatelong,
                            ...polygoneLatelong,
                        ];
                    }
    
                    return await existingArea.save();
                }
            });
    
            let results = await Promise.all(operations);
    
            return Responder.sendSuccess(res, "Areas processed successfully", 200, results);
        // } catch (error) {
        //     console.error("Error in createOrUpdateAreas:", error);
        //     return Responder.sendFailure(res, "Something went wrong", 500);
        // }
    };
    
    
    

    this.getArea = async function (res, req) {
        try {
                let getArea = await AreaModel.find();

                // console.log(getArea);return;
    
            if (getArea) {
                return Responder.sendSuccess(res, "Area Detials",200, getArea);
            } else {
                return Responder.sendFailure(res, "Error while getting area", 400);
            }
    
        } catch (error) {
            console.error("Error while creating area:", error);
            return Responder.sendFailure(res, "Something went wrong", 500);
        }
    };    

    // this.createUser = async function (res, req) {
    //     try {
    //         let userId = "user_" + Utils.getNanoId();  
    //         let existingUser = await OneAppUserModel.findOne({phone : req.body.phone});
    //         if(existingUser){

    //         }
    //         let user = {
    //             userId: userId,
    //             name: req.body.name ?? "",
    //             phone: req.body.phone ?? "",
    //             location: {
    //                 home: req.body.location?.home || {},
    //                 office: req.body.location?.office || {},
    //                 others: req.body.location?.others || {}
    //             },
    //             audit: {
    //                 createdBy: req.body.audit?.createdBy || {},
    //                 updatedBy: req.body.audit?.updatedBy || {},
    //                 deletedBy: req.body.audit?.deletedBy || {}
    //             },
    //             hasDeleted: req.body.hasDeleted || false
    //         };
    
    //         let addUser = new OneAppUserModel(user);
    //         let result = await addUser.save();
    
    //         if (result) {
    //             return Responder.sendSuccess(res, "User Created Successfully", 201);
    //         } else {
    //             return Responder.sendFailure(res, "Error while creating user", 400);
    //         }
    
    //     } catch (error) {
    //         console.error("Error while creating user:", error);
    //         return Responder.sendFailure(res, "Something went wrong", 500);
    //     }
    // };

    // this.createUser = async function (req, res) {
    //     try {
    //         const { step, phone, otp, name, location } = req.body;
    
    //         if (!step) {
    //             return Responder.sendFailure(res, "Step is required", 400);
    //         }
    
    //         if (step === 1) {
    //             if (!phone) return Responder.sendFailure(res, "Phone number is required", 400);
    
    //             const generatedOtp = generateOtp(); 
    //             otpStore.set(phone, { otp: generatedOtp, verified: false });
    
    //             console.log(`OTP sent to ${phone}: ${generatedOtp}`); 
    
    //             return Responder.sendSuccess(res, "OTP sent successfully", 200);
    //         }
    
    //         if (step === 2) {
               
    //             if (!phone || !otp) return Responder.sendFailure(res, "Phone and OTP are required", 400);

    //             const storedOtpData = otpStore.get(phone);
    //             if (!storedOtpData) return Responder.sendFailure(res, "OTP not found, please request again", 404);

    //             if (storedOtpData.otp !== otp) return Responder.sendFailure(res, "Invalid OTP", 401);

    //             otpStore.set(phone, { ...storedOtpData, verified: true });

    //             // 🔹 Check if user exists
    //             let user = await OneAppUserModel.findOne({ phone });
    //             if (!user) {
    //                 let userId = "user_" + Utils.getNanoId();
    //                 user = new OneAppUserModel({ userId, phone });
    //                 await user.save();
    //             }

    //             // 🔹 Generate JWT Token
    //             let token = jwt.sign(
    //                 { userId: user.userId, phone: user.phone },
    //                 process.env.JWT_SECRET,
    //                 { expiresIn: "7d" }
    //             );

    //             return Responder.sendSuccess(res, "OTP verified, login successful", 200, { token });
    //         }
    
    //         if (step === 3) {
              
    //             if (!phone || !name || !location) return Responder.sendFailure(res, "Phone, name, and location are required", 400);
    
    //             const storedOtpData = otpStore.get(phone);
    //             let userId = "user_" + Utils.getNanoId();  
    //             if (!storedOtpData || !storedOtpData.verified) return Responder.sendFailure(res, "OTP verification required before proceeding", 403);
    
    //             let user = await OneAppUserModel.findOneAndUpdate(
    //                 { userId },
    //                 { phone },
    //                 { name, location },
    //                 { new: true, upsert: true } // Create user if not exists
    //             );
    
    //             if (!user) return Responder.sendFailure(res, "Error updating user details", 500);
    
    //             otpStore.delete(phone); // Remove OTP record after success
    //             return Responder.sendSuccess(res, "User details updated successfully", 200);
    //         }
    
    //         return Responder.sendFailure(res, "Invalid step", 400);
    //     } catch (error) {
    //         console.error("Error while processing user:", error);
    //         return Responder.sendFailure(res, "Something went wrong", 500);
    //     }
    // };

    //  this.sendOtp = async function (req, res, type) {
    //     // try {
            
    //         const { phone } = req.body;
    //         if(type === "seller"){
    //             var user = await SellerModel.findOne({ phone });
    //         }else{
    //             var user = await OneAppUserModel.findOne({ phone });
    //         }
    //         if(!user){
    //             const userId = type === "seller" ? "seller_" + Utils.getNanoId() : "user_" + Utils.getNanoId();
    //             user = new (type === "seller" ? SellerModel : OneAppUserModel)({ userId, phone });

    //             await user.save();
    //         }
    //         const otp = "1234";
    //         otpStore.set(phone, { otp, verified: false });

    //         console.log(`OTP for ${phone}: ${otp}`); // Log OTP for testing

    //         return Responder.sendSuccess(res, "OTP sent successfully", 200);
    //     // } catch (error) {
    //     //     return Responder.sendFailure(res, "Something went wrong", 500);
    //     // }
    // };

    this.sendOtp = async function (req, res, type) {
        try {
            const { phone } = req.body;
    
            let user;
            if (type === "seller") {
                user = await SellerModel.findOne({ phone });
            } else {
                user = await OneAppUserModel.findOne({ phone });
            }
    
            // If user doesn't exist, create a new one
            if (!user) {
                const userId = "user_" + Utils.getNanoId();
                let newUserData = { userId, phone };
    
                if (type === "seller") {
                    newUserData.sellerId = "seller_" + Utils.getNanoId(); // Add sellerId for sellers
                    user = new SellerModel(newUserData);
                } else {
                    user = new OneAppUserModel(newUserData);
                }
    
                await user.save();
            }
    
            // Generate OTP and store it
            const otp = "1234"; // Replace with actual OTP logic
            // otpStore.set(phone, { otp, verified: false });
            otpStore.set(phone, { otp, verified: false, expiresAt: Date.now() + otp_expiry_time });
    
            console.log(`OTP for ${phone}: ${otp}`); // Log OTP for testing
    
            return Responder.sendSuccess(res, "OTP sent successfully", 200);
        } catch (error) {
            console.error("Error sending OTP:", error);
            return Responder.sendFailure(res, "Something went wrong", 500);
        }
    };

    this.verifyOtp = async function (req, res, type) {
        console.log(req.body);
        try {
            const { phone, otp } = req.body;
    
            if (!phone || !otp) return Responder.sendFailure(res, "Phone and OTP are required", 400);
    
            const storedOtpData = otpStore.get(phone);
    
            if (!storedOtpData) return Responder.sendFailure(res, "OTP not found, please request again", 404);
            if (storedOtpData.otp !== otp) return Responder.sendFailure(res, "Invalid OTP", 401);
    
            // Mark OTP as verified
            otpStore.set(phone, { ...storedOtpData, verified: true });
    
            // Find or create user
            let user = await (type === "seller" ? SellerModel : OneAppUserModel).findOne({ phone });
    
            if (!user) {
                let userId = "user_" + Utils.getNanoId();
                user = new (type === "seller" ? SellerModel : OneAppUserModel)({ userId, phone });
                await user.save();
            }
            // Generate temporary JWT Token (valid only for updating user details)
            // console.log(type);return;
            if(type === "seller"){
                token = jwt.sign(
                    { sellerId: user.sellerId, phone: user.phone,location: user.location, step: "otp_verified" },
                    process.env.JWT_SECRET,
                    { expiresIn: "7d" } // Short-lived token for security
                );
            }else{
                token = jwt.sign(
                    { userId: user.userId, phone: user.phone,location: user.location, step: "otp_verified" },
                    process.env.JWT_SECRET,
                    { expiresIn: "7d" } // Short-lived token for security
                );
            }
            
    
            // Clear OTP from storage
            otpStore.delete(phone);
    
            return Responder.sendSuccess(res, "OTP verified successfully. Please provide name and location", 200, { token, user });
        } catch (error) {
            console.error("Error verifying OTP:", error);
            return Responder.sendFailure(res, "Something went wrong", 500);
        }
    };    

    // this.updateUserDetails = async function (req, res, type) {
    //     try {
    //         const { name, location } = req.body;
    //         const token = req.headers.authorization?.split(" ")[1];
    
    //         if (!token) return Responder.sendFailure(res, "Authorization token is required", 401);
    
    //         // Verify JWT Token
    //         let decoded;
    //         try {
    //             decoded = jwt.verify(token, process.env.JWT_SECRET);
    //         } catch (err) {
    //             return Responder.sendFailure(res, "Invalid or expired token", 401);
    //         }
    
    //         if (!decoded || !decoded.userId) return Responder.sendFailure(res, "Invalid token", 401);
    
    //         // Find user by userId from token
    //         let user = await (type === "seller" ? SellerModel : OneAppUserModel).findOne({ userId: decoded.userId });
    
    //         if (!user) return Responder.sendFailure(res, "User not found", 404);
    
    //         // Update name and location if provided
    //         if (name) user.name = name;
    //         if (location) user.location = location;
    
    //         await user.save();
    
    //         // Generate permanent JWT token for login
    //         let permanentToken = jwt.sign(
    //             { userId: user.userId, phone: user.phone },
    //             process.env.JWT_SECRET,
    //             { expiresIn: "7d" }
    //         );
    
    //         return Responder.sendSuccess(res, "User details updated successfully", 200, { token: permanentToken, user });
    //     } catch (error) {
    //         console.error("Error updating user details:", error);
    //         return Responder.sendFailure(res, "Something went wrong", 500);
    //     }
    // };    
    
    // this.updateUserDetails = async function (req, res, type) {
    //     try {
    //         const { name, location, locationType } = req.body; // locationType should be "home", "office", or "others"
    //         const token = req.headers.authorization?.split(" ")[1];
    
    //         if (!token) return Responder.sendFailure(res, "Authorization token is required", 401);
    
    //         // Verify JWT Token
    //         let decoded;
    //         try {
    //             decoded = jwt.verify(token, process.env.JWT_SECRET);
    //         } catch (err) {
    //             return Responder.sendFailure(res, "Invalid or expired token", 401);
    //         }
    
    //         if (!decoded || !decoded.userId) return Responder.sendFailure(res, "Invalid token", 401);
    
    //         // Find user by userId from token
    //         let user = await (type === "seller" ? SellerModel : OneAppUserModel).findOne({ userId: decoded.userId });
    
    //         if (!user) return Responder.sendFailure(res, "User not found", 404);
    
    //         // Update name if provided
    //         if (name) user.name = name;
    
    //         // Validate and update location
    //         if (location && locationType) {
    //             if (!["home", "office", "others"].includes(locationType)) {
    //                 return Responder.sendFailure(res, "Invalid location type. Use 'home', 'office', or 'others'", 400);
    //             }
    
    //             user.location[locationType] = {
    //                 lat: location.lat || user.location[locationType]?.lat,
    //                 lng: location.lng || user.location[locationType]?.lng,
    //                 doorNo: location.doorNo || user.location[locationType]?.doorNo,
    //                 streetName: location.streetName || user.location[locationType]?.streetName,
    //                 landmark: location.landmark || user.location[locationType]?.landmark,
    //             };
    //         }
    
    //         // Update audit logs
    //         user.audit.updatedBy = {
    //             id: decoded.userId,
    //             name: user.name || "Unknown",
    //         };
    
    //         await user.save();
    
    //         // Generate permanent JWT token for login
    //         let permanentToken = jwt.sign(
    //             { userId: user.userId, phone: user.phone },
    //             process.env.JWT_SECRET,
    //             { expiresIn: "7d" }
    //         );
    
    //         return Responder.sendSuccess(res, "User details updated successfully", 200, { token: permanentToken, user });
    //     } catch (error) {
    //         console.error("Error updating user details:", error);
    //         return Responder.sendFailure(res, "Something went wrong", 500);
    //     }
    // };
    
    this.updateUserDetails = async function (req, res, type) {
        try {
            const { name, location, locationType } = req.body; // locationType should be "home", "office", or "others"
            const { userId } = req.user; // Extracted from the verified token (middleware should handle this)
            // console.log(userId);return;
            if (!userId) return Responder.sendFailure(res, "Unauthorized access", 401);
    
            // Find user by userId from token
            let user = await (type === "seller" ? SellerModel : OneAppUserModel).findOne({ userId });
    
            if (!user) return Responder.sendFailure(res, "User not found", 404);
    
            // Update name if provided
            if (name) user.name = name;
    
            // Validate and update location
            if (location && locationType) {
                if (!["home", "office", "others"].includes(locationType)) {
                    return Responder.sendFailure(res, "Invalid location type. Use 'home', 'office', or 'others'", 400);
                }
    
                user.location[locationType] = {
                    lat: location.lat || user.location[locationType]?.lat,
                    lng: location.lng || user.location[locationType]?.lng,
                    doorNo: location.doorNo || user.location[locationType]?.doorNo,
                    streetName: location.streetName || user.location[locationType]?.streetName,
                    landmark: location.landmark || user.location[locationType]?.landmark,
                };
            }
    
            // Update audit logs
            user.audit.updatedBy = {
                id: userId,
                name: user.name || "Unknown",
            };
    
            await user.save();
    
            return Responder.sendSuccess(res, "User details updated successfully", 200, { user });
        } catch (error) {
            console.error("Error updating user details:", error);
            return Responder.sendFailure(res, "Something went wrong", 500);
        }
    };    

    // this.findZonesContainingUser = async function (res, req) {
    //     try {
    //         // console.log(req.query);return;
            
    //         let userLat = parseFloat(req.query.lat);
    //         let userLong = parseFloat(req.query.long); 

    //         // console.log(typeof userLong);return;
    
    //         if (!userLat || !userLong) {
    //             return Responder.sendFailure(res, "Latitude and Longitude are required", 400);
    //         }
    
    //         // Step 1: Find the area where user's lat-long falls in
    //         let allAreas = await AreaModel.find();
    //         let matchedZoneId = null;
            
    //         for (const area of allAreas) {
    //             let polygon = area.polygoneLatelong.map(coord => [coord.lat, coord.lng]);
    //             // console.log("polygon",polygon,"polygon");return;
    //             // console.log(Utils.isPointInPolygon([userLat, userLong], polygon),"IAMM");return;
    //             if (Utils.isPointInPolygon([userLat, userLong], polygon)) {
    //                 matchedZoneId = area.zoneId;
    //                 break;
    //             }
    //         }
    
    //         if (!matchedZoneId) {
    //             return Responder.sendFailure(res, "No zones found for the given location", 404);
    //         }
    
    //         let zoneAreas = await AreaModel.find({ zoneId: matchedZoneId });
    
    //         let sellersInZone = [];
    
    //         for (const zoneArea of zoneAreas) {
    //             let areaPolygon = zoneArea.polygoneLatelong.map(coord => [coord.lat, coord.lng]);
    
    //             let sellers = await SellerModel.find({
    //                 "location.branch.lat": { $exists: true },
    //                 "location.branch.long": { $exists: true }
    //             });
    
    //             sellers.forEach(seller => {
    //                 let sellerLat = seller.location.branch.lat;
    //                 let sellerLong = seller.location.branch.long;
    
    //                 if (Utils.isPointInPolygon([sellerLat, sellerLong], areaPolygon)) {
    //                     sellersInZone.push(seller);
    //                 }
    //             });
    //         }
    
    //         if (sellersInZone.length > 0) {
    //             return Responder.sendSuccess(res, "Sellers found inside the zone", 200, sellersInZone);
    //         } else {
    //             return Responder.sendFailure(res, "No sellers found inside the zone", 404);
    //         }
    
    //     } catch (error) {
    //         console.error("Error finding zones and sellers:", error);
    //         return Responder.sendFailure(res, "Something went wrong", 500);
    //     }
    // };

    this.findZonesContainingUser = async function (res, req) {
        try {
            let userLat = parseFloat(req.query.lat);
            let userLong = parseFloat(req.query.long);
    
            if (!userLat || !userLong) {
                return Responder.sendFailure(res, "Latitude and Longitude are required", 400);
            }
    
            // Step 1: Find the area where user's lat-long falls in
            let allAreas = await AreaModel.find();
            let matchedZoneId = null;
    
            for (const area of allAreas) {
                let polygon = area.polygoneLatelong.map(coord => [coord.lat, coord.lng]);
    
                if (Utils.isPointInPolygon([userLat, userLong], polygon)) {
                    matchedZoneId = area.zoneId;
                    break;
                }
            }
    
            if (!matchedZoneId) {
                return Responder.sendFailure(res, "No zones found for the given location", 404);
            }
    
            // Step 2: Find sellers in the zone
            let zoneAreas = await AreaModel.find({ zoneId: matchedZoneId });
            let sellersInZone = [];
    
            for (const zoneArea of zoneAreas) {
                let areaPolygon = zoneArea.polygoneLatelong.map(coord => [coord.lat, coord.lng]);
    
                let sellers = await SellerModel.find({
                    "location.branch.lat": { $exists: true },
                    "location.branch.long": { $exists: true }
                });
    
                sellers.forEach(seller => {
                    let sellerLat = seller.location.branch.lat;
                    let sellerLong = seller.location.branch.long;
    
                    if (Utils.isPointInPolygon([sellerLat, sellerLong], areaPolygon)) {
                        // Calculate distance between user and seller
                        let distanceToSeller = Utils.calculateDistanceOne(userLat, userLong, sellerLat, sellerLong);
    
                        // Estimate First Mile (Pickup Time)
                        let preparationTime = seller.avgPreparationTime || 10; // Default 10 mins
                        let riderPickupTime = distanceToSeller * 2; // Assuming 2 min per km
                        let firstMileTime = preparationTime + riderPickupTime;
    
                        // Estimate Second Mile (Delivery Time)
                        let deliveryTime = Math.min(distanceToSeller * 4, 16); // Max 16 mins
                        // console.log("seller",seller,"seller");return;
                        sellersInZone.push({
                            ...seller.toObject(), // Convert Mongoose object to plain JSON
                            firstMileTime, // Add First Mile Time
                            deliveryTime // Add Second Mile Time
                        });
                    }
                });
            }
    
            // Sort sellers by first mile time (fastest pickup first)
            sellersInZone.sort((a, b) => a.firstMileTime - b.firstMileTime);
    
            if (sellersInZone.length > 0) {
                return Responder.sendSuccess(res, "Nearest Sellers", 200, sellersInZone);
            } else {
                return Responder.sendFailure(res, "No sellers found inside the zone", 404);
            }
    
        } catch (error) {
            console.error("Error finding zones and sellers:", error);
            return Responder.sendFailure(res, "Something went wrong", 500);
        }
    };
    

    this.createSeller = async function (res, req) {
        try {
            
            let sellerId = "seller_" + Utils.getNanoId();
    
            let seller = {
                sellerId: sellerId,
                sellerName: req.body.sellerName,
                phone: req.body.phone,
                location: {
                    branch: req.body.location?.branch || {}
                },
                audit: {
                    createdBy: req.body.audit?.createdBy || {},
                    updatedBy: req.body.audit?.updatedBy || {},
                    deletedBy: req.body.audit?.deletedBy || {}
                },
                hasDeleted: req.body.hasDeleted || false
            };
    
            let addSeller = new SellerModel(seller);
            let result = await addSeller.save();
    
            if (result) {
                return Responder.sendSuccess(res, "Seller Created Successfully", 201, result);
            } else {
                return Responder.sendFailure(res, "Error while creating seller", 400);
            }
    
        } catch (error) {
            console.error("Error while creating seller:", error);
            return Responder.sendFailure(res, "Something went wrong", 500);
        }
    };

    this.createPartner = async function (res, req) {
        try {
          let partnerId = "partner_" + Utils.getNanoId(); // Generate a unique partner ID
    
          let partner = {
            partnerId: partnerId,
            areaId: req.body.areaId,
            name: req.body.name,
            phone: req.body.phone,
            location: {
              lat: req.body.location?.lat || null,
              long: req.body.location?.long || null,
              doorNo: req.body.location?.doorNo || "",
              streetName: req.body.location?.streetName || "",
              landmark: req.body.location?.landmark || "",
            },
            audit: {
              createdBy: req.body.audit?.createdBy || {},
              updatedBy: req.body.audit?.updatedBy || {},
              deletedBy: req.body.audit?.deletedBy || {},
            },
            hasDeleted: req.body.hasDeleted || false,
          };
    
          let newPartner = new PartnerModel(partner);
          let result = await newPartner.save();
    
          if (result) {
            return Responder.sendSuccess(
              res,
              "Partner Created Successfully",
              201,
              result
            );
          } else {
            return Responder.sendFailure(res, "Error while creating partner", 400);
          }
        } catch (error) {
          console.error("Error while creating partner:", error);
          return Responder.sendFailure(res, "Something went wrong", 500);
        }
      };

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
    
          // Step 1: Find the Area ID where seller's location falls in
          let allAreas = await AreaModel.find();
          let matchedArea = allAreas.find((area) =>
            Utils.isPointInPolygon(
              [sellerLat, sellerLong],
              area.polygoneLatelong.map((coord) => [coord.lat, coord.long])
            )
          );
    
          if (!matchedArea) {
            return Responder.sendFailure(
              res,
              "No area found for the given location",
              404
            );
          }
    
          let zoneId = matchedArea.zoneId;
    
          // Step 2: Get all areas mapped to the same Zone ID
          let mappedAreas = await AreaModel.find({ zoneId });
    
          // Step 3: Get all partners in these mapped areas
          let partnersInZone = [];
          for (const area of mappedAreas) {
            let areaPolygon = area.polygoneLatelong.map((coord) => [
              coord.lat,
              coord.long,
            ]);
    
            let partners = await PartnerModel.find({
              "location.lat": { $exists: true },
              "location.long": { $exists: true },
            });
    
            partners.forEach((partner) => {
              let partnerLat = partner.location.lat;
              let partnerLong = partner.location.long;
    
              if (Utils.isPointInPolygon([partnerLat, partnerLong], areaPolygon)) {
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
    
          // Step 4: Find the nearest delivery partner
          let nearestPartner = partnersInZone.reduce((nearest, partner) => {
            let distance = Utils.calculateDistance(
              sellerLat,
              sellerLong,
              partner.location.lat,
              partner.location.long
            );
            return !nearest || distance < nearest.distance
              ? { partner, distance }
              : nearest;
          }, null);
    
          return Responder.sendSuccess(res, "Partners fetched successfully", 200, {
            nearestPartner: nearestPartner.partner,
            allPartners: partnersInZone,
          });
        } catch (error) {
          console.error("Error finding nearest and zone partners:", error);
          return Responder.sendFailure(res, "Something went wrong", 500);
        }
      };

      this.categoryAddFromSeller = async function (req, res) {
        try {

            const { sellerId,category } = req.body; 

            let categoryId = "category_"+Utils.getNanoId();

            let item = {
                categoryId,
                sellerId,
                category
            }

            let addCategory = new CategoryModel(item);
            let result = await addCategory.save();

            if(result){
                return Responder.sendSuccess(res,"Category Added Successfully, Waiting for the Approval",201,result);
            } else {
                  return Responder.sendFailure(res, "Error while adding category", 400);
            }

            
        } catch (error) {
            return Responder.sendFailure(res, "Something went wrong", 500);
        }
      }

      this.subCategoryAddFromSeller = async function (req, res) {
        try {
            const { sellerId, categoryId, dishName, dishType, dishImage, servingSize, description, dishPrice, gst, packagePrice, finalDishPrice } = req.body;
    
            if (!sellerId || !categoryId || !dishName || !dishPrice) {
                return Responder.sendFailure(res, "Missing required fields", 400);
            }
    
            let subCategoryId = "subcategory_" + Utils.getNanoId();
    
            let item = {
                subCategoryId,
                sellerId,
                categoryId,
                dishName,
                dishType,
                dishImage,
                servingSize,
                description,
                dishPrice,
                gst,
                packagePrice,
                finalDishPrice,
                approvalStatus: "inactive", // Waiting for approval
                status: "inactive",
            };
    
            let addSubCategory = new SubCategoryModel(item);
            let result = await addSubCategory.save();
    
            if (result) {
                return Responder.sendSuccess(res, "Subcategory Added Successfully, Waiting for Approval", 201, result);
            } else {
                return Responder.sendFailure(res, "Error while adding subcategory", 400);
            }
    
        } catch (error) {
            console.error("Error while adding subcategory:", error);
            return Responder.sendFailure(res, "Something went wrong", 500);
        }
    };

    this.getCategoriesBySeller = async function (req, res) {
        try {
            const { sellerId } = req.params;
    
            if (!sellerId) {
                return Responder.sendFailure(res, "Seller ID is required", 400);
            }
    
            let categories = await CategoryModel.find({ sellerId, hasDeleted: false });
    
            if (!categories || categories.length === 0) {
                return Responder.sendFailure(res, "No categories found for this seller", 404);
            }
    
            return Responder.sendSuccess(res, "Categories fetched successfully", 200, categories);
        } catch (error) {
            console.error("Error fetching categories:", error);
            return Responder.sendFailure(res, "Something went wrong", 500);
        }
    };
    
    this.getSubcategoriesBySeller = async function (req, res) {
        try {
            const { sellerId, categoryId } = req.params;
    
            if (!sellerId || !categoryId) {
                return Responder.sendFailure(res, "Seller ID and Category ID are required", 400);
            }
    
            let subcategories = await SubCategoryModel.find({ sellerId, categoryId, hasDeleted: false });
    
            if (!subcategories || subcategories.length === 0) {
                return Responder.sendFailure(res, "No subcategories found for this seller and category", 404);
            }
    
            return Responder.sendSuccess(res, "Subcategories fetched successfully", 200, subcategories);
        } catch (error) {
            console.error("Error fetching subcategories:", error);
            return Responder.sendFailure(res, "Something went wrong", 500);
        }
    };
    
    

}

module.exports = new Controller();  