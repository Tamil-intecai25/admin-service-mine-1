// const socketIo = require("socket.io");

// let io;
// const deliveryPartners = {}; // Store real-time partner locations

// module.exports = {
//   init: (server) => {
//     io = socketIo(server, {
//       cors: {
//         origin: "*",
//         methods: ["GET", "POST"],
//         allowedHeaders: ["Content-Type"],
//         credentials: true,
//       },
//     });

//     io.on("connection", (socket) => {
//       console.log(`Delivery partner connected: ${socket.id}`);

//       // Receive live location updates from the delivery partner
//       socket.on("updateLocation", (data) => {
//         console.log(" Location update received:", data);
//         deliveryPartners[socket.id] = data;
//         io.emit("partnerLocationUpdate", data);
//         s;
//       });

//       //  Handle disconnection
//       socket.on("disconnect", () => {
//         console.log(` Partner disconnected: ${socket.id}`);
//         delete deliveryPartners[socket.id];
//         io.emit("partnerDisconnected", socket.id);
//       });
//     });

//     return io;
//   },

//   getIo: () => {
//     if (!io) {
//       throw new Error("Socket.io not initialized!");
//     }
//     return io;
//   },
// };
// src/Helpers/socketIo.js
// src/Helpers/socketIo.js
const OrderModel = require("../Models/OrderModel");
const PartnerModel = require("../Models/PartnerModel");
const { Server } = require("socket.io");
const axios = require("axios");

