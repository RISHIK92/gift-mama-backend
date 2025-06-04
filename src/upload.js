// import multer from "multer";
// import multerS3 from "multer-s3";
// import s3 from "./s3.js";

// const upload = multer({
//   storage: multerS3({
//     s3: s3,
//     bucket: process.env.AWS_BUCKET_NAME,
//     acl: "public-read", // Allows public access to images
//     contentType: multerS3.AUTO_CONTENT_TYPE,
//     key: function (req, file, cb) {
//       cb(null, `products/${Date.now()}_${file.originalname}`);
//     },
//   }),
// });

// export default upload;

// utils/upload.js
import multer from "multer";
import multerS3 from "multer-s3";
import s3 from "./s3.js";

const CLOUDFRONT_URL = process.env.CLOUDFRONT_URL;

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env._NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const filename = `products/${Date.now()}_${file.originalname}`;
      cb(null, filename);
    },
  }),
});

const handleUpload = (req, res) => {
  if (!req.file || !req.file.key) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const cloudfrontUrl = `${CLOUDFRONT_URL}/${req.file.key}`;

  return res.status(200).json({ url: cloudfrontUrl });
};

export { upload as default, handleUpload };
