<<<<<<< HEAD
const AdminConnection = require("../Database/Connection").getAdminDB();

let orderSchema = new AdminConnection.Schema(
  {
    orderId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    sellerId: { type: String, required: true },
    deliveryPartnerId: { type: String, default: null },
    items: [
      {
        categoryId: { type: String, required: true }, // NEW FIELD
        subCategoryId: { type: String, required: true }, // NEW FIELD
        productName: { type: String, required: true },
        quantity: { type: Number, required: true },
        dishPrice: { type: Number, required: true }, // UPDATED
        gst: { type: Number, required: true }, // NEW FIELD
        packagePrice: { type: Number, required: true }, // NEW FIELD
        finalDishPrice: { type: Number, required: true } // NEW FIELD
      }
    ],
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "processing", "out_for_delivery", "delivered", "cancelled"],
      default: "pending"
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending"
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "online"],
      default: "COD"
    },
    location: {
      lat: { type: Number, required: true },
      long: { type: Number, required: true }
    },
    tracking: {
      assignedDeliveryPartner: { type: String, default: null },
      estimatedDeliveryTime: { type: Date, default: null },
      currentLocation: {
        lat: { type: Number, default: null },
        long: { type: Number, default: null }
      }
    },
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
    hasDeleted: { type: Boolean, default: false }
  },
  {
    timestamps: true,
  }
);

let orderModel = AdminConnection.model("orders", orderSchema);

module.exports = orderModel;
=======
const AdminConnection = require("../Database/Connection").getAdminDB();

let orderSchema = new AdminConnection.Schema(
  {
    // ********Common Order Details************
    orderId: { type: String, required: true, unique: true },
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "preparing",
        "processing",
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
    seller: {
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
    },

    // *****************Delivery Partner Details**************
    deliveryPartner: {
      partnerId: { type: String, default: null },
      name: { type: String, default: null },
      contact: { type: String, default: null },
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
      },
      timestamps: {
        acceptedAt: { type: Date, default: null },
        reachedPickupAt: { type: Date, default: null },
        pickedUpAt: { type: Date, default: null },
        deliveredAt: { type: Date, default: null },
      },
    },

    // *********Google Maps Distance & Duration Data********
    mapsData: {
      deliveryPartnerToSeller: {
        distance: {
          text: { type: String, default: null },
          value: { type: String, default: null },
        },
        duration: {
          text: { type: String, default: null },
          value: { type: String, default: null },
        },
      },
      sellerToUser: {
        distance: {
          text: { type: String, default: null },
          value: { type: String, default: null },
        },
        duration: {
          text: { type: String, default: null },
          value: { type: String, default: null },
        },
      },
    },
    // *************Order Items*****************
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
>>>>>>> origin/dev
