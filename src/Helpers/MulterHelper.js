const { Upload } = require("@aws-sdk/lib-storage");
const { S3Client } = require("@aws-sdk/client-s3");
const multer = require('multer')
var path = './uploads';
const s3Config = require("../Configs/Config").s3;
// console.log("s3Config.accessKey",s3Config.accessKey,"s3Config.accessKey");return;
const s3 = new S3Client({
  credentials: {
      accessKeyId: s3Config.accessKey,
      secretAccessKey: s3Config.secretKey,
  },
  region: s3Config.region
});

const fileFilter = (req, file, cb) => {
    console.log(file.mimetype);
    if (file.mimetype === "text/csv" || file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type, only CSV is allowed!"), false);
    }
};

const storage = multer.diskStorage({
  destination: path,
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
})

const maxSize = 1 * 1024 * 1024; // for 1MB 

const upload = multer({
    fileFilter,
    storage: storage,
    limits: { fileSize: maxSize }
}).single('file')

const fs = require('fs');
// const s3Upload = (filePath, fileName) =>{
//   return new Promise((resolve, reject) => {
//       if(!fileName){
//           fileName = require('path').basename(filePath);
//       }
//       const fileStream = fs.createReadStream(filePath)
//       fileStream.on('open', () =>{
//           // upload to S3
//           new Upload({
//               client: s3,
//               params: {
//                   // public-read
//                   ACL: 'private', //REFER https://docs.aws.amazon.com/AmazonS3/latest/userguide/acl-overview.html
//                   Bucket: s3Config.bucketName,
//                   Key: 'bulkupload/'+fileName,
//                   Body: fileStream,
//               },
//               // tags: [], // optional tags
//               // queueSize: 4, // optional concurrency configuration
//               // partSize: 1024 * 1024 * 5, // optional size of each part, in bytes, at least 5MB
//               // leavePartsOnError: false, // optional manually handle dropped parts
//           }).done().then(data => {
//               resolve(data);
//           }).catch((err) => {
//               reject(err);
//           })
//       });
//   });
// }

module.exports = {upload}