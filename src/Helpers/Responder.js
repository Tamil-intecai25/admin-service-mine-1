/* eslint-disable no-mixed-spaces-and-tabs */
function Responder() {


    this.sendSuccess = function (res, message, code = 200, data = {}){
    	let result = {};
    	res.setHeader('content-type','application/json');
        res.status(code);
    	result.success = true;
    	result.message = message;
        result.code= code;
    	result.data = data;
    	res.end(JSON.stringify(result));
    };

    this.sendFailure = function (res, message, code, data = {}) {
        let result = {};
    	res.setHeader('content-type','application/json');
        res.status(code);
    	result.success = false;
        result.message = message;
        result.code= code;
        result.data = data;
    	res.end(JSON.stringify(result));
    };
}

module.exports = new Responder();