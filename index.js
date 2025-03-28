// server.js
const dotenv = require("dotenv");

dotenv.config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const path = require("path");
const fs = require("fs");
const nocache = require("nocache");
const Responder = require("./src/Helpers/Responder");
const { initializeSocket } = require("./src/Helpers/socketIo");

const app = express();

var accessLogStream = fs.createWriteStream(path.join(__dirname, "access.log"), {
  flags: "a",
});

app.use(morgan("combined", { stream: accessLogStream }));
const server = http.createServer(app);

const { io, sellers, deliveryPartners } = initializeSocket(
  7008,
  "http://localhost:7007"
);

module.exports = { io, sellers, deliveryPartners };

app.use((req, res, next) => {
  req.io = io;
  req.deliveryPartners = deliveryPartners;
  req.sellers = sellers;
  next();
});
app.use(helmet());
app.use(cors());
app.use(nocache());

app.use(
  bodyParser.json({
    limit: "50mb",
  })
);

require("./src/Database/Connection").createConnection();

app.use(bodyParser.json());

app.use(
  bodyParser.urlencoded({
    limit: "50mb",
    extended: false,
    parameterLimit: 1000000,
  })
);

function handleJsonParsingError(err, req, res, next) {
  if (err instanceof SyntaxError && err.message.includes("JSON")) {
    return Responder.sendFailure(
      res,
      "Invalid JSON format in request body",
      400,
      {}
    );
  }
  next(err);
}

app.use(handleJsonParsingError);

app.use(require("./src/Routes/MainRouter"));

app.listen(7007, (err) => {
  if (err) {
    console.error("Error in server setup:", err);
    process.exit(1);
  } else {
    console.log(`Server is running on port 7007`);
  }
});

// 404 Error Page
app.use(function (req, res) {
  return Responder.sendFailure(res, "Request Not Found", 404, {});
});