const initializeSocket = (port, apiBaseUrl) => {
  const io = new Server(port, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/socket.io/",
  });
  console.log(io, "------------>socket");

  const sellers = new Map();
  const users = new Map();
  const deliveryPartners = new Map(); // Add Map for delivery partners

  io.on("connection", (socket) => {
    console.log(socket, "------------->");

    console.log("A user connected:", socket.id);
    socket.on("connect_error", (err) => {
      console.error(` Connection error (socket ${socket.id}):`, err.message);
    });

    socket.on("error", (err) => {
      console.error(` Socket error (socket ${socket.id}):`, err.message);
    });

    io.engine.on("connection_error", (err) => {
      console.error(
        " Engine connection error:",
        err.req?.url,
        err.code,
        err.message
      );
    });

    // ***************User Register**************
    socket.on("registerUser", async (userId) => {
      try {
        users.set(userId, socket.id);
        console.log(`User ${userId} connected with socket ID ${socket.id}`);
        // await axios.post(`${apiBaseUrl}/api/seller/register`, {
        //   sellerId,
        //   socketId: socket.id,
        //   status: "online",
        // });
        socket.emit("registrationUserStatus", {
          success: true,
          message: "User registered successfully",
        });
      } catch (error) {
        console.error("Error registering User:", error);
        socket.emit("registrationUserStatus", {
          success: false,
          message: "Failed to register seller",
        });
      }
    });

    // Register seller
    socket.on("registerSeller", async (seller) => {
      console.log(seller, "---------------->sell");
      try {
        sellers.set(seller.sellerId, socket.id);
        console.log(`Seller ${seller} connected with socket ID ${socket.id}`);
        // await axios.post(`${apiBaseUrl}/api/seller/register`, {
        //   sellerId,
        //   socketId: socket.id,
        //   status: "online",
        // });
        socket.emit("registrationStatus", {
          success: true,
          message: "Seller registered successfully",
        });
      } catch (error) {
        console.error("Error registering seller:", error);
        socket.emit("registrationStatus", {
          success: false,
          message: "Failed to register seller",
        });
      }
    });

    socket.on("partnerLocationUpdate", async (data) => {
      try {
        // let a = await PartnerModel.updateOne(
        //   { partnerId: data.partnerId },
        //   {
        //     $set: {
        //       "deliveryPartners.location.lat": data.location.lat,
        //       "deliveryPartners.location.long": data.location.lng,
        //     },
        //   }
        // );
        console.log("------------->aaa");
      } catch (error) {}
      //***********type*************/
      // {
      //   partnerId: string,
      //   orderId: string,
      //   location: { lat: number, lng: number },
      // }
      console.log(data, "----------------->");

      const { partnerId, orderId, location } = data;

      console.log(data, "---------------->pa--data");

      let order = await OrderModel.findOne({ orderId: orderId });

      let partner = await PartnerModel.findOne({ partnerId: partnerId });

      partner.location.lat = data.location.lat;

      partner.markModified("location.lat");

      partner.location.long = data.location.lng;

      partner.markModified("location.long");

      await partner.save();

      // if (!order) {
      //   const error = new Error(`Order with ID ${orderId} not found`);
      //   error.status = 400;
      //   throw error;
      // }

      // if (!order.deliveryPartners || !Array.isArray(order.deliveryPartners)) {
      //   const error = new Error(
      //     "Invalid order data: deliveryPartners missing or not an array"
      //   );
      //   error.status = 400;
      //   throw error;
      // }

      if (order) {
        const partnerIndex = order.deliveryPartners.findIndex(
          (partner) => partner.partnerId === data.partnerId
        );
        if (partnerIndex === -1) {
          socket.emit("registrationStatus", {
            success: false,
            message: "Delivery Partner not found",
          });
        }
        console.log(
          partnerIndex,
          order.deliveryPartners[partnerIndex].tracking.currentLocation.lat,

          "----------------------?"
        );
        order.deliveryPartners[partnerIndex].tracking.currentLocation.lat =
          data.location.lat;
        order.deliveryPartners[partnerIndex].tracking.currentLocation.long =
          data.location.lng;
        // Mark the modified fields
        order.markModified(
          `deliveryPartners.${partnerIndex}.tracking.currentLocation`
        );
        await order.save();
        let partner = await PartnerModel.findOne({ partnerId: partnerId });

        console.log("partner111", partner, "partner111");

        partner.location.lat = data.location.lat;

        partner.markModified("location.lat");

        partner.location.long = data.location.lng;

        partner.markModified("location.long");

        await partner.save();

        console.log(`Location update from partner ${partnerId}:`, location);
        const orderData = { partnerId, orderId, location };

        console.log(order.deliveryPartners, "99999999999999");
        // const userOrderData = order.deliveryPartners.filter(
        //   (dp) => dp.partnerId != partnerId
        // );
        // console.log(userOrderData, "-------------->userrdaaa");
        sellers.forEach((socketId) =>
          io.to(socketId).emit("partnerLocationUpdate", orderData)
        );
        users.forEach((socketId) =>
          io.to(socketId).emit("partnerLocationUpdate", data)
        );

        // users.forEach((socketId) =>
        //   io.to(socketId).emit("partnerLocationUpdate", {
        //     orderId,
        //     deliveryPartners: [
        //       ...userOrderData.map((items) => {
        //         console.log(
        //           items,
        //           "--------->uspppppppppppppppppppppppppppppppppppppppppppppppppppppppp"
        //         );
        //         return {
        //           ...items.tracking.currentLocation,
        //           partnerId: items.partnerId,
        //         };
        //       }),
        //       { partnerId: partnerId, lat: location.lat, long: location.lng },
        //     ],
        //   })
        // );
      }
      sellers.forEach((socketId) =>
        io.to(socketId).emit("partnerLocationUpdate", data)
      );
      users.forEach((socketId) =>
        io.to(socketId).emit("partnerLocationUpdate", data)
      );
      // Broadcast to relevant seller and user if they exist
    });

    // Hand
    // Register delivery partner
    socket.on("registerDeliveryPartner", async (partner) => {
      try {
        deliveryPartners.set(partner.partnerId, socket.id);
        console.log(
          `Delivery Partner ${partner.partnerId} connected with socket ID ${socket.id}`
        );
        // await axios.post(`${apiBaseUrl}/api/delivery-partner/register`, {
        //   partnerId,
        //   socketId: socket.id,
        //   status: "online",
        // });
        socket.emit("registrationStatus", {
          success: true,
          message: "Delivery Partner registered successfully",
        });
      } catch (error) {
        console.error("Error registering delivery partner:", error);
        socket.emit("registrationStatus", {
          success: false,
          message: "Failed to register delivery partner",
        });
      }
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      for (let [sellerId, socketId] of sellers) {
        if (socketId === socket.id) {
          sellers.delete(sellerId);
          console.log(`Seller ${sellerId} disconnected`);
          // await axios.post(`${apiBaseUrl}/api/seller/update-status`, {
          //   sellerId,
          //   status: "offline",
          // });
          break;
        }
      }
      for (let [partnerId, socketId] of deliveryPartners) {
        if (socketId === socket.id) {
          deliveryPartners.delete(partnerId);
          console.log(`Delivery Partner ${partnerId} disconnected`);
          // await axios.post(`${apiBaseUrl}/api/delivery-partner/update-status`, {
          //   partnerId,
          //   status: "offline",
          // });
          break;
        }
      }
    });
  });

  return { io, sellers, users, deliveryPartners };
};

module.exports = { initializeSocket };
