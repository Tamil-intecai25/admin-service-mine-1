<<<<<<< HEAD
let express = require('express');
let app = express();
const http = require("http");
const { Server } = require("socket.io");
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const sellers = new Map();

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // When a seller joins, store their socket ID
    socket.on("registerSeller", (sellerId) => {
        sellers.set(sellerId, socket.id);
        console.log(`Seller ${sellerId} connected with socket ID ${socket.id}`);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
        for (let [sellerId, socketId] of sellers) {
            if (socketId === socket.id) {
                sellers.delete(sellerId);
                console.log(`Seller ${sellerId} disconnected`);
                break;
            }
        }
    });
});

module.exports = {sellers};
=======
// let express = require("express");
// let app = express();
// const http = require("http");
// const { Server } = require("socket.io");
// const server = http.createServer(app);
// const io = new Server(server, {
//   cors: {
//     origin: "*",
//     methods: ["GET", "POST"],
//   },
// });

// const sellers = new Map();
// const deliveryPartners = {};

// io.on("connection", (socket) => {
//   console.log("A user connected:", socket.id);

//   // When a seller joins, store their socket ID
//   socket.on("registerSeller", (sellerId) => {
//     sellers.set(sellerId, socket.id);
//     console.log(`Seller ${sellerId} connected with socket ID ${socket.id}`);
//   });

//   // Handle disconnection
//   socket.on("disconnect", () => {
//     for (let [sellerId, socketId] of sellers) {
//       if (socketId === socket.id) {
//         sellers.delete(sellerId);
//         console.log(`Seller ${sellerId} disconnected`);
//         break;
//       }
//     }
//   });
// });

// module.exports = { sellers };
>>>>>>> origin/dev
