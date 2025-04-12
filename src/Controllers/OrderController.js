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
        status: { $nin: ["delivered", "completed", "cancelled"] },
      });
      console.log("orders", orders, "orders");
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

      console.log(preparingTime, "-------<");
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

      if (order.sellers.length == 1) {
        order.status = "preparing";
      }

      await order.save();

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

      if (!allSellersAccepted) {
        const userSocketId = users.get(order.user.userId);

        if (userSocketId) {
          io.to(userSocketId).emit("orderAccepted", {
            orderId: order.orderId,
            sellerId: sellerId,
            message: `Order accepted by seller ${sellerId}`,
          });
        }

        // await PartnerModel.updateOne(
        //   { partnerId: bestPartner.partner.partnerId },
        //   { $set: { workStatus: "assigned" } }
        // );
      }

      if (allSellersAccepted) {
        console.log("111111111111 =>>>>>>>>>>>>>");
        const partnersResponse = await Utils.findNearbyPartnersForSellers(res, {
          body: {
            sellers:
              //  [
              //   {
              //     lat: order.sellers[0].location?.lat,
              //     long: order.sellers[0].location?.long,
              //   },
              // ],
              order.sellers.map((s) => ({
                sellerId: s.sellerId,
                lat: s.location?.lat,
                long: s.location?.long,
              })),
            dropLocation: {
              usersId: order.user.userId,
              lat: order.user.location.lat,
              long: order.user.location.long,
            },
          },
        });

        console.log(partnersResponse, "===========>");
        // console.log("partnersResponse", partnersResponse, "partnersResponse");
        // return;
        if (
          partnersResponse === undefined ||
          partnersResponse === null ||
          !partnersResponse
          // !partnersResponse.sellerWisePartners?.length ||
          // !partnersResponse.commonPartners?.length
        ) {
          return Responder.sendFailure(
            res,
            "No delivery partners available",
            404
          );
        }

        function calculateTotalDistanceAndTime(segments) {
          let totalDistance = 0;
          let totalDuration = 0;

          segments.forEach((segment) => {
            totalDistance += segment.distance.value;
            totalDuration += segment.duration.value;
          });

          const distanceInKm = totalDistance / 1000;
          const minutes = Math.floor(totalDuration / 60);
          const seconds = totalDuration % 60;

          return {
            distance: {
              valueMeters: totalDistance,
              valueKilometers: distanceInKm,
              text: `${distanceInKm.toFixed(2)} km`,
            },
            duration: {
              valueSeconds: totalDuration,
              valueMinutes: minutes,
              valueRemainingSeconds: seconds,
              text: `${minutes} min ${seconds} sec`,
            },
          };
        }

        // const assignedPartnerMap = new Map();

        // if (partnersResponse.commonPartners?.length) {
        //   const commonPartner = partnersResponse.commonPartners[0];
        //   for (const sellerItem of commonPartner.sellers) {
        //     assignedPartnerMap.set(sellerItem.sellerId, commonPartner.partner);
        //   }
        // } else {
        //   for (const sellerEntry of partnersResponse.sellerWisePartners) {
        //     if (sellerEntry.partners?.length > 0) {
        //       assignedPartnerMap.set(
        //         sellerEntry.seller.sellerId,
        //         sellerEntry.partners[0]
        //       );
        //     }
        //   }
        // }

        // return Responder.sendSuccess(
        //   res,
        //   "Order accepted, delivery partner(s) notified",
        //   200,
        //   routeDetails
        // );

        let deliveryPartnerData;

        // console.log(
        //   deliveryPartnerData.commonPartners[0].partner,
        //   "partnersResponse ================>"
        // );

        // console.log(
        //   partnersResponse.commonPartners,
        //   "partnersResponse ================>"
        // );
        // return;

        if (partnersResponse.commonPartners.length > 0) {
          console.log("22222222222222>..>");
          const bestPartner = Utils.getBestPartner(
            partnersResponse.commonPartners,
            {
              onlyAvailable: true,
            }
          );

          // console.log("bestPartner", bestPartner, "bestPartner");
          // return;
          const waypointsStr = order.sellers
            .map((seller) => `${seller.location.lat},${seller.location.long}`)
            .join("|");
          // console.log(waypointsStr, "----------->");

          const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${bestPartner.partner.location.lat},${bestPartner.partner.location.long}&destination=${order.user.location.lat},${order.user.location.long}&waypoints=${waypointsStr}&key=${Config.google.mapApi}`;

          const directionsResponse = await axios.get(directionsUrl);

          const routeDetails = directionsResponse.data.routes[0]?.legs;

          // console.log(directionsResponse.data, "---------->");

          const firstMile = routeDetails.slice(0, -1);

          const secondMile = routeDetails.slice(-1);

          const overallETA = calculateTotalDistanceAndTime(
            routeDetails.map((data) => {
              return { distance: data.distance, duration: data.duration };
            })
          );

          // console.log(firstMile, secondMile, overallETA, "------------>eta");

          // const sellerToUserDistance = routeDetails.distance.value;
          // const sellerToUserDuration = routeDetails.duration.value;
          // const overallETA = sellerToUserDuration + parseInt(preparingTime);
          // const ETA_in_minutes = Utils.convertSecondsToMinutes(overallETA);

          deliveryPartnerData = {
            routes: routeDetails,
            partnerId: bestPartner.partner.partnerId,
            name: bestPartner.partner.name,
            contact: bestPartner.partner.phone,
            ordersCount: bestPartner.partner.ordersCount,
            assignedSellerIds: [...bestPartner.sellers.map((s) => s.sellerId)],
            tracking: {
              currentLocation: {
                lat: bestPartner.partner.location.lat,
                long: bestPartner.partner.location.long,
              },
              estimatedDeliveryTime: {
                text: overallETA.duration.text,
                value: overallETA.duration.valueSeconds,
                date: new Date(
                  Date.now() + overallETA.duration.valueSeconds * 1000
                ).toISOString(),
              },
              totalDistance: {
                text: overallETA.distance.text,
                value: overallETA.distance.valueMeters,
              },
            },
          };
          console.log(
            "deliveryPartnerDataMaariii============>",
            deliveryPartnerData,
            "deliveryPartnerDataMaariii============>"
          );

          // for (const mapData of routeDetails.steps) {
          //   const data = {
          //     deliveryPartnerId:
          //       partnersResponse.commonPartners[0].partner.partnerId,
          //     ...mapData,
          //   };
          // }
          // console.log(
          //   "deliveryPartnerData",
          //   partnersResponse.sellerWisePartners[0],
          //   "deliveryPartnerData"
          // );
          // return;
          mapData = {};

          order.deliveryPartners.push(deliveryPartnerData);
          const partnerSocketId = deliveryPartners.get(bestPartner.partnerId);
          const userSocketId = users.get(order.user.userId);
          const assignedSellerId = sellerId;

          console.log(partnerSocketId, userSocketId, assignedSellerId);
          if (userSocketId) {
            io.to(userSocketId).emit("orderAccepted", {
              orderId: order.orderId,
              sellerId: assignedSellerId,
              deliveryDetails: deliveryPartnerData,
              message: `Order accepted by seller ${assignedSellerId}`,
            });
          }

          if (partnerSocketId) {
            io.to(partnerSocketId).emit("orderAssigned", {
              orderId: order.orderId,
              sellerId: assignedSellerId,
              deliveryDetails: deliveryPartnerData,
              message: `New order assigned to you for seller ${assignedSellerId}`,
            });
          }

          await PartnerModel.updateOne(
            { partnerId: bestPartner.partner.partnerId },
            { $set: { workStatus: "assigned" } }
          );
          // await PartnerModel.updateOne(
          //   { partnerId: partnersResponse.commonPartners[0].partner.partnerId },
          //   { $set: { workStatus: "assigned" } }
          // );
        }

        if (partnersResponse.sellerWisePartners.length > 0) {
          console.log("22222222");
          for (const sellerWisePartner of partnersResponse.sellerWisePartners) {
            console.log(
              "Processing seller:",
              sellerWisePartner.seller.sellerId
            );

            const bestPartner = Utils.getBestPartner(
              sellerWisePartner.partners,
              { onlyAvailable: true }
            );
            console.log("Best Partner:", bestPartner);

            const waypointsStr = order.sellers
              .filter((s) => s.sellerId === sellerWisePartner.seller.sellerId)
              .map(
                (seller) => `${seller.location.lat},${seller.location.long}`
              );

            console.log(waypointsStr, "---------->waypoints");

            const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${bestPartner.partner.location.lat},${bestPartner.partner.location.long}&destination=${order.user.location.lat},${order.user.location.long}&waypoints=${waypointsStr}&key=${Config.google.mapApi}`;

            const directionsResponse = await axios.get(directionsUrl);
            const routeDetails = directionsResponse.data.routes[0]?.legs;

            const firstMile = routeDetails.slice(0, -1);
            const secondMile = routeDetails.slice(-1);

            const overallETA = calculateTotalDistanceAndTime(
              routeDetails.map((data) => ({
                distance: data.distance,
                duration: data.duration,
              }))
            );

            const deliveryPartnerData = {
              routes: routeDetails,
              partnerId: bestPartner.partner.partnerId,
              name: bestPartner.partner.name,
              ordersCount: bestPartner.partner.ordersCount,
              contact: bestPartner.partner.phone,
              assignedSellerIds: [sellerWisePartner.seller.sellerId],
              tracking: {
                currentLocation: {
                  lat: bestPartner.partner.location.lat,
                  long: bestPartner.partner.location.long,
                },
                estimatedDeliveryTime: {
                  text: overallETA.duration.text,
                  value: overallETA.duration.valueSeconds,
                  date: new Date(
                    Date.now() + overallETA.duration.valueSeconds * 1000
                  ).toISOString(),
                },
                totalDistance: {
                  text: overallETA.distance.text,
                  value: overallETA.distance.valueMeters,
                },
              },
            };

            mapData = {};
            order.deliveryPartners.push(deliveryPartnerData);

            console.log(sellerWisePartner, "------------>");

            const partnerSocketId = deliveryPartners.get(bestPartner.partnerId);
            const userSocketId = users.get(order.user.userId);
            const assignedSellerId = sellerWisePartner.seller.sellerId;

            if (userSocketId) {
              io.to(userSocketId).emit("orderAccepted", {
                orderId: order.orderId,
                sellerId: assignedSellerId,
                deliveryDetails: deliveryPartnerData,
                message: `Order accepted by seller ${assignedSellerId}`,
              });
            }

            if (partnerSocketId) {
              io.to(partnerSocketId).emit("orderAssigned", {
                orderId: order.orderId,
                sellerId: assignedSellerId,
                deliveryDetails: deliveryPartnerData,
                message: `New order assigned to you for seller ${assignedSellerId}`,
              });
            }

            await PartnerModel.updateOne(
              { partnerId: bestPartner.partner.partnerId },
              { $set: { workStatus: "assigned" } }
            );
          }
        }
      }

      // for (const [assignedSellerId, partner] of assignedPartnerMap) {
      //   const currentSeller = order.sellers.find(
      //     (s) => s.sellerId === assignedSellerId
      //   );
      //   if (!currentSeller || !partner) continue;

      //   const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${seller.location.branch.lat},${seller.location.branch.long}&destination=${order.user.location.lat},${order.user.location.long}&key=${Config.google.mapApi}`;
      //   const directionsResponse = await axios.get(directionsUrl);
      //   const routeDetails = directionsResponse.data.routes[0]?.legs[0];
      //   if (!routeDetails) {
      //     return Responder.sendFailure(res, "Failed to calculate route", 400);
      //   }

      //   const sellerToUserDistance = routeDetails.distance.value;
      //   const sellerToUserDuration = routeDetails.duration.value;
      //   const overallETA = sellerToUserDuration + parseInt(preparingTime);
      //   const ETA_in_minutes = Utils.convertSecondsToMinutes(overallETA);

      //   let deliveryPartnerIndex = order.deliveryPartners.findIndex(
      //     (dp) => dp.partnerId === partner.partnerId
      //   );
      //   let deliveryPartnerData;
      //   if (deliveryPartnerIndex === -1) {
      //     deliveryPartnerData = {
      //       partnerId: partner.partnerId,
      //       name: partner.name,
      //       contact: partner.phone,
      //       assignedSellerIds: [assignedSellerId],
      //       tracking: {
      //         currentLocation: {
      //           lat: partner.location.lat,
      //           long: partner.location.long,
      //         },
      //         estimatedDeliveryTime: {
      //           text: ETA_in_minutes,
      //           value: overallETA.toString(),
      //           date: new Date(Date.now() + overallETA * 1000).toISOString(),
      //         },
      //         totalDistance: {
      //           text: `${(sellerToUserDistance / 1000).toFixed(2)} km`,
      //           value: sellerToUserDistance,
      //         },
      //       },
      //     };
      //     order.deliveryPartners.push(deliveryPartnerData);
      //   } else {
      //     deliveryPartnerData = order.deliveryPartners[deliveryPartnerIndex];
      //     if (
      //       !deliveryPartnerData.assignedSellerIds.includes(assignedSellerId)
      //     ) {
      //       deliveryPartnerData.assignedSellerIds.push(assignedSellerId);
      //     }
      //     deliveryPartnerData.tracking.estimatedDeliveryTime = {
      //       text: ETA_in_minutes,
      //       value: overallETA.toString(),
      //       date: new Date(Date.now() + overallETA * 1000).toISOString(),
      //     };
      //     deliveryPartnerData.tracking.totalDistance = {
      //       text: `${(sellerToUserDistance / 1000).toFixed(2)} km`,
      //       value: sellerToUserDistance,
      //     };
      //   }

      //   const partnerToSellerUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${partner.location.lat},${partner.location.long}&destination=${seller.location.branch.lat},${seller.location.branch.long}&key=${Config.google.mapApi}`;
      //   const partnerToSellerResponse = await axios.get(partnerToSellerUrl);
      //   const partnerToSellerRoute =
      //     partnerToSellerResponse.data.routes[0]?.legs[0];

      //   const mapsDataEntry = {
      //     deliveryPartnerId: partner.partnerId,
      //     sellerId: assignedSellerId,
      //     distance: partnerToSellerRoute
      //       ? {
      //           text: partnerToSellerRoute.distance.text,
      //           value: partnerToSellerRoute.distance.value,
      //         }
      //       : { text: null, value: null },
      //     duration: partnerToSellerRoute
      //       ? {
      //           text: partnerToSellerRoute.duration.text,
      //           value: partnerToSellerRoute.duration.value,
      //         }
      //       : { text: null, value: null },
      //   };
      //   order.mapsData.deliveryPartnersToSellers.push(mapsDataEntry);

      //   const sellerToUserEntryIndex = order.mapsData.sellersToUser.findIndex(
      //     (entry) => entry.sellerId === assignedSellerId
      //   );

      //   const newSellerToUserEntry = {
      //     sellerId: assignedSellerId,
      //     distance: routeDetails.distance,
      //     duration: routeDetails.duration,
      //   };

      //   if (sellerToUserEntryIndex > -1) {
      //     order.mapsData.sellersToUser[sellerToUserEntryIndex] =
      //       newSellerToUserEntry;
      //   } else {
      //     order.mapsData.sellersToUser.push(newSellerToUserEntry);
      //   }

      //   await PartnerModel.updateOne(
      //     { partnerId: partner.partnerId },
      //     { $set: { workStatus: "assigned" } }
      //   );

      //   const partnerSocketId = deliveryPartners.get(partner.partnerId);
      //   const userSocketId = users.get(order.user.userId);

      //   if (userSocketId) {
      //     io.to(userSocketId).emit("orderAccepted", {
      //       orderId: order.orderId,
      //       sellerId: assignedSellerId,
      //       deliveryDetails: deliveryPartnerData,
      //       message: `Order accepted by seller ${assignedSellerId}`,
      //     });
      //   }

      //   if (partnerSocketId) {
      //     io.to(partnerSocketId).emit("orderAssigned", {
      //       orderId: order.orderId,
      //       sellerId: assignedSellerId,
      //       deliveryDetails: deliveryPartnerData,
      //       message: `New order assigned to you for seller ${assignedSellerId}`,
      //     });
      //   }
      // }

      await order.save();

      return Responder.sendSuccess(
        res,
        "Order accepted, delivery partner(s) notified",
        200,
        order
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

      let order = await OrderModel.findOne({
        orderId,
        "deliveryPartners.partnerId": partnerId,
      });
      let partnerData;
      // console.log("order", order, "order");
      // return;
      if (order.deliveryPartners.length > 1) {
        partnerData = order.deliveryPartners.filter(
          (d) => d.partnerId == partnerId
        );
      } else {
        partnerData = order.deliveryPartners;
      }

      console.log(
        order.deliveryPartners.filter((d) => d.partnerId == partnerId),
        "-------------------------------->"
      );

      if (!order) {
        return Responder.sendFailure(res, "Order not found", 404);
      }
      // Update the accepted timestamp if not already set
      if (order) {
        await OrderModel.updateOne(
          {
            orderId,
            "deliveryPartners.partnerId": partnerId,
          },
          {
            $set: {
              "deliveryPartners.$.timestamps.acceptedAt": new Date(),
            },
          }
        );
        await order.save();
      }

      // const userSocketId = users.get(order.user.userId);
      // if (userSocketId) {
      //   io.to(userSocketId).emit("orderStatusUpdateToUser", {
      //     orderId: order.orderId,
      //     sellerId: partnerData[0].assignedSellerIds,
      //     deliveryDetails: order.deliveryPartners,
      //     mapsData: order.mapsData,
      //     message: "Order is accepeted by partner",
      //   });
      //   console.log(`Notified user ${order.user.userId}`);
      // } else {
      //   console.log(`user ${order.user.userId} not connected`);
      // }

      // for (const Sellers of partnerData[0].assignedSellerIds) {
      //   const sellerSocketId = sellers.get(sellers.sellerId);

      //   if (sellerSocketId) {
      //     io.to(sellerSocketId).emit("orderStatusUpdateToSeller", {
      //       orderId: order.orderId,
      //       sellerId: Sellers.sellerId,
      //       deliveryDetails: order.deliveryseller,
      //       mapsData: order.mapsData,
      //       message: "order is accepted",
      //     });
      //     console.log(`Notified  seller ${Sellers.sellerId}`);
      //   } else {
      //     console.log(` seller ${Sellers.sellerId} not connected`);
      //   }
      // }

      return Responder.sendSuccess(res, "Order accepted", 200, {
        order,
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
        "deliveryPartners.partnerId": { $in: partnerId },
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

      let order = await OrderModel.findOne({
        orderId,
      });
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

      // const notifyAllParties = (order, message) => {
      //   console.log("order", order, "order");

      //   const sellerSocketId = sellers.get(order.sellers.sellerId);
      //   const partnerSocketId = deliveryPartners.get(
      //     order.deliveryPartners.partnerId
      //   );

      //   const userSocketId = users.get(order.user.userId);
      //   const notificationData = {
      //     orderId: order.orderId,
      //     sellerId: order.sellers.sellerId,
      //     deliveryDetails: order.deliveryPartner,
      //     mapsData: order.mapsData,
      //     status: order.status,
      //     message,
      //   };

      //   if (sellerSocketId) {
      //     io.to(sellerSocketId).emit("statusUpdate", notificationData);
      //     console.log(`Notified seller ${order.seller.sellerId}`);
      //   }

      //   if (partnerSocketId) {
      //     io.to(partnerSocketId).emit("statusUpdate", notificationData);
      //     console.log(`Notified partner ${order.deliveryPartner.partnerId}`);
      //   }

      //   if (userSocketId) {
      //     io.to(userSocketId).emit("statusUpdate", notificationData);
      //     console.log(`Notified user ${order.user.userId}`);
      //   }
      // };
      const notifyAllParties = (order, message, updatedBy = "system") => {
        // console.log("order", order, "updatedBy", updatedBy);

        const notificationData = {
          orderId: order.orderId,
          status: order.status,
          message,
          mapsData: order.mapsData,
        };

        // === If the update came from a delivery partner ===
        if (updatedBy === "partner") {
          for (const partner of order.deliveryPartners || []) {
            console.log(partner.partnerId, "---------->p");

            const partnerSocketId = deliveryPartners.get(partner.partnerId);

            console.log(partnerSocketId, deliveryPartners, "------------->ddd");

            if (partnerSocketId) {
              io.to(partnerSocketId).emit("statusUpdate", {
                ...notificationData,
                deliveryDetails: partner,
                partnerId: partner.partnerId,
              });

              console.log(`Notified partner ${partner.partnerId}`);
            }

            // Notify only assigned sellers
            for (const seller of order.sellers || []) {
              if (partner.assignedSellerIds.includes(seller.sellerId)) {
                const sellerSocketId = sellers.get(seller.sellerId);

                if (sellerSocketId) {
                  io.to(sellerSocketId).emit("statusUpdate", {
                    ...notificationData,
                    sellerId: seller.sellerId,
                    deliveryDetails: partner,
                  });

                  console.log(
                    `Notified seller ${seller.sellerId} (assigned to ${partner.partnerId})`
                  );
                }
              }
            }
          }
        }

        // === If the update came from a seller ===
        else if (updatedBy === "seller") {
          for (const seller of order.sellers || []) {
            const sellerSocketId = sellers.get(seller.sellerId);

            if (sellerSocketId) {
              io.to(sellerSocketId).emit("statusUpdate", {
                ...notificationData,
                sellerId: seller.sellerId,
              });

              console.log(`Notified seller ${seller.sellerId}`);
            }

            // Notify only partners who are assigned to this seller
            for (const partner of order.deliveryPartners || []) {
              if (partner.assignedSellerIds.includes(seller.sellerId)) {
                const partnerSocketId = deliveryPartners.get(partner.partnerId);

                if (partnerSocketId) {
                  io.to(partnerSocketId).emit("statusUpdate", {
                    ...notificationData,
                    sellerId: seller.sellerId,
                    deliveryDetails: partner,
                    partnerId: partner.partnerId,
                  });

                  console.log(
                    `Notified partner ${partner.partnerId} (linked to seller ${seller.sellerId})`
                  );
                }
              }
            }
          }
        }

        // === Always notify the user ===
        const userSocketId = users.get(order.user.userId);
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
            "sellers.sellerId": userId,
          });

          if (!order) {
            return Responder.sendFailure(res, "Order not found", 404);
          }

          if (status === "ready") {
            // order.status = status;
            await OrderModel.updateOne(
              {
                orderId,
                "sellers.sellerId": userId,
              },
              {
                $set: {
                  "sellers.$.timestamps.readyAt": new Date(),
                  status: status,
                },
              }
            );
            await order.save();
            notifyAllParties(
              order,
              "Partner has picked up your food",
              "partner"
            );
            // notifyAllParties(order, "Order is ready now!");
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
            "deliveryPartners.partnerId": userId,
          });
          // console.log("odersss", order, "odersss");
          // return;

          if (!order) {
            return Responder.sendFailure(res, "Order not found", 404);
          }

          switch (status) {
            case "reached_pickup_location":
              await OrderModel.updateOne(
                {
                  orderId,
                  "deliveryPartners.partnerId": userId,
                },
                {
                  $set: {
                    "deliveryPartners.$.timestamps.reachedPickupAt": new Date(),
                    status: status,
                  },
                }
              );
              // order.deliveryPartners.timestamps.reachedPickupAt = new Date();
              // order.status = "reached_pickup_location";
              await order.save();

              notifyAllParties(
                order,
                "Delivery partner has reached pickup location",
                "seller"
              );

              // notifyAllParties(
              //   order,
              //   "Delivery partner has reached pickup location"
              // );
              break;
            case "picked_up":
              await OrderModel.updateOne(
                {
                  orderId,
                  "deliveryPartners.partnerId": userId,
                },
                {
                  $set: {
                    "deliveryPartners.$.timestamps.pickedUpAt": new Date(),
                    status: status,
                  },
                }
              );
              // order.deliveryPartners.timestamps.pickedUpAt = new Date();
              // order.sellers.timestamps.pickedUpAt = new Date();
              // order.status = "picked_up";
              await order.save();
              notifyAllParties(
                order,
                "Delivery partner has reached pickup location",
                "seller"
              );
              // notifyAllParties(order, "Order has been picked up");
              break;
            case "reached_user_location":
              order.status = "reached_user_location";
              await order.save();
              // notifyAllParties(
              //   order,
              //   "Delivery partner has  reached the user location"
              // );
              notifyAllParties(
                order,
                "Delivery partner has reached pickup location",
                "seller"
              );
              break;
            case "delivered":
              await OrderModel.updateOne(
                {
                  orderId,
                  "deliveryPartners.partnerId": userId,
                },
                {
                  $set: {
                    "deliveryPartners.$.timestamps.deliveredAt": new Date(),
                    status: status,
                  },
                }
              );
              await PartnerModel.updateOne(
                {
                  partnerId: userId,
                },
                {
                  $set: {
                    workStatus: "waiting_for_order",
                  },
                }
              );
              // order.deliveryPartners[0].timestamps.deliveredAt = new Date();
              // order.markModified("deliveryPartners[0].timestamps.deliveredAt");
              // order.status = "delivered";
              // order.markModified("status");
              // await order.save();
              // notifyAllParties(order, "Order has been delivered");
              break;
            case "completed":
              await OrderModel.updateOne(
                {
                  orderId,
                  "deliveryPartners.partnerId": userId,
                },
                {
                  $set: {
                    "deliveryPartners.$.timestamps.deliveredAt": new Date(),
                    status: status,
                  },
                }
              );
              await PartnerModel.updateOne(
                {
                  partnerId: userId,
                },
                {
                  $set: {
                    workStatus: "waiting_for_order",
                  },
                }
              );
              // order.deliveryPartners.timestamps.deliveredAt = new Date();
              // order.status = "completed";
              // await order.save();
              notifyAllParties(
                order,
                "Delivery partner has reached pickup location",
                "seller"
              );
              // notifyAllParties(order, "Order has been completed");
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
            // notifyAllParties(order, "Order has been cancelled");
          }
          break;

        default:
          return Responder.sendFailure(res, "Invalid user type", 400);
      }

      if (!order) {
        return Responder.sendFailure(res, "Order not found", 404);
      }

      // if (userType === "partner" && status === "picked_up") {
      //   const routeToUser = {
      //     distance: order.mapsData.sellerToUser.distance,
      //     duration: order.mapsData.sellerToUser.duration,
      //     from: order.sellers.location,
      //     to: order.user.location,
      //   };

      //   return Responder.sendSuccess(res, "Order status updated", 200, {
      //     order,
      //     route: routeToUser,
      //   });
      // }

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
        {
          $match: {
            "deliveryPartners.partnerId": partnerId,
            status: { $nin: ["delivered", "completed"] },
          },
        },
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
              routes: { $arrayElemAt: ["$deliveryPartners.routes", 0] },
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
  this.getPartnersByPartnerId = async function (req, res) {
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
