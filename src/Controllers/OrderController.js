var Utils = require("../Helpers/Utils");
var Responder = require("../Helpers/Responder");
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

      // If sellerId is provided, use it directly
      // if (sellerId) {
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
      let calculatedTotal = items.reduce(
        (sum, item) => sum + item.finalDishPrice * item.quantity,
        0
      );
      // console.log("calculatedTotal",calculatedTotal,"calculatedTotal");return;
      if (calculatedTotal !== totalAmount) {
        return Responder.sendFailure(res, "Total amount mismatch", 400);
      }

      // Create an order
      let order = new OrderModel({
        orderId: "order_" + Utils.getNanoId(),
        userId,
        sellerId: selectedSeller.sellerId,
        items,
        totalAmount,
        status: "pending",
        paymentStatus: "pending",
        paymentMethod,
        location: { lat, long },
        tracking: { assignedDeliveryPartner: null },
        audit: {
          createdBy: { id: userId, name: "User" }, // Ideally, replace "User" with actual user name
        },
      });

      await order.save();

      // Send notification to seller
      await NotificationService.sendToSeller(selectedSeller.sellerId, {
        title: "New Order Received",
        message: `You have received a new order. Order ID: ${order.orderId}`,
      });

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

  this.acceptOrder = async function (req, res) {
    try {
      const { orderId, sellerId } = req.body;

      if (!orderId || !sellerId) {
        return Responder.sendFailure(res, "Missing required fields", 400);
      }

      let order = await OrderModel.findOne({ orderId, sellerId });

      if (!order) {
        return Responder.sendFailure(res, "Order not found", 404);
      }

      order.status = "accepted";
      await order.save();

      // Find the nearest delivery partner
      let partners = await this.findZonesContainingDeliveryPartner({
        body: { lat: order.location.lat, long: order.location.long },
      });

      if (!partners.data || partners.data.allPartners.length === 0) {
        return Responder.sendFailure(
          res,
          "No delivery partners available",
          404
        );
      }

      let nearestPartner = partners.data.nearestPartner;

      // Send notification to the delivery partner
      NotificationService.sendToDeliveryPartner(nearestPartner.partnerId, {
        title: "New Delivery Assignment",
        message: `You have been assigned a new delivery. Order ID: ${orderId}`,
      });

      return Responder.sendSuccess(
        res,
        "Order accepted, delivery partner notified",
        200
      );
    } catch (error) {
      console.error("Error accepting order:", error);
      return Responder.sendFailure(res, "Something went wrong", 500);
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
