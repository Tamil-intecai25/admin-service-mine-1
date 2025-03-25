const AdminConnection = require("../Database/Connection").getAdminDB();

// function Schema() {
let categorySchema = new AdminConnection.Schema(
  {
    categoryId: { type: String, required: true, unique: true },
    sellerId: { type: String,},
    category: {
      type: String,
    //   required: true,
    },
    approvalStatus: {
      type: String,
      enum: ["active", "inactive"],
      default: "inactive",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "inactive",
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

let categoryModel = AdminConnection.model("category", categorySchema);

module.exports = categoryModel;
