const jwt = require("jsonwebtoken");
var Responder = require("../Helpers/Responder");

function Controller(){
    this.verifyToken = async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return Responder.sendFailure(res, "Token missing or invalid", 403);
            }

            const token = authHeader.split(" ")[1];

            // Verify JWT Token
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                // console.log("decoded",decoded,"decoded");return;
                req.user = decoded; // Attach decoded user data to request
                next(); // Proceed to next middleware or route handler
            } catch (error) {
                if (error.name === "TokenExpiredError") {
                    return Responder.sendFailure(res, "Token has expired", 403);
                } else {
                    return Responder.sendFailure(res, "Invalid token", 401);
                }
            }
        } catch (error) {
            console.error("Token verification error:", error);
            return Responder.sendFailure(res, "Something went wrong", 500);
        }
    };
}

module.exports = new Controller();