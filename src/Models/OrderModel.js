const AdminConnection = require("../Database/Connection").getAdminDB();

let orderSchema = new AdminConnection.Schema(
  {
    // ********Common Order Details************
    orderId: { type: String, required: true, unique: true },
    totalAmount: { type: String, required: true },
    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "preparing",
        "ready",
        "processing",
        "completed",
        "reached_user_location",
        "reached_pickup_location",
        "picked_up",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "online"],
      default: "COD",
    },
    eta: { type: Number, default: null },
    hasDeleted: { type: Boolean, default: false },

    //*************User Details*************
    user: {
      userId: { type: String, required: true },
      name: { type: String, required: true },
      phoneNumber: { type: String, required: true },
      address: { type: String, default: null },
      location: {
        lat: { type: Number, required: true },
        long: { type: Number, required: true },
      },
      timestamps: {
        orderedAt: { type: Date, default: Date.now },
        cancelledAt: { type: Date, default: null },
      },
    },

    // *************Seller Details**************
    sellers: [
      {
        sellerId: { type: String, required: true },
        name: { type: String, required: true },
        contact: { type: String, required: true },
        address: { type: String, default: null },
        location: {
          lat: { type: Number, required: true },
          long: { type: Number, required: true },
        },
        timestamps: {
          acceptedAt: { type: Date, default: null },
          preparingStartAt: { type: Date, default: null },
          readyAt: { type: Date, default: null },
          pickedUpAt: { type: Date, default: null },
        },
        preparingTime: {
          text: { type: String, default: null },
          value: { type: String, default: null },
        },
        items: [
          {
            categoryId: { type: String, required: true },
            subCategoryId: { type: String, required: true },
            productName: { type: String, required: true },
            quantity: { type: Number, required: true },
            dishPrice: { type: Number, required: true },
            gst: { type: Number, required: true },
            packagePrice: { type: Number, required: true },
            finalDishPrice: { type: Number, required: true },
          },
        ],
        subTotal: { type: Number, required: true },
      },
    ],
    // *****************Delivery Partner Details**************
    deliveryPartners: [
      {
        partnerId: { type: String, default: null },
        routes: { type: Array, default: [] },
        name: { type: String, default: null },
        contact: { type: String, default: null },
        ordersCount: { type: Number, default: 0 },
        assignedSellerIds: [{ type: String }],
        tracking: {
          currentLocation: {
            lat: { type: Number, default: null },
            long: { type: Number, default: null },
          },
          estimatedDeliveryTime: {
            text: { type: String, default: null },
            value: { type: Number, default: null },
            date: { type: Date, default: null },
          },
          totalDistance: {
            text: { type: String, default: null },
            value: { type: Number, default: null },
          },
        },
        timestamps: {
          acceptedAt: { type: Date, default: null },
          reachedPickupAt: { type: Date, default: null },
          pickedUpAt: { type: Date, default: null },
          deliveredAt: { type: Date, default: null },
        },
      },
    ],

    // *********Google Maps Distance & Duration Data********
    mapsData: {
      deliveryPartnersToSellers: [
        {
          deliveryPartnerId: { type: String, default: null },
          sellerId: { type: String, required: true },
          distance: {
            text: { type: String, default: null },
            value: { type: Number, default: null },
          },
          duration: {
            text: { type: String, default: null },
            value: { type: Number, default: null },
          },
        },
      ],
      sellersToUser: [
        {
          sellerId: { type: String, required: true },
          distance: {
            text: { type: String, default: null },
            value: { type: Number, default: null },
          },
          duration: {
            text: { type: String, default: null },
            value: { type: Number, default: null },
          },
        },
      ],
    },

    // *************Order Items*****************
    // Removed the top-level items array since items are now nested under sellers

    audit: {
      createdBy: {
        id: { type: String },
        name: { type: String },
      },
      updatedBy: {
        id: { type: String },
        name: { type: String },
      },
      deletedBy: {
        id: { type: String },
        name: { type: String },
      },
    },
  },
  {
    timestamps: true,
  }
);

let orderModel = AdminConnection.model("orders", orderSchema);

module.exports = orderModel;
