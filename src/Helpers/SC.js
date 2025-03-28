const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["*"],
    credentials: true,
  },
});

// Create separate namespaces for different types of users
const clientNamespace = io.of("/clients"); // For restaurant clients/staff
const deliveryNamespace = io.of("/delivery"); // For delivery partners
const userNamespace = io.of("/users"); // For customers

let pendingOrders = [];

function generateDummyOrder() {
  const dummyItems = [
    { name: "Margherita Pizza", quantity: 2, price: 250 },
    { name: "Garlic Bread", quantity: 1, price: 100 },
    { name: "Coke", quantity: 2, price: 50 },
  ];

  const total = dummyItems.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);

  return {
    id: `ORD_${Date.now() + 111}`,
    status: "pending",
    date: new Date().toLocaleString(),
    // price: `₹${total.toFixed(2)}`,
    // images: ["https://example.com/pizza.jpg", "https://example.com/bread.jpg"],
    items: dummyItems,
    timestamp: new Date().toISOString(),
    totalAmount: total,
  };
}

// Simulate new orders
setInterval(() => {
  const dummyOrder = generateDummyOrder();
  // pendingOrders.push(dummyOrder);

  clientNamespace.emit("NEW_ORDER", {
    type: "NEW_ORDER",
    data: dummyOrder,
  });
}, 10000);

// Client namespace (restaurant staff)
clientNamespace.on("connection", (socket) => {
  console.log("New client connected to client namespace");

  socket.emit("message", {
    message: "Welcome to the restaurant order server!",
  });
  // console.log("pending orders", pendingOrders)
  if (pendingOrders.length > 0) {
    pendingOrders.forEach((order) => {
      socket.emit("NEW_ORDER", { type: "NEW_ORDER", data: order });
    });
  }

  socket.on("message", handleMessage(socket, clientNamespace));
});

// Delivery namespace
deliveryNamespace.on("connection", (socket) => {
  console.log("New delivery partner connected");
  socket.emit("message", {
    message: "Welcome to the delivery partner server!",
  });
});

// User namespace
userNamespace.on("connection", (socket) => {
  console.log("New user connected");
  socket.emit("message", {
    message: "Welcome to the order tracking server!",
  });
});

function handleMessage(socket, namespace) {
  return (data) => {
    try {
      const message = typeof data === "string" ? JSON.parse(data) : data;
      console.log("Received message from client:", message, message.type);

      if (message.type === "NEW_ORDER" && message.data?.id) {
        const order = processNewOrder(message.data);
        pendingOrders.push(order);

        namespace.emit("NEW_ORDER", {
          type: "NEW_ORDER",
          data: order,
        });
        socket.emit("echo", { echo: "Order received", order });
      } else if (message.type === "ORDER_ACCEPTED" && message.data?.id) {
        const { id, status, timestamp } = message.data;

        console.log(message.data, pendingOrders);

        // if (orderIndex !== -1) {
        const updatedOrder = {
          ...pendingOrders[orderIndex],
          status: "preparing",
          acceptedAt: timestamp,
        };

        // Broadcast to restaurant clients
        // clientNamespace.emit("ORDER_STATUS_UPDATE", {
        //   type: "ORDER_STATUS_UPDATE",
        //   data: {
        //     id,
        //     status: "accepted",
        //     acceptedAt: timestamp,
        //     message: `Order ${id} has been accepted`,
        //     orderDetails: updatedOrder,
        //   },
        // });

        // Broadcast to delivery partners
        // deliveryNamespace.emit("NEW_DELIVERY_ASSIGNMENT", {
        //   type: "NEW_DELIVERY_ASSIGNMENT",
        //   data: {
        //     id,
        //     status: "awaiting_delivery",
        //     acceptedAt: timestamp,
        //     orderDetails: updatedOrder,
        //   },
        // });

        deliveryNamespace.emit("NEW_DELIVERY_ASSIGNMENT", {
          type: "NEW_DELIVERY_ASSIGNMENT",
          data: {
            orderId: id,
            customerName: "Nithis",
            shopName: "KFC Chicken",
            shopAddress: "Chennai",
            items: updatedOrder,
            totalPrice: 200,
            status: "Preparing",
          },
        });
        console.log("2");

        // Broadcast to user who placed the order
        userNamespace.emit("ORDER_STATUS_UPDATE", {
          type: "ORDER_STATUS_UPDATE",
          data: {
            id,
            status: "accepted",
            acceptedAt: timestamp,
            message: `Your order ${id} has been accepted`,
            orderDetails: updatedOrder,
          },
        });
        // }
      } else if (message.type === "ORDER_REJECTED" && message.data?.id) {
        const { id, status, timestamp } = message.data;
        const orderIndex = pendingOrders.findIndex((o) => o.id === id);

        if (orderIndex !== -1) {
          pendingOrders[orderIndex] = {
            ...pendingOrders[orderIndex],
            status: "rejected",
            rejectedAt: timestamp,
          };

          // Notify all parties about rejection
          namespace.emit("ORDER_STATUS_UPDATE", {
            type: "ORDER_STATUS_UPDATE",
            data: {
              id,
              status: "rejected",
              rejectedAt: timestamp,
              message: `Order ${id} has been rejected`,
            },
          });
          userNamespace.emit("ORDER_STATUS_UPDATE", {
            type: "ORDER_STATUS_UPDATE",
            data: {
              id,
              status: "rejected",
              message: `Your order ${id} was rejected`,
            },
          });
        }
      }
    } catch (error) {
      console.error("Failed to parse message:", error);
      socket.emit("error", { error: "Invalid message format" });
    }
  };
}

function processNewOrder(data) {
  return {
    id: data.id,
    status: data.status || "pending",
    date: data.date || new Date().toLocaleString(),
    price: data.price || "₹0.00",
    images: data.images || [],
    items: data.items || [],
    timestamp: new Date().toISOString(),
    totalAmount: parseFloat(data.price.replace("₹", "")) || 0,
  };
}

server.listen(8080, () => {
  console.log("Socket.IO server is running on http://localhost:8080");
});
