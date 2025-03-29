const AdminConnection = require("../Database/Connection").getAdminDB();

const locationSchema = new AdminConnection.Schema(
  {
    locationId: { type: String, required: true, unique: true },  
    country: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      trim: true,
      match: /^[0-9]{4,10}$/, // Ensures numeric pincode (4 to 10 digits)
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

let locationModel = AdminConnection.model("location", locationSchema);

module.exports = locationModel;
