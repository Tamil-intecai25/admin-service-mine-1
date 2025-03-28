const AdminConnection = require("../Database/Connection").getAdminDB();

// function Schema() {
let sellerSchema = new AdminConnection.Schema(
  {
    sellerId: { type: String , unique: true },
    sellerName: {
        type: String,
        // required: true,
      },
    phone: {
      type: String,
    //   required: true,
    },
    location: {
        branch: {
            lat : { type: Number },
            long: { type: Number },
            doorNo : { type : String},
            streetName : {type: String},
            landmark : { type : String}
            },
        // office: {
        //     lat: { type: Number },
        //     long: { type: Number },
        //     doorNo : { type : String},
        //     streetName : {type: String},
        //     landmark : { type : String}
        //     },
        // others: {
        //     lat: { type: Number },
        //     long: { type: Number },
        //     doorNo : { type : String},
        //     streetName : {type: String},
        //     landmark : { type : String}
        // },
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

let sellerModel = AdminConnection.model("sellers", sellerSchema);

module.exports = sellerModel;
