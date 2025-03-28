const { io, sellers } = require("../Helpers/Socket");

const NotificationService = {
  sendToSeller: async function (sellerId, notificationData) {
    try {
      if (!sellerId || !notificationData) {
        console.error("Missing sellerId or notification data");
        return;
      }
      const sellerSocketId = sellers.get(sellerId);
      if (sellerSocketId) {
        io.to(sellerSocketId).emit("newOrderNotification", notificationData);
        console.log(
          `Notification sent to seller ${sellerId}:`,
          notificationData
        );
      } else {
        console.warn(`Seller ${sellerId} is not connected`);
      }
    } catch (error) {
      console.error("Error sending notification to seller:", error);
    }
  },
};

module.exports = NotificationService;
