const AdminConnection = require("../Database/Connection").getAdminDB();

// function Schema() {
let partnerSchema = new AdminConnection.Schema(
  {
    partnerId: { type: String, required: true, unique: true },
    areaId: { type: String, required: true },
    name: {
      type: String,
      required: true,
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
  }
);

let partnerModel = AdminConnection.model("partnermod", partnerSchema);

module.exports = partnerModel;