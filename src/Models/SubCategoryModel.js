const { number } = require("keygenerator/lib/keygen");

const AdminConnection = require("../Database/Connection").getAdminDB();

// function Schema() {
let subCategorySchema = new AdminConnection.Schema(
  {
    subCategoryId: { type: String, required: true, unique: true },
    sellerId: { type: String },
    categoryId: { type: String },
    dishName: { type: String },
    dishType: { type: String },
    dishImage: { type: String },
    servingSize: { type: String },
    description: { type: String },
    dishPrice: { type: String },
    gst: { type: String },
    packagePrice: { type: String },
    finalDishPrice: { type: String },
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

let subCategoryModel = AdminConnection.model("subcategory", subCategorySchema);

module.exports = subCategoryModel;
