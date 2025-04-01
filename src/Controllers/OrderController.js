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
      const { userId, sellers, totalAmount, lat, long, paymentMethod } =
        req.body;
      const { io, sellers: sellerSocketMap } = req;

      // Validate required fields
      if (
        !userId ||
        !sellers ||
        !totalAmount ||
        !lat ||
        !long ||
        !paymentMethod
      ) {
        return Responder.sendFailure(res, "Missing required fields", 400);
      }

      if (!Array.isArray(sellers) || sellers.length === 0) {
        return Responder.sendFailure(res, "Sellers cannot be empty", 400);
      }

      // Validate each seller and their items
      for (const seller of sellers) {
        if (
          !seller.sellerId ||
          !seller.items ||
          !Array.isArray(seller.items) ||
          seller.items.length === 0
        ) {
          return Responder.sendFailure(
            res,
            "Invalid seller or items data",
            400
          );
        }

        for (const item of seller.items) {
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

        // Calculate subtotal for each seller
        seller.subTotal = seller.items.reduce(
          (sum, item) => sum + item.finalDishPrice * item.quantity,
          0
        );
      }

      // Validate totalAmount matches the sum of subTotals
      // const calculatedTotal = sellers.reduce(
      //   (sum, seller) => sum + seller.subTotal,
      //   0
      // );
      // if (calculatedTotal !== totalAmount) {
      //   return Responder.sendFailure(res, "Total amount mismatch", 400);
      // }

      // Fetch user details
      const user = await OneAppUserModel.findOne({ userId });
      if (!user) {
        return Responder.sendFailure(res, "User not found", 404);
      }

      // Fetch seller details and prepare sellers array
      const sellersData = [];
      for (const seller of sellers) {
        const selectedSeller = await SellerModel.findOne({
          sellerId: seller.sellerId,
        });
        if (!selectedSeller) {
          return Responder.sendFailure(
            res,
            `Seller ${seller.sellerId} not found`,
            404
          );
        }

        sellersData.push({
          sellerId: selectedSeller.sellerId,
          name: selectedSeller.sellerName,
          contact: selectedSeller.phone,
          location: {
            lat: selectedSeller.location.branch.lat,
            long: selectedSeller.location.branch.long,
          },
          items: seller.items,
          subTotal: seller.subTotal,
        });
      }

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
        sellers: sellersData,
        totalAmount,
        status: "pending",
        paymentStatus: "pending",
        paymentMethod,
        deliveryPartners: [], // Initially empty; can be assigned later
        mapsData: {
          deliveryPartnersToSellers: [],
          sellersToUser: sellersData.map((seller) => ({
            sellerId: seller.sellerId,
            distance: { text: null, value: null },
            duration: { text: null, value: null },
          })),
        },
        audit: {
          createdBy: { id: userId, name: user.name }, // Use actual user name
        },
      });

      await order.save();

      // Notify sellers via Socket.IO
      for (const seller of sellersData) {
        const sellerSocketId = sellerSocketMap.get(seller.sellerId);
        console.log(
          "Looking up sellerId:",
          seller.sellerId,
          "SocketId:",
          sellerSocketId
        );

        if (sellerSocketId) {
          io.to(sellerSocketId).emit("orderCreated", {
            orderId: order.orderId,
            sellerId: seller.sellerId,
            items: seller.items,
            message: `New order created for seller ${seller.sellerId}`,
          });
          console.log(`Notified seller ${seller.sellerId}`);
        } else {
          console.log(`Seller ${seller.sellerId} not connected`);
        }
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

      if (!sellerId) {
        return Responder.sendFailure(
          res,
          "Missing required field: sellerId",
          400
        );
      }

      const orders = await OrderModel.aggregate([
        { $match: { "sellers.sellerId": sellerId } },
        { $unwind: "$sellers" },
        { $match: { "sellers.sellerId": sellerId } },
        {
          $project: {
            orderId: 1,
            totalAmount: 1,
            status: 1,
            paymentStatus: 1,
            paymentMethod: 1,
            eta: 1,
            hasDeleted: 1,
            user: 1,
            seller: "$sellers", // Only the matching seller
            deliveryPartner: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$deliveryPartners",
                    cond: { $in: [sellerId, "$$this.assignedSellerIds"] },
                  },
                },
                0, // Take the first matching delivery partner (if any)
              ],
            },
            mapsData: {
              deliveryPartnersToSellers: {
                $filter: {
                  input: "$mapsData.deliveryPartnersToSellers",
                  cond: { $eq: ["$$this.sellerId", sellerId] },
                },
              },
              sellersToUser: {
                $filter: {
                  input: "$mapsData.sellersToUser",
                  cond: { $eq: ["$$this.sellerId", sellerId] },
                },
              },
            },
            audit: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]);

      if (!orders || orders.length === 0) {
        return Responder.sendFailure(
          res,
          "No orders found for this seller",
          404
        );
      }

      return Responder.sendSuccess(
        res,
        "Orders retrieved successfully",
        200,
        orders
      );
    } catch (error) {
      console.error("Error retrieving orders:", error);
      return Responder.sendFailure(res, "Something went wrong", 500);
    }
  };

  this.getOrdersByUserId = async function (req, res) {
    try {
      const { userId } = req.query;

      if (!userId) {
        return Responder.sendFailure(
          res,
          "Missing required field: userId   ",
          400
        );
      }

      const orders = await OrderModel.find({
        status: { $nin: ["delivered", "cancelled", "delivered"] },
      });

      if (!orders || orders.length === 0) {
        return Responder.sendFailure(
          res,
          "No orders found for this users",
          404
        );
      }

      return Responder.sendSuccess(
        res,
        "Orders retrieved successfully",
        200,
        orders
      );
    } catch (error) {
      console.error("Error retrieving orders:", error);
      return Responder.sendFailure(res, "Something went wrong", 500);
    }
  };
  this.acceptOrderForSeller = async function (req, res) {
    try {
      const { orderId, sellerId, preparingTime } = req.query;
      const { io, deliveryPartners, users } = req;

      console.log("Request params:", orderId, sellerId, preparingTime);

      if (!orderId || !sellerId || !preparingTime) {
        return Responder.sendFailure(res, "Missing required fields", 400);
      }

      let order = await OrderModel.findOne({
        orderId,
        "sellers.sellerId": sellerId,
      });
      if (!order) {
        return Responder.sendFailure(res, "Order or seller not found", 404);
      }

      const sellerIndex = order.sellers.findIndex(
        (s) => s.sellerId === sellerId
      );
      if (sellerIndex === -1) {
        return Responder.sendFailure(res, "Seller not found in order", 404);
      }

      order.sellers[sellerIndex].timestamps.acceptedAt = new Date();
      order.sellers[sellerIndex].timestamps.preparingStartAt = new Date();
      order.sellers[sellerIndex].preparingTime = {
        text: Utils.convertSecondsToMinutes(preparingTime),
        value: preparingTime,
      };

      const allSellersAccepted = order.sellers.every(
        (s) => s.timestamps.acceptedAt
      );
      if (allSellersAccepted) {
        order.status = "preparing";
      }

      const seller = await SellerModel.findOne({ sellerId }, { location: 1 });
      if (!seller) {
        return Responder.sendFailure(res, "Seller not found", 404);
      }

      const partnersResponse = await Utils.findZonesContainingDeliveryPartner(
        res,
        {
          body: {
            lat: seller.location.branch.lat,
            long: seller.location.branch.long,
          },
        }
      );

      if (
        !partnersResponse?.allPartners ||
        partnersResponse.allPartners.length === 0 ||
        partnersResponse === undefined
      ) {
        return Responder.sendFailure(
          res,
          "No delivery partners available",
          404
        );
      }
      // console.log("partnersResponse", partnersResponse, "partnersResponse");
      // return;
      const nearestPartner = partnersResponse.nearestPartner;

      // Google Maps Directions API for this seller to user
      const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${seller.location.branch.lat},${seller.location.branch.long}&destination=${order.user.location.lat},${order.user.location.long}&key=${Config.google.mapApi}`;
      const directionsResponse = await axios.get(directionsUrl);
      const routeDetails = directionsResponse.data.routes[0]?.legs[0];

      if (!routeDetails) {
        return Responder.sendFailure(res, "Failed to calculate route", 400);
      }

      const sellerToUserDistance = routeDetails.distance.value;
      const sellerToUserDuration = routeDetails.duration.value;
      const overallETA = sellerToUserDuration + parseInt(preparingTime);
      const ETA_in_minutes = Utils.convertSecondsToMinutes(overallETA);

      // Assign or update delivery partner for this seller
      let deliveryPartnerIndex = order.deliveryPartners.findIndex((dp) =>
        dp.assignedSellerIds.includes(sellerId)
      );
      let deliveryPartnerData;
      if (deliveryPartnerIndex === -1) {
        // Assign a new delivery partner
        deliveryPartnerData = {
          partnerId: nearestPartner.partner.partnerId,
          name: nearestPartner.partner.name,
          contact: nearestPartner.partner.phone,
          assignedSellerIds: [sellerId],
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
            totalDistance: {
              text: `${(sellerToUserDistance / 1000).toFixed(2)} km`,
              value: sellerToUserDistance,
            },
          },
        };
        order.deliveryPartners.push(deliveryPartnerData);
        deliveryPartnerIndex = order.deliveryPartners.length - 1;
      } else {
        deliveryPartnerData = order.deliveryPartners[deliveryPartnerIndex];
        deliveryPartnerData.tracking.estimatedDeliveryTime = {
          text: ETA_in_minutes,
          value: overallETA.toString(),
          date: new Date(Date.now() + overallETA * 1000).toISOString(),
        };
        deliveryPartnerData.tracking.totalDistance = {
          text: `${(sellerToUserDistance / 1000).toFixed(2)} km`,
          value: sellerToUserDistance,
        };
      }

      // Update mapsData for this seller and delivery partner
      const partnerLat = deliveryPartnerData.tracking.currentLocation.lat;
      const partnerLong = deliveryPartnerData.tracking.currentLocation.long;
      const partnerToSellerUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${partnerLat},${partnerLong}&destination=${seller.location.branch.lat},${seller.location.branch.long}&key=${Config.google.mapApi}`;
      const partnerToSellerResponse = await axios.get(partnerToSellerUrl);
      const partnerToSellerRoute =
        partnerToSellerResponse.data.routes[0]?.legs[0];

      const mapsDataEntry = {
        deliveryPartnerId: deliveryPartnerData.partnerId,
        sellerId: sellerId,
        distance: partnerToSellerRoute
          ? {
              text: partnerToSellerRoute.distance.text,
              value: partnerToSellerRoute.distance.value,
            }
          : { text: null, value: null },
        duration: partnerToSellerRoute
          ? {
              text: partnerToSellerRoute.duration.text,
              value: partnerToSellerRoute.duration.value,
            }
          : { text: null, value: null },
      };
      order.mapsData.deliveryPartnersToSellers.push(mapsDataEntry);

      const sellerToUserEntry = order.mapsData.sellersToUser.find(
        (entry) => entry.sellerId === sellerId
      );
      if (sellerToUserEntry) {
        sellerToUserEntry.distance = routeDetails.distance;
        sellerToUserEntry.duration = routeDetails.duration;
      }
      await PartnerModel.updateOne(
        {
          partnerId: nearestPartner.partner.partnerId,
        },
        { $set: { workStatus: "assigned" } }
      );
      await order.save();

      // Prepare response with only the relevant seller's data
      const responseData = {
        orderId: order.orderId,
        totalAmount: order.totalAmount,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        eta: order.eta,
        hasDeleted: order.hasDeleted,
        user: order.user,
        seller: order.sellers[sellerIndex],
        deliveryPartner: deliveryPartnerData,
        mapsData: {
          deliveryPartnersToSellers: [mapsDataEntry],
          sellersToUser: [sellerToUserEntry],
        },
        audit: order.audit,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      };

      // Notify the delivery partner and user via Socket.IO
      const partnerSocketId = deliveryPartners.get(
        deliveryPartnerData.partnerId
      );
      const userSocketId = users.get(order.user.userId);

      if (userSocketId) {
        io.to(userSocketId).emit("orderAccepted", {
          orderId: order.orderId,
          sellerId,
          deliveryDetails: deliveryPartnerData,
          mapsData: responseData.mapsData,
          message: `Order accepted by seller ${sellerId}`,
        });
        console.log(`Notified user ${order.user.userId}`);
      } else {
        console.log(`User ${order.user.userId} not connected`);
      }

      if (partnerSocketId) {
        io.to(partnerSocketId).emit("orderAssigned", {
          orderId: order.orderId,
          sellerId,
          deliveryDetails: deliveryPartnerData,
          mapsData: responseData.mapsData,
          message: `New order assigned to you for seller ${sellerId}`,
        });
        console.log(
          `Notified delivery partner ${deliveryPartnerData.partnerId}`
        );
      } else {
        console.log(
          `Delivery partner ${deliveryPartnerData.partnerId} not connected`
        );
      }

      return Responder.sendSuccess(
        res,
        "Order accepted, delivery partner notified",
        200,
        responseData
      );
    } catch (error) {
      console.error("Error accepting order:", error);
      return Responder.sendFailure(res, "Something went wrong", 400);
    }
  };

  this.acceptOrderForPartner = async function (req, res) {
    try {
      const { orderId, partnerId } = req.query;
      const { io, sellers, users } = req;

      if (!orderId || !partnerId) {
        return Responder.sendFailure(res, "Missing required fields", 400);
      }

      // Fetch the order

      let order = await OrderModel.findOne({
        orderId,
        "deliveryPartners.partnerId": partnerId,
      });

      if (!order) {
        return Responder.sendFailure(res, "Order not found", 404);
      }
      // Update the accepted timestamp if not already set
      if (order) {
        order.deliveryPartners[0].timestamps.acceptedAt = new Date();
        await order.save();
      }
      // Prepare route data for delivery partner to seller
      const routeToSeller = {
        distance: order.mapsData.deliveryPartnersToSellers.distance,
        duration: order.mapsData.deliveryPartnersToSellers.duration,
        from: order.deliveryPartners[0].tracking.currentLocation,
        to: order.sellers.location,
      };
      const routeToUser = {
        distance: order.mapsData.sellersToUser.distance,
        duration: order.mapsData.sellersToUser.duration,
        from: order.sellers.location,
        to: order.user.location,
      };

      const sellerSocketId = sellers.get(order.sellers.sellerId);

      const userSocketId = users.get(order.user.userId);
      if (userSocketId) {
        io.to(userSocketId).emit("orderStatusUpdateToUser", {
          orderId: order.orderId,
          sellerId: order.seller.sellerId,
          deliveryDetails: order.deliveryPartner,
          mapsData: order.mapsData,
          message: "Order is accepeted by partner",
        });
        console.log(`Notified user ${order.user.userId}`);
      } else {
        console.log(`user ${order.user.userId} not connected`);
      }

      if (sellerSocketId) {
        io.to(sellerSocketId).emit("orderStatusUpdateToSeller", {
          orderId: order.orderId,
          sellerId: order.seller.sellerId,
          deliveryDetails: order.deliveryseller,
          mapsData: order.mapsData,
          message: " order is accepted",
        });
        console.log(`Notified  seller ${order.sellers.sellerId}`);
      } else {
        console.log(` seller ${order.sellers.sellerId} not connected`);
      }

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
  this.statusUpdate = async function (req, res) {
    console.log(req.query, "------------------->");
    try {
      const { orderId, userId, status } = req.query;
      const { io, sellers, deliveryPartners, users } = req;

      if (!orderId || !userId || !status) {
        return Responder.sendFailure(res, "Missing required fields", 400);
      }

      const userType = userId.split("_")[0];
      let order;
      const validStatuses = {
        seller: ["ready"],
        partner: [
          "reached_pickup_location",
          "picked_up",
          "delivered",
          "reached_user_location",
          "completed",
        ],
        user: ["cancelled"],
      };

      const notifyAllParties = (order, message) => {
        const sellerSocketId = sellers.get(order.seller.sellerId);
        const partnerSocketId = deliveryPartners.get(
          order.deliveryPartner.partnerId
        );
        const userSocketId = users.get(order.user.userId);

        const notificationData = {
          orderId: order.orderId,
          sellerId: order.seller.sellerId,
          deliveryDetails: order.deliveryPartner,
          mapsData: order.mapsData,
          status: order.status,
          message,
        };

        if (sellerSocketId) {
          io.to(sellerSocketId).emit("statusUpdate", notificationData);
          console.log(`Notified seller ${order.seller.sellerId}`);
        }

        if (partnerSocketId) {
          io.to(partnerSocketId).emit("statusUpdate", notificationData);
          console.log(`Notified partner ${order.deliveryPartner.partnerId}`);
        }

        if (userSocketId) {
          io.to(userSocketId).emit("statusUpdate", notificationData);
          console.log(`Notified user ${order.user.userId}`);
        }
      };

      switch (userType) {
        case "seller":
          if (!validStatuses.seller.includes(status)) {
            return Responder.sendFailure(res, "Invalid status for seller", 400);
          }

          order = await OrderModel.findOne({
            orderId,
            "seller.sellerId": userId,
          });

          if (!order) {
            return Responder.sendFailure(res, "Order not found", 404);
          }

          if (status === "ready") {
            order.status = status;
            order.seller.timestamps.readyAt = new Date();
            await order.save();
            notifyAllParties(order, "Order is ready now!");
          }
          break;

        case "partner":
          if (!validStatuses.partner.includes(status)) {
            return Responder.sendFailure(
              res,
              "Invalid status for partner",
              400
            );
          }

          order = await OrderModel.findOne({
            orderId,
            "deliveryPartner.partnerId": userId,
          });

          if (!order) {
            return Responder.sendFailure(res, "Order not found", 404);
          }

          switch (status) {
            case "reached_pickup_location":
              order.deliveryPartner.timestamps.reachedPickupAt = new Date();
              order.status = "reached_pickup_location";
              await order.save();
              notifyAllParties(
                order,
                "Delivery partner has reached pickup location"
              );
              break;
            case "picked_up":
              order.deliveryPartner.timestamps.pickedUpAt = new Date();
              order.seller.timestamps.pickedUpAt = new Date();
              order.status = "picked_up";
              await order.save();
              notifyAllParties(order, "Order has been picked up");
              break;
            case "reached_user_location":
              order.status = "reached_user_location";
              await order.save();
              notifyAllParties(
                order,
                "Delivery partner has  reached the user location"
              );
              break;
            case "delivered":
              order.deliveryPartner.timestamps.deliveredAt = new Date();
              order.status = "delivered";
              await order.save();
              notifyAllParties(order, "Order has been delivered");
              break;
            case "completed":
              order.deliveryPartner.timestamps.deliveredAt = new Date();
              order.status = "completed";
              await order.save();
              notifyAllParties(order, "Order has been completed");
              break;
          }
          break;

        case "user":
          if (!validStatuses.user.includes(status)) {
            return Responder.sendFailure(res, "Invalid status for user", 400);
          }

          order = await OrderModel.findOne({
            orderId,
            "user.userId": userId,
          });

          if (!order) {
            return Responder.sendFailure(res, "Order not found", 404);
          }

          if (status === "cancelled") {
            order.user.timestamps.cancelledAt = new Date();
            order.status = status;
            await order.save();
            notifyAllParties(order, "Order has been cancelled");
          }
          break;

        default:
          return Responder.sendFailure(res, "Invalid user type", 400);
      }

      if (!order) {
        return Responder.sendFailure(res, "Order not found", 404);
      }

      if (userType === "partner" && status === "picked_up") {
        const routeToUser = {
          distance: order.mapsData.sellerToUser.distance,
          duration: order.mapsData.sellerToUser.duration,
          from: order.seller.location,
          to: order.user.location,
        };

        return Responder.sendSuccess(res, "Order status updated", 200, {
          order,
          route: routeToUser,
        });
      }

      return Responder.sendSuccess(res, "Order status updated", 200, { order });
    } catch (error) {
      console.error("Error updating order status:", error);
      return Responder.sendFailure(res, "Something went wrong", 500);
    }
  };

  this.getOrdersByPartnerId = async function (req, res) {
    try {
      const { partnerId } = req.query;
      const { io, deliveryPartners } = req;

      if (!partnerId) {
        return Responder.sendFailure(
          res,
          "Missing required field: partnerId",
          400
        );
      }

      const orders = await OrderModel.aggregate([
        // Match orders where the partnerId exists in the deliveryPartners array
        { $match: { "deliveryPartners.partnerId": partnerId } },
        // Unwind deliveryPartners to process each entry
        { $unwind: "$deliveryPartners" },
        // Filter to keep only the delivery partner with the matching partnerId
        { $match: { "deliveryPartners.partnerId": partnerId } },
        // Group by orderId to eliminate duplicates and collect all assignedSellerIds
        {
          $group: {
            _id: "$orderId",
            totalAmount: { $first: "$totalAmount" },
            status: { $first: "$status" },
            paymentStatus: { $first: "$paymentStatus" },
            paymentMethod: { $first: "$paymentMethod" },
            eta: { $first: "$eta" },
            hasDeleted: { $first: "$hasDeleted" },
            user: { $first: "$user" },
            sellers: { $first: "$sellers" }, // Keep all sellers initially
            assignedSellerIds: { $push: "$deliveryPartners.assignedSellerIds" }, // Collect all assignedSellerIds
            deliveryPartners: { $push: "$deliveryPartners" }, // Collect all delivery partner entries
            mapsData: { $first: "$mapsData" },
            audit: { $first: "$audit" },
            createdAt: { $first: "$createdAt" },
            updatedAt: { $first: "$updatedAt" },
          },
        },
        // Deduplicate deliveryPartnersToSellers entries based on deliveryPartnerId and sellerId
        {
          $set: {
            "mapsData.deliveryPartnersToSellers": {
              $reduce: {
                input: "$mapsData.deliveryPartnersToSellers",
                initialValue: [],
                in: {
                  $cond: {
                    if: {
                      $anyElementTrue: {
                        $map: {
                          input: "$$value",
                          as: "existing",
                          in: {
                            $and: [
                              {
                                $eq: [
                                  "$$existing.deliveryPartnerId",
                                  "$$this.deliveryPartnerId",
                                ],
                              },
                              {
                                $eq: ["$$existing.sellerId", "$$this.sellerId"],
                              },
                            ],
                          },
                        },
                      },
                    },
                    then: "$$value",
                    else: { $concatArrays: ["$$value", ["$$this"]] }, // Add if unique
                  },
                },
              },
            },
          },
        },
        {
          $project: {
            orderId: "$_id",
            totalAmount: 1,
            status: 1,
            paymentStatus: 1,
            paymentMethod: 1,
            eta: 1,
            hasDeleted: 1,
            user: 1,
            sellers: {
              $filter: {
                input: "$sellers",
                cond: {
                  $in: [
                    "$$this.sellerId",
                    {
                      $reduce: {
                        input: "$assignedSellerIds",
                        initialValue: [],
                        in: { $concatArrays: ["$$value", "$$this"] },
                      },
                    },
                  ],
                },
              },
            },
            deliveryPartner: {
              partnerId: partnerId,
              name: { $arrayElemAt: ["$deliveryPartners.name", 0] },
              contact: { $arrayElemAt: ["$deliveryPartners.contact", 0] },
              assignedSellerIds: {
                $reduce: {
                  input: "$assignedSellerIds",
                  initialValue: [],
                  in: { $concatArrays: ["$$value", "$$this"] },
                },
              },
              tracking: { $arrayElemAt: ["$deliveryPartners.tracking", 0] },
              timestamps: { $arrayElemAt: ["$deliveryPartners.timestamps", 0] },
            },
            mapsData: {
              deliveryPartnersToSellers: {
                $filter: {
                  input: "$mapsData.deliveryPartnersToSellers",
                  cond: { $eq: ["$$this.deliveryPartnerId", partnerId] },
                },
              },
              sellersToUser: {
                $filter: {
                  input: "$mapsData.sellersToUser",
                  cond: {
                    $in: [
                      "$$this.sellerId",
                      {
                        $reduce: {
                          input: "$assignedSellerIds",
                          initialValue: [],
                          in: { $concatArrays: ["$$value", "$$this"] },
                        },
                      },
                    ],
                  },
                },
              },
            },
            audit: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]);

      if (!orders || orders.length === 0) {
        return Responder.sendFailure(
          res,
          "No orders found for this partner",
          404
        );
      }

      return Responder.sendSuccess(
        res,
        "Orders retrieved successfully",
        200,
        orders
      );
    } catch (error) {
      console.error("Error retrieving orders:", error);
      return Responder.sendFailure(res, "Something went wrong", 500);
    }
  };

  // this.getOrdersByPartnerId = async function (req, res) {
  //   try {
  //     const { partnerId } = req.query;
  //     const { io, deliveryPartners } = req;

  //     if (!partnerId) {
  //       return Responder.sendFailure(
  //         res,
  //         "Missing required field: partnerId",
  //         400
  //       );
  //     }

  //     const orders = await OrderModel.aggregate([
  //       // Match orders where the partnerId exists in the deliveryPartners array
  //       { $match: { "deliveryPartners.partnerId": partnerId } },
  //       // Unwind deliveryPartners to process each entry
  //       { $unwind: "$deliveryPartners" },
  //       // Filter to keep only the delivery partner with the matching partnerId
  //       { $match: { "deliveryPartners.partnerId": partnerId } },
  //       // Group by orderId to eliminate duplicates and collect all assignedSellerIds
  //       {
  //         $group: {
  //           _id: "$orderId",
  //           totalAmount: { $first: "$totalAmount" },
  //           status: { $first: "$status" },
  //           paymentStatus: { $first: "$paymentStatus" },
  //           paymentMethod: { $first: "$paymentMethod" },
  //           eta: { $first: "$eta" },
  //           hasDeleted: { $first: "$hasDeleted" },
  //           user: { $first: "$user" },
  //           sellers: { $first: "$sellers" }, // Keep all sellers initially
  //           assignedSellerIds: { $push: "$deliveryPartners.assignedSellerIds" }, // Collect all assignedSellerIds
  //           deliveryPartners: { $push: "$deliveryPartners" }, // Collect all delivery partner entries
  //           mapsData: { $first: "$mapsData" },
  //           audit: { $first: "$audit" },
  //           createdAt: { $first: "$createdAt" },
  //           updatedAt: { $first: "$updatedAt" },
  //         },
  //       },
  //       // Deduplicate deliveryPartnersToSellers entries
  //       {
  //         $set: {
  //           "mapsData.deliveryPartnersToSellers": {
  //             $reduce: {
  //               input: "$mapsData.deliveryPartnersToSellers",
  //               initialValue: [],
  //               in: {
  //                 $cond: {
  //                   if: {
  //                     $in: [
  //                       {
  //                         deliveryPartnerId: "$$this.deliveryPartnerId",
  //                         sellerId: "$$this.sellerId",
  //                       },
  //                       "$$value",
  //                     ],
  //                   },
  //                   then: "$$value", // Skip if already present
  //                   else: { $concatArrays: ["$$value", ["$$this"]] }, // Add if unique
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       },
  //       // Project the response, filtering sellers and mapsData based on combined assignedSellerIds
  //       {
  //         $project: {
  //           orderId: "$_id",
  //           totalAmount: 1,
  //           status: 1,
  //           paymentStatus: 1,
  //           paymentMethod: 1,
  //           eta: 1,
  //           hasDeleted: 1,
  //           user: 1,
  //           sellers: {
  //             $filter: {
  //               input: "$sellers",
  //               cond: {
  //                 $in: [
  //                   "$$this.sellerId",
  //                   {
  //                     $reduce: {
  //                       // Flatten the array of assignedSellerIds arrays
  //                       input: "$assignedSellerIds",
  //                       initialValue: [],
  //                       in: { $concatArrays: ["$$value", "$$this"] },
  //                     },
  //                   },
  //                 ],
  //               },
  //             },
  //           },
  //           deliveryPartner: {
  //             partnerId: partnerId,
  //             name: { $arrayElemAt: ["$deliveryPartners.name", 0] },
  //             contact: { $arrayElemAt: ["$deliveryPartners.contact", 0] },
  //             assignedSellerIds: {
  //               $reduce: {
  //                 // Combine all assignedSellerIds into a single array
  //                 input: "$assignedSellerIds",
  //                 initialValue: [],
  //                 in: { $concatArrays: ["$$value", "$$this"] },
  //               },
  //             },
  //             tracking: { $arrayElemAt: ["$deliveryPartners.tracking", 0] }, // Take first for simplicity
  //             timestamps: { $arrayElemAt: ["$deliveryPartners.timestamps", 0] },
  //           },
  //           mapsData: {
  //             deliveryPartnersToSellers: 1, // Already deduplicated in $set stage
  //             sellersToUser: {
  //               $filter: {
  //                 input: "$mapsData.sellersToUser",
  //                 cond: {
  //                   $in: [
  //                     "$$this.sellerId",
  //                     {
  //                       $reduce: {
  //                         input: "$assignedSellerIds",
  //                         initialValue: [],
  //                         in: { $concatArrays: ["$$value", "$$this"] },
  //                       },
  //                     },
  //                   ],
  //                 },
  //               },
  //             },
  //           },
  //           audit: 1,
  //           createdAt: 1,
  //           updatedAt: 1,
  //         },
  //       },
  //     ]);

  //     if (!orders || orders.length === 0) {
  //       return Responder.sendFailure(
  //         res,
  //         "No orders found for this partner",
  //         404
  //       );
  //     }

  //     return Responder.sendSuccess(
  //       res,
  //       "Orders retrieved successfully",
  //       200,
  //       orders
  //     );
  //   } catch (error) {
  //     console.error("Error retrieving orders:", error);
  //     return Responder.sendFailure(res, "Something went wrong", 500);
  //   }
  // };

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
