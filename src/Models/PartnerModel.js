const AdminConnection = require("../Database/Connection").getAdminDB();

// function Schema() {
let partnerSchema = new AdminConnection.Schema(
  {
    partnerId: { type: String, unique: true },
    areaId: { type: String },
    name: {
      type: String,
      // required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    location: {
      lat: { type: Number },
      long: { type: Number },
      doorNo: { type: String },
      streetName: { type: String },
      landmark: { type: String },
    },
    status: {
      type: Boolean,
      default: false,
    },
    waitingTime: {
      type: Number,
      default: 0,
    },
    shiftTimings: [
      {
        startTime: { type: Date, required: true },
        endTime: { type: Date, required: true },
      },
    ],
    workStatus: {
      type: String,
      enum: [
        "waiting_for_order",
        "waiting_for_pickup",
        "drive_to_seller",
        "drive_to_user",
        "assigned",
      ],
      default: "waiting_for_order",
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
    hasDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },

  {
    orders: [
      {
        type: AdminConnection.Schema.Types.ObjectId,
        ref: "orders",
      },
    ],
  }
);

let partnerModel = AdminConnection.model("partnermod", partnerSchema);

module.exports = partnerModel;
