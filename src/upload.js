import multer from 'multer';
import multerS3 from 'multer-s3';
import s3 from './s3.js';

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    acl: 'public-read', // Allows public access to images
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      cb(null, `products/${Date.now()}_${file.originalname}`);
    }
  }),
});

export default upload;
