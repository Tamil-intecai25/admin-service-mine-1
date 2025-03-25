const AdminConnection = require("../Database/Connection").getAdminDB();

// function Schema() {
let subCategorySchema = new AdminConnection.Schema(
  {
    subCategoryId: { type: String, required: true, unique: true },
    sellerId: { type: String,},
    categoryId: { type: String,},
    dishName: {
      type: String,
    //   required: true,
    },
    dishType: {
      type: String,
    //   required: true,
    },
    dishImage: {
      type: String,
    //   required: true,
    },
    servingSize: {
      type: String,
    //   required: true,
    },
    description: {
      type: String,
    //   required: true,
    },
    dishPrice: {
      type: String,
    //   required: true,
    },
    gst: {
      type: String,
    //   required: true,
    },
    packagePrice: {
      type: String,
    //   required: true,
    },
    finalDishPrice: {
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

let subCategoryModel = AdminConnection.model("subcategory", subCategorySchema);

module.exports = subCategoryModel;
