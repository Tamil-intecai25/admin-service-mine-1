require('dotenv').config();


let config = {
    baseUrl: process.env.BASE_URL,
    baseUrlPort: process.env.BASE_URL_PORT,
    kongApi: process.env.KONG_API,
    users: {
        admin: process?.env?.SUPERADMIN,
        merchant: process?.env?.MERCHANT
    },
    common: {
        passwordExp: process?.env?.PASSWORDEXP,
        sendEmail: process?.env?.SENDEMAIL,
        jwtSecretKey: process?.env?.JWTSECRETKEY,
        otpExp: process?.env?.OTPEXP,
        jwtTokenExp: process?.env?.JWTTOKENEXP,
    },
    kong: {
        kongUrl: process?.env?.KONGURL,
        kongAdmin: process?.env?.KONGADMINPORT,
    },
    dbUrl: {
        admin: process.env.DB_URL_ADMIN,
        merchant: process.env.DB_URL_MERCHANT,
        transaction: process.env.DB_URL_TRANSACTION,
        properties: process.env.DB_URL_PROPERTIES,
    },
    twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_ACCOUNT_TOKEN
    },
    message: {
        msg91: {
            authKey: process.env.MESSAGE_MSG91_AUTH_KEY,
            baseUrl: process.env.MESSAGE_MSG91_BASE_URL,
        }
    },
    email: {
        elasticEmail: {
            config: {
                username: process.env.EMAIL_ELASTIC_EMAIL_CONFIG_USERNAME,
                apiKey: process.env.EMAIL_ELASTIC_EMAIL_CONFIG_API_KEY
            }
        }
    },
    secretKey:{
        jwt_secret_key : process.env.JWT_SECRET_KEY,
        crypto_secret_key : process.env.CRYPTO_SECRET_KEY,
        app_secret_key : process.env.APP_SECRET_KEY
    },
    mail: {
        elasticEmailApiKey: process?.env?.EMAIL_API_KEY,
        elasticEmailUserName: process?.env?.ELASTICEMAIL_USERNAME,
        fromName: process?.env?.FROM_NAME,
  },
    thirdPartyService: {
        baseUrl: process.env?.THIRD_PARTY_SERVICE_BASE_URL,
        email: process.env?.THIRD_PARTY_SERVICE_BASE_URL,
        kong: {
            addBasicAuth: process.env?.THIRD_PARTY_SERVICE_KONG_ADD_BASIC_AUTH,
            createUser: process.env?.THIRD_PARTY_SERVICE_KONG_CREATE_USER,
            generateToken: process.env?.THIRD_PARTY_SERVICE_KONG_GENERATE_TOKEN,
            deleteToken: process.env?.THIRD_PARTY_SERVICE_KONG_DELETE_TOKEN,
            deleteAllToken: process.env?.THIRD_PARTY_SERVICE_KONG_DELETE_ALL_TOKEN,
        },
        s3Upload: process.env?.THIRD_PARTY_SERVICE_S3_UPLOAD,
        s3SignedUrl: process.env?.THIRD_PARTY_SERVICE_S3_SIGNED_URL,
    }
};


module.exports = config;