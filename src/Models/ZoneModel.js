const AdminConnection = require("../Database/Connection").getAdminDB();

// function Schema() {
let zoneSchema = new AdminConnection.Schema(
  {
    zoneId: { type: String, required: true, unique: true },
    zoneName: {
      type: String,
      required: true,
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

let zoneModel = AdminConnection.model("zones", zoneSchema);

module.exports = zoneModel;
