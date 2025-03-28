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
const { Server } = require("socket.io");
const axios = require("axios");

const initializeSocket = (port, apiBaseUrl) => {
  const io = new Server(port, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
    },
  });

  const sellers = new Map();
  const deliveryPartners = new Map(); // Add Map for delivery partners

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Register seller
    socket.on("registerSeller", async (sellerId) => {
      try {
        sellers.set(sellerId, socket.id);
        console.log(`Seller ${sellerId} connected with socket ID ${socket.id}`);
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

    // Register delivery partner
    socket.on("registerDeliveryPartner", async (partnerId) => {
      try {
        deliveryPartners.set(partnerId, socket.id);
        console.log(
          `Delivery Partner ${partnerId} connected with socket ID ${socket.id}`
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

  return { io, sellers, deliveryPartners }; // Return deliveryPartners too
};

module.exports = { initializeSocket };
