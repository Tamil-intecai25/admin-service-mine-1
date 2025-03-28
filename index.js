const dotenv = require('dotenv');
dotenv.config();

let Config = require('./src/Configs/Config');

let express = require('express');
let app = express();
let cors = require('cors');
let morgan = require('morgan');
let bodyParser = require('body-parser');
let helmet = require('helmet');
let path = require('path');
let fs = require('fs');
const nocache = require('nocache');
const jwt = require("jsonwebtoken");

const Responder = require('./src/Helpers/Responder');

var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });

app.use(morgan('combined', { stream: accessLogStream }));
app.use(helmet());
app.use(cors());
app.use(nocache());


app.use(
    bodyParser.json({
        limit: '50mb'
    })
);


require('./src/Database/Connection').createConnection();

app.use(bodyParser.json());

app.use(
    bodyParser.urlencoded({
        limit: '50mb',
        extended: false,
        parameterLimit: 1000000
    })
);
function handleJsonParsingError(err, req, res, next) {
    if (err instanceof SyntaxError && err.message.includes('JSON')) {
        return Responder.sendFailure(res, 'Invalid JSON format in request body', 400, {});
    }
    
    next(err);
}

app.use(handleJsonParsingError);

app.use(require("./src/Routes/MainRouter"));

app.listen(7007, (err) => { 
    if (err) {
        console.error('Error in server setup:', err);
        process.exit(1); // Exit if server setup fails
    } else {
        console.log(`Server is running on port 7007`);
    }
});


//404 Error Pagek 
app.use(function (req, res) {
    return Responder.sendFailure(res, "Request Not Found", 404, {});
});
