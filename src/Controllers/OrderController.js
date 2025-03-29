var Utils = require("../Helpers/Utils");
var Socket = require("../Helpers/socketIo");
var Responder = require("../Helpers/Responder");
let Config = require("../Configs/Config");
const ZoneModel = require("../Models/ZoneModel");
const AreaModel = require("../Models/AreaModel");
const OneAppUserModel = require("../Models/OneAppUserModel");
const ZoneController = require("../Controllers/ZoneController");
const NotificationService = require("../Services/NotificationService");
const SellerModel = require("../Models/SellerModel");
const OrderModel = require("../Models/OrderModel");
const axios = require("axios");
const CategoryModel = require("../Models/CategoryModel");
const SubCategoryModel = require("../Models/SubCategoryModel");
const PartnerModel = require("../Models/PartnerModel");
const Admin = require("firebase-admin");
const serviceAccount = require("../Helpers/one-app-427bf-firebase-adminsdk-xer87-95a00e6f87.json");
const otp_expiry_time = 5 * 60 * 1000;
const generateOtp = () => "1234";
const jwt = require("jsonwebtoken");

function Controller() {
  this.placeOrder = async function (req, res) {
    try {
      const { userId, items, totalAmount, lat, long, paymentMethod, sellerId } =
        req.body;
      const { io, sellers } = req;
      if (
        !userId ||
        !items ||
        !totalAmount ||
        !lat ||
        !long ||
        !paymentMethod
      ) {
        return Responder.sendFailure(res, "Missing required fields", 400);
      }

      if (!Array.isArray(items) || items.length === 0) {
        return Responder.sendFailure(res, "Items cannot be empty", 400);
      }

      for (const item of items) {
        if (
          !item.categoryId ||
          !item.subCategoryId ||
          !item.productName ||
          !item.quantity ||
          !item.dishPrice ||
          !item.gst ||
          !item.packagePrice ||
          !item.finalDishPrice
        ) {
          return Responder.sendFailure(res, "Invalid item details", 400);
        }
      }

      let selectedSeller;
      let user;
      // If sellerId is provided, use it directly
      // if (sellerId) {

      user = await OneAppUserModel.findOne({ userId });
      if (!user) {
        return Responder.sendFailure(res, "user not found", 404);
      }
      console.log(user, "------------------>");
      selectedSeller = await SellerModel.findOne({ sellerId });
      if (!selectedSeller) {
        return Responder.sendFailure(res, "Seller not found", 404);
      }
      // }
      // else {
      //     // Find nearby sellers based on user's location
      //     let sellersResponse = await Utils.findZonesContainingUser(res, { query: { lat, long } });

      //     if (!sellersResponse.data || sellersResponse.data.length === 0) {
      //         return Responder.sendFailure(res, "No sellers available", 404);
      //     }

      //     selectedSeller = sellersResponse.data[0]; // Pick the first nearest seller
      // }

      // Calculate total amount from items (optional validation)
      // let calculatedTotal = items.reduce(
      //   (sum, item) => sum + item.finalDishPrice * item.quantity,
      //   0
      // );
      // // console.log("calculatedTotal",calculatedTotal,"calculatedTotal");return;
      // if (calculatedTotal !== totalAmount) {
      //   return Responder.sendFailure(res, "Total amount mismatch", 400);
      // }

      // Create an order
      let order = new OrderModel({
        orderId: "order_" + Utils.getNanoId(),
        user: {
          userId: user.userId,
          name: user.name,
          phoneNumber: user.phone,
          location: {
            lat: user.location.home.lat,
            long: user.location.home.lng,
          },
        },
        seller: {
          sellerId: selectedSeller.sellerId,
          name: selectedSeller.sellerName,
          contact: selectedSeller.phone,
          location: {
            lat: selectedSeller.location.branch.lat,
            long: selectedSeller.location.branch.long,
          },
        },
        items,
        totalAmount,
        status: "pending",
        paymentStatus: "pending",
        paymentMethod,
        location: { lat, long },
        audit: {
          createdBy: { id: userId, name: "User" }, // Ideally, replace "User" with actual user name
        },
      });

      await order.save();

      // Notify the delivery partner via Socket.IO
      console.log("seller Map:", [...sellers.entries()]);
      console.log("Looking up partnerId:", sellerId);
      const sellerrSocketId = sellers.get(sellerId);
      console.log("sellerrSocketId:", sellerrSocketId);

      if (sellerrSocketId) {
        io.to(sellerrSocketId).emit("orderCreated", {
          orderId: order.orderId,
          sellerId: order.seller.sellerId,
          deliveryDetails: order.deliveryPartner,
          mapsData: order.mapsData,
          message: "New order created to you",
        });
        console.log(`Notified seller ${sellerId}`);
      } else {
        console.log(` Seller ${sellerId} not connected`);
      }

      return Responder.sendSuccess(
        res,
        "Order placed successfully",
        201,
        order
      );
    } catch (error) {
      console.error("Error placing order:", error);
      return Responder.sendFailure(res, "Something went wrong", 500);
    }
  };

  this.getOrdersBySellerId = async function (req, res) {
    try {
      const { sellerId } = req.query;

      console.log(req);
      if (!sellerId) {
        return Responder.sendFailure(res, "Missing required fields", 400);
      }
      let order = await OrderModel.findOne({ "seller.sellerId": sellerId });

      if (!sellerId) {
        return Responder.sendFailure(res, "Order not found", 404);
      }

      return Responder.sendSuccess(res, "Orders get successfully", 201, order);
    } catch (error) {
      console.error("Error get orders:", error);
      return Responder.sendFailure(res, "Something went wrong", 400);
    }
  };

  this.acceptOrderForSeller = async function (req, res) {
    try {
      const { orderId, sellerId, preparingTime } = req.query;
      const { io, deliveryPartners, users } = req;
      if (!orderId || !sellerId) {
        return Responder.sendFailure(res, "Missing required fields", 400);
      }

      let order = await OrderModel.findOne({
        orderId,
        "seller.sellerId": sellerId,
      });

      if (!order) {
        return Responder.sendFailure(res, "Order not found", 404);
      }

      order.status = "preparing";
      await order.save();

      let seller = await SellerModel.findOne(
        { sellerId: order.seller.sellerId },
        { location: 1 }
      );
      if (!seller) {
        return Responder.sendFailure(res, "Seller not found", 404);
      }

      let partners = await Utils.findZonesContainingDeliveryPartner(res, {
        body: {
          lat: seller.location.branch.lat,
          long: seller.location.branch.long,
        },
      });

      if (
        !partners ||
        !partners.allPartners ||
        partners.allPartners.length === 0
      ) {
        return Responder.sendFailure(
          res,
          "No delivery partners available",
          404
        );
      }

      let nearestPartner = partners.nearestPartner;

      let waypoints = `${seller.location.branch.lat},${seller.location.branch.long}`;

      let directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${nearestPartner.partner.location.lat},${nearestPartner.partner.location.long}&destination=${order.user?.location.lat},${order.user?.location.long}&waypoints=${waypoints}&key=${Config.google.mapApi}`;

      let directionsResponse = await axios.get(directionsUrl);

      let routeDetails = directionsResponse.data.routes[0].legs;

      console.log(routeDetails, "---------------> route details");

      let totalDuration = 0;
      let totalDistance = 0;

      routeDetails.forEach((leg) => {
        totalDuration += leg.duration.value;
        totalDistance += leg.distance.value;
      });

      let overallETA = totalDuration + parseInt(preparingTime);
      let ETA_in_minutes = Utils.convertSecondsToMinutes(overallETA);

      order.seller.preparingTime = {
        text: Utils.convertSecondsToMinutes(preparingTime),
        value: preparingTime,
      };
      order.seller.timestamps.acceptedAt = Date.now();
      order.seller.timestamps.preparingStartAt = Date.now();
      order.deliveryPartner = {
        partnerId: nearestPartner.partner.partnerId,
        name: nearestPartner.partner.name,
        contact: nearestPartner.partner.phone,
        tracking: {
          currentLocation: {
            lat: nearestPartner.partner.location.lat,
            long: nearestPartner.partner.location.long,
          },
          estimatedDeliveryTime: {
            text: ETA_in_minutes,
            value: overallETA.toString(),
            date: new Date(Date.now() + overallETA * 1000).toISOString(),
          },
          totalDistance: `${(totalDistance / 1000).toFixed(2)} km`,
        },
      };

      order.mapsData = {
        deliveryPartnerToSeller: {
          distance: routeDetails[0].distance,
          duration: routeDetails[0].duration,
        },
        sellerToUser: {
          distance: routeDetails[1].distance,
          duration: routeDetails[1].duration,
        },
      };

      await order.save();

      // Notify the delivery partner via Socket.IO

      const partnerSocketId = deliveryPartners.get(
        nearestPartner.partner.partnerId
      );

      const userSocketId = users.get(order.user.userId);
      if (userSocketId) {
        io.to(userSocketId).emit("orderPlaced", {
          orderId: order.orderId,
          sellerId: order.seller.sellerId,
          deliveryDetails: order.deliveryPartner,
          mapsData: order.mapsData,
          message: "Order Placed successfully",
        });
        console.log(`Notified user ${order.user.userId}`);
      } else {
        console.log(`user ${order.user.userId} not connected`);
      }

      if (partnerSocketId) {
        io.to(partnerSocketId).emit("orderAssigned", {
          orderId: order.orderId,
          sellerId: order.seller.sellerId,
          deliveryDetails: order.deliveryPartner,
          mapsData: order.mapsData,
          message: "New order assigned to you",
        });
        console.log(
          `Notified delivery partner ${nearestPartner.partner.partnerId}`
        );
      } else {
        console.log(
          `Delivery partner ${nearestPartner.partner.partnerId} not connected`
        );
      }

      return Responder.sendSuccess(
        res,
        "Order accepted, delivery partner notified",
        200,
        order
      );
    } catch (error) {
      console.error("Error accepting order:", error);
      return Responder.sendFailure(res, "Something went wrong", 500);
    }
  };

  this.acceptOrderForPartner = async function (req, res) {
    try {
      const { orderId, partnerId } = req.query;

      if (!orderId || !partnerId) {
        return Responder.sendFailure(res, "Missing required fields", 400);
      }

      // Fetch the order
      let order = await OrderModel.findOne({
        orderId,
        "deliveryPartner.partnerId": partnerId,
      });

      if (!order) {
        return Responder.sendFailure(res, "Order not found", 404);
      }
      console.log(111);
      // Update the accepted timestamp if not already set
      if (order) {
        console.log("--------------->");
        order.deliveryPartner.timestamps.acceptedAt = new Date();
        await order.save();
      }
      console.log(222);
      // Prepare route data for delivery partner to seller
      const routeToSeller = {
        distance: order.mapsData.deliveryPartnerToSeller.distance,
        duration: order.mapsData.deliveryPartnerToSeller.duration,
        from: order.deliveryPartner.tracking.currentLocation,
        to: order.seller.location,
      };
      const routeToUser = {
        distance: order.mapsData.sellerToUser.distance,
        duration: order.mapsData.sellerToUser.duration,
        from: order.seller.location,
        to: order.user.location,
      };
      return Responder.sendSuccess(res, "Order accepted", 200, {
        order,
        route: { routeToSeller, routeToUser },
      });
    } catch (error) {
      console.error("Error accepting order:", error);
      return Responder.sendFailure(res, "Something went wrong", 500);
    }
  };
  this.reachedPickupLocationrForPartner = async function (req, res) {
    try {
      const { orderId, partnerId } = req.query;

      if (!orderId || !partnerId) {
        return Responder.sendFailure(res, "Missing required fields", 400);
      }

      // Fetch the order
      let order = await OrderModel.findOne({
        orderId,
        "deliveryPartner.partnerId": partnerId,
      });

      if (!order) {
        return Responder.sendFailure(res, "Order not found", 404);
      }

      // Check if order was accepted
      if (order) {
        return Responder.sendFailure(res, "Order not yet accepted", 400);
      }

      // Update the pickedUpAt timestamp
      order.deliveryPartner.timestamps.reachedPickupAt = new Date();
      await order.save();

      // Prepare route data for seller to user
      const routeToUser = {
        distance: order.mapsData.sellerToUser.distance,
        duration: order.mapsData.sellerToUser.duration,
        from: order.seller.location,
        to: order.user.location,
      };

      return Responder.sendSuccess(res, "Order picked up", 200, {
        order,
        route: routeToUser,
      });
    } catch (error) {
      console.error("Error picking up order:", error);
      return Responder.sendFailure(res, "Something went wrong", 500);
    }
  };
  // New method to handle pickup
  this.pickupOrderForPartner = async function (req, res) {
    try {
      const { orderId, partnerId } = req.query;

      if (!orderId || !partnerId) {
        return Responder.sendFailure(res, "Missing required fields", 400);
      }

      // Fetch the order
      let order = await OrderModel.findOne({
        orderId,
        "deliveryPartner.partnerId": partnerId,
      });

      if (!order) {
        return Responder.sendFailure(res, "Order not found", 404);
      }

      // Check if order was accepted
      if (order) {
        return Responder.sendFailure(res, "Order not yet accepted", 400);
      }

      // Update the pickedUpAt timestamp
      order.deliveryPartner.timestamps.pickedUpAt = new Date();
      order.status = "picked_up"; // Update status to reflect pickup
      await order.save();

      // Prepare route data for seller to user
      const routeToUser = {
        distance: order.mapsData.sellerToUser.distance,
        duration: order.mapsData.sellerToUser.duration,
        from: order.seller.location,
        to: order.user.location,
      };

      return Responder.sendSuccess(res, "Order picked up", 200, {
        order,
        route: routeToUser,
      });
    } catch (error) {
      console.error("Error picking up order:", error);
      return Responder.sendFailure(res, "Something went wrong", 500);
    }
  };

  this.getOrdersByPartnerId = async function (req, res) {
    try {
      const { partnerId } = req.query;
      const { io, deliveryPartners } = req;

      if (!partnerId) {
        return Responder.sendFailure(res, "Missing required fields", 400);
      }
      let order = await OrderModel.findOne({
        "deliveryPartner.partnerId": partnerId,
      });

      if (!partnerId) {
        return Responder.sendFailure(res, "Order not found", 404);
      }

      let latLong = [
        { lat: 13.021793, long: 80.206473 },
        { lat: 13.021615, long: 80.206494 },
        { lat: 13.021168, long: 80.206479 },
        { lat: 13.020177, long: 80.206468 },
        { lat: 13.019533, long: 80.20642 },
        { lat: 13.018951, long: 80.206254 },
        { lat: 13.017948, long: 80.205894 },
        { lat: 13.017848, long: 80.20568 },
        { lat: 13.018195, long: 80.205793 },
        { lat: 13.018786, long: 80.20603 },
        { lat: 13.019239, long: 80.206128 },
        { lat: 13.020917, long: 80.20629 },
        { lat: 13.021973, long: 80.206307 },
        { lat: 13.022434, long: 80.206292 },
      ];

      const partnerSocketId = deliveryPartners.get(
        order.deliveryPartner.partnerId
      );

      if (partnerSocketId) {
        const sendCoordinates = async () => {
          try {
            for (let i = 0; i < latLong.length; i++) {
              const coord = latLong[i];
              // Check if socket is still connected before emitting
              if (io.sockets.sockets.get(partnerSocketId)) {
                io.to(partnerSocketId).emit("partnerLocationUpdate", {
                  partnerId: order.deliveryPartner.partnerId,
                  location: { lat: coord.lat, long: coord.long },
                  message: "partnerLocationUpdate",
                  sequence: i + 1, // Adding sequence number for debugging
                  total: latLong.length, // Total number of coordinates
                });
                console.log(
                  `Sent coordinate ${i + 1}/${
                    latLong.length
                  } to ${partnerSocketId}: ${coord.lat}, ${coord.long}`
                );
                await new Promise((resolve) => setTimeout(resolve, 2000));
              } else {
                console.log(
                  `Socket ${partnerSocketId} disconnected during transmission`
                );
                break;
              }
            }
            console.log(
              `Completed sending all coordinates to ${partnerSocketId}`
            );
          } catch (error) {
            console.error(`Error sending coordinates: ${error}`);
          }
        };

        sendCoordinates();
      } else {
        console.log(`User ${order.user.userId} not connected`);
      }

      return Responder.sendSuccess(res, "Orders get successfully", 201, order);
    } catch (error) {
      console.error("Error get orders:", error);
      return Responder.sendFailure(res, "Something went wrong", 400);
    }
  };

  this.trackOrder = async function (req, res) {
    try {
      const { orderId } = req.params;

      let order = await OrderModel.findOne({ orderId });

      if (!order) {
        return Responder.sendFailure(res, "Order not found", 404);
      }

      if (!order.deliveryPartnerId) {
        return Responder.sendFailure(
          res,
          "Delivery partner not assigned yet",
          400
        );
      }

      let deliveryPartner = await PartnerModel.findOne({
        partnerId: order.deliveryPartnerId,
      });

      if (!deliveryPartner) {
        return Responder.sendFailure(
          res,
          "Delivery partner details not found",
          404
        );
      }

      // Use Google Maps Directions API to get route
      let googleApiKey = "AIzaSyBdgzn86CxjJDfA5PHD6Wq07a6Dlyh7F0s";
      let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${deliveryPartner.location.lat},${deliveryPartner.location.long}&destination=${order.location.lat},${order.location.long}&key=${googleApiKey}`;

      let response = await axios.get(url);

      if (response.data.status !== "OK") {
        return Responder.sendFailure(res, "Failed to fetch route", 500);
      }

      return Responder.sendSuccess(
        res,
        "Route fetched successfully",
        200,
        response.data.routes
      );
    } catch (error) {
      console.error("Error tracking order:", error);
      return Responder.sendFailure(res, "Something went wrong", 500);
    }
  };
}

module.exports = new Controller();
