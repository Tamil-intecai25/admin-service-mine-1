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
