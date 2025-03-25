const AdminConnection = require("../Database/Connection").getAdminDB();

// function Schema() {
let userSchema = new AdminConnection.Schema(
  {
    userId: { type: String, required: true, unique: true },
    name: {
        type: String,
        // required: true,
      },
    phone: {
      type: String,
    //   required: true,
    },
    location: {
        home: {
            lat : { type: Number },
            lng: { type: Number },
            doorNo : { type : String},
            streetName : {type: String},
            landmark : { type : String}
            },
        office: {
            lat: { type: Number },
            lng: { type: Number },
            doorNo : { type : String},
            streetName : {type: String},
            landmark : { type : String}
            },
        others: {
            lat: { type: Number },
            lng: { type: Number },
            doorNo : { type : String},
            streetName : {type: String},
            landmark : { type : String}
        },
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

let userModel = AdminConnection.model("oneappuser", userSchema);

module.exports = userModel;
