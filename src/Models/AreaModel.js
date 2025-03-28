const AdminConnection = require("../Database/Connection").getAdminDB();

// function Schema() {
let areaSchema = new AdminConnection.Schema(
  {
    areaId: { type: String, required: true, unique: true },
    zoneId: { type: String,},
    zoneArea: {
      type: String,
    //   required: true,
    },
    polygoneLatelong: [
        {
          lat: { type: Number, },
          lng: { type: Number, },
          createdAt: { type: Date, default: () => Date.now() },
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
    hasDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

let areaModel = AdminConnection.model("area", areaSchema);

module.exports = areaModel;
