import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { signInSchema, signUpSchema } from "../utils/types/zodTypes.js";
import { authenticateUser } from "../auth/middleware.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import {
  s3Client,
  PutObjectCommand,
  BUCKET_NAME,
  upload,
  uuidv4,
} from "./s3.js";
import testimonialsapp from "./routes/testimonials.js";
import path from "path";
import sharp from "sharp";

dotenv.config();

const prisma = new PrismaClient();
const app = express();

app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173", // or your frontend URL
    credentials: true,
  })
);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const processImageByShape = async (inputPath, shape, width, height) => {
  const outputPath = `${inputPath}-processed.png`;
  const sharpInstance = sharp(inputPath);

  // Resize to match the requested dimensions
  sharpInstance.resize(width, height, { fit: "cover" });

  // Create a mask buffer based on shape
  let maskBuffer;

  switch (shape) {
    case "circle": {
      // Create a circular mask
      const radius = Math.min(width, height) / 2;
      const centerX = width / 2;
      const centerY = height / 2;

      maskBuffer = await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${width}" height="${height}">
              <circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="white"/>
            </svg>`
            ),
            blend: "over",
          },
        ])
        .png()
        .toBuffer();
      break;
    }

    case "hexagon": {
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2;

      let points = "";
      for (let i = 0; i < 6; i++) {
        const angle = (i * 2 * Math.PI) / 6 - Math.PI / 6;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        points += `${x},${y} `;
      }

      maskBuffer = await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${width}" height="${height}">
              <polygon points="${points}" fill="white"/>
            </svg>`
            ),
            blend: "over",
          },
        ])
        .png()
        .toBuffer();
      break;
    }

    case "triangle": {
      maskBuffer = await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${width}" height="${height}">
              <polygon points="${
                width / 2
              },0 ${width},${height} 0,${height}" fill="white"/>
            </svg>`
            ),
            blend: "over",
          },
        ])
        .png()
        .toBuffer();
      break;
    }

    default: {
      // Rectangle is default
      maskBuffer = await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${width}" height="${height}">
              <rect width="${width}" height="${height}" fill="white"/>
            </svg>`
            ),
            blend: "over",
          },
        ])
        .png()
        .toBuffer();
    }
  }

  // Apply the mask to the image
  await sharpInstance
    .composite([{ input: maskBuffer, blend: "dest-in" }])
    .toFile(outputPath);

  return outputPath;
};

app.post("/register", async (req, res) => {
  try {
    const parsedData = signUpSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({ message: parsedData.error.errors });
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      whatsappNumber,
      usePrimaryForWhatsApp,
      image,
      address1,
      address2,
      city,
      state,
      country,
      pinCode,
      password,
    } = parsedData.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        whatsappNumber,
        usePrimaryForWhatsApp: usePrimaryForWhatsApp || false,
        image,
        address1,
        address2,
        city,
        state,
        country,
        pinCode,
        password: hashPassword,
      },
    });

    return res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const parsedData = signInSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({ message: parsedData.error.errors });
    }

    const { email, password } = parsedData.data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, firstName: user.firstName },
      process.env.JWT_SECRET
    );

    return res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/user", authenticateUser, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        whatsappNumber: true,
        usePrimaryForWhatsApp: true,
        image: true,
        address1: true,
        address2: true,
        city: true,
        state: true,
        country: true,
        pinCode: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.put("/update-profile", authenticateUser, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      whatsappNumber,
      usePrimaryForWhatsApp,
      image,
      address1,
      address2,
      city,
      state,
      country,
      pinCode,
    } = req.body;

    if (email !== req.user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(400).json({ message: "Email already in use" });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        firstName,
        lastName,
        email,
        phone,
        whatsappNumber,
        usePrimaryForWhatsApp,
        image,
        address1,
        address2,
        city,
        state,
        country,
        pinCode,
      },
    });

    const { password, ...userWithoutPassword } = updatedUser;

    return res.status(200).json({
      message: "Profile updated successfully",
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PRODUCT ROUTES
app.get("/products", async (req, res) => {
  try {
    const {
      category,
      occasion,
      recipient,
      subCategory,
      minPrice,
      maxPrice,
      search,
    } = req.query;

    // Build filter conditions
    let whereConditions = {};

    if (category) {
      whereConditions.categories = { has: category };
    }

    if (occasion) {
      whereConditions.occasion = { has: occasion };
    }

    if (recipient) {
      whereConditions.recipients = { has: recipient };
    }

    if (subCategory) {
      whereConditions.subCategories = { has: subCategory };
    }

    if (minPrice) {
      whereConditions.price = { gte: parseFloat(minPrice) };
    }

    if (maxPrice) {
      whereConditions.price = {
        ...whereConditions.price,
        lte: parseFloat(maxPrice),
      };
    }

    if (search) {
      whereConditions.name = { contains: search, mode: "insensitive" };
    }

    const products = await prisma.product.findMany({
      where: whereConditions,
      include: {
        images: true,
        customizationTemplates: true,
      },
    });

    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// app.get('/products/:id', async (req, res) => {
//     try {
//         const id = parseInt(req.params.id);
//         const product = await prisma.product.findUnique({
//             where: { id },
//             include: {
//                 images: true,
//                 customizationTemplate: true
//             }
//         });

//         if (!product) {
//             return res.status(404).json({ message: "Product not found" });
//         }

//         return res.status(200).json(product);
//     } catch (error) {
//         console.error("Error fetching product:", error);
//         res.status(500).json({ message: "Internal server error" });
//     }
// });

// app.post('/cart/add-customized', authenticateUser, async (req, res) => {
//   try {
//     const { productId, items } = req.body;

//     let cart = await prisma.cart.findUnique({
//       where: { userId: req.user.id }
//     });

//     if (!cart) {
//       cart = await prisma.cart.create({
//         data: { userId: req.user.id }
//       });
//     }

//     const cartItem = await prisma.cartItem.create({
//       data: {
//         cartId: cart.id,
//         productId: parseInt(productId),
//         quantity: 1,
//         customizationDetails: items.map(item => ({
//           maskId: item.customizations.maskId,
//           uploadId: item.customizations.uploadId,
//           position: item.customizations.position,
//           scale: item.customizations.scale,
//           rotation: item.customizations.rotation
//         })),
//         customizationImageUrls: items.map(item => item.customizations.imageUrl)
//       }
//     });

//     res.json(cartItem);
//   } catch (error) {
//     console.error('Error adding customized product to cart:', error);
//     res.status(500).json({ message: 'Error adding customized product to cart' });
//   }
// });

app.post(
  "/upload/custom-image",
  authenticateUser,
  upload.single("image"),
  async (req, res) => {
    try {
      console.log("Upload request received:", req.body);

      // Extract parameters from request
      const { productId, templateId, areaId, width, height, shape } = req.body;

      let scale = req.body.scale || 1.0;
      let rotation = req.body.rotation || 0;
      let positionX = req.body.positionX || 0;
      let positionY = req.body.positionY || 0;
      let file;
      let imageBuffer;
      let contentType;

      // Check if the file is in req.file
      if (req.file) {
        file = req.file;
        imageBuffer = file.buffer;
        contentType = file.mimetype;
      } else if (req.body.image) {
        const base64Data = req.body.image;
        imageBuffer = Buffer.from(base64Data.split(",")[1], "base64");
        contentType = "image/png";
      } else {
        return res.status(400).json({ message: "No image file provided" });
      }

      // Convert string values to appropriate types
      const parsedProductId = parseInt(productId);
      const parsedTemplateId = parseInt(templateId);
      const parsedAreaId = parseInt(areaId);
      const parsedWidth = width ? parseInt(width) : null;
      const parsedHeight = height ? parseInt(height) : null;
      const parsedScale = parseFloat(scale);
      const parsedRotation = parseFloat(rotation);
      const parsedPositionX = parseFloat(positionX);
      const parsedPositionY = parseFloat(positionY);

      // Generate a unique filename
      const fileName = `custom-image-${Date.now()}.png`;
      const key = `custom-uploads/${parsedProductId}/${parsedTemplateId}/${parsedAreaId}/${fileName}`;

      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: imageBuffer,
        ContentType: contentType,
      };

      // Upload to S3
      await s3Client.send(new PutObjectCommand(uploadParams));
      const imageUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;

      // Save to database using the updated schema
      const customUpload = await prisma.customUpload.create({
        data: {
          productId: parsedProductId,
          userId: req.user.id,
          templateId: parsedTemplateId,
          areaId: parsedAreaId,
          imageUrl,
          originalImageUrl: imageUrl,
          width: parsedWidth,
          height: parsedHeight,
          scale: parsedScale,
          rotation: parsedRotation,
          positionX: parsedPositionX,
          positionY: parsedPositionY,
          shape,
        },
      });

      // Return the response in format expected by frontend
      res.json({
        id: customUpload.id,
        imageUrl,
        originalImageUrl: imageUrl,
        width: parsedWidth,
        height: parsedHeight,
        scale: parsedScale,
        rotation: parsedRotation,
        positionX: parsedPositionX,
        positionY: parsedPositionY,
        shape,
      });
    } catch (error) {
      console.error("Error uploading custom image:", error);
      res.status(500).json({
        message: "Error uploading custom image",
        error: error.message,
      });
    }
  }
);

app.get("/products/:id/masks", async (req, res) => {
  try {
    const productId = parseInt(req.params.id);

    const productMasks = await prisma.productMask.findMany({
      where: { productId },
      include: { mask: true },
    });

    const masks = productMasks.map((pm) => pm.mask);

    res.status(200).json(masks);
  } catch (error) {
    console.error("Error fetching product masks:", error);
    res.status(500).json({ message: "Failed to fetch product masks" });
  }
});

app.post(
  "/upload/custom-image-direct",
  authenticateUser,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file uploaded" });
      }

      // Required fields
      const { productId, areaIndex } = req.body;
      if (!productId || areaIndex === undefined) {
        return res.status(400).json({
          message: "Product ID and Area Index are required",
          code: "MISSING_REQUIRED_FIELDS",
        });
      }

      // Generate unique filename
      const fileExtension = path.extname(req.file.originalname);
      const filename = `custom-${Date.now()}${fileExtension}`;

      // Upload to S3
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: `custom-images/${filename}`,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        })
      );

      // Generate URL
      const imageUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/custom-images/${filename}`;

      res.status(200).json({
        message: "Image uploaded successfully",
        imageUrl,
        areaIndex: Number(areaIndex),
      });
    } catch (error) {
      console.error("Error uploading custom image:", error);
      res.status(500).json({
        message: "Error uploading image",
        error: error.message,
      });
    }
  }
);

app.get("/products/:name", async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const product = await prisma.product.findUnique({
      where: { name },
      include: {
        images: true,
        customizationTemplates: true,
      },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.status(200).json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// The existing route needs to be updated to include masks
// app.get('/products/:id/customized-preview', async (req, res) => {
//   try {
//     const productId = parseInt(req.params.id);

//     const product = await prisma.product.findUnique({
//       where: { id: productId },
//       include: {
//         customizationTemplates: true,
//         customizationAreas: true,
//         productMasks: {
//           include: {
//             mask: true
//           },
//           orderBy: {
//             id: 'asc'
//           }
//         }
//       }
//     });

//     if (!product) {
//       return res.status(404).json({ message: "Product not found" });
//     }

//     // Format the data for the frontend
//     const masks = product.productMasks.map(pm => pm.mask);

//     return res.status(200).json({
//       id: product.id,
//       name: product.name,
//       customizationTemplates: product.customizationTemplates || [],
//       customizationAreas: product.customizationAreas || [],
//       masks: masks
//     });
//   } catch (error) {
//     console.error("Error fetching customized preview:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// });

// app.get('/products/:id/customized-preview', async (req, res) => {
//   try {
//       const productId = parseInt(req.params.id);

//       const product = await prisma.product.findUnique({
//           where: { id: productId },
//           include: { customizationTemplate: true }
//       });

//       if (!product) {
//           return res.status(404).json({ message: "Product not found" });
//       }
//       const svgTemplates = [
//         // Mug
//         `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 600 600">
//   <!-- Background -->
//   <rect width="600" height="600" fill="#f8f9fa" />

//   <!-- Mug Base -->
//   <path d="M200,200 C200,180 220,160 240,160 L360,160 C380,160 400,180 400,200 L400,400 C400,420 380,440 360,440 L240,440 C220,440 200,420 200,400 Z" fill="#ffffff" stroke="#333333" stroke-width="5"/>

//   <!-- Mug Handle -->
//   <path d="M400,220 C450,220 470,260 470,300 C470,340 450,380 400,380" fill="transparent" stroke="#333333" stroke-width="5" stroke-linecap="round"/>

//   <!-- Mug Top Edge -->
//   <ellipse cx="300" cy="160" rx="60" ry="20" fill="#ffffff" stroke="#333333" stroke-width="5"/>

//   <!-- Mug Bottom Shadow -->
//   <ellipse cx="300" cy="440" rx="60" ry="10" fill="#dddddd" stroke="none"/>

//   <!-- Customization Area -->
//   <g id="customization-area">
//     <!-- Default placeholder text (will be hidden when image is uploaded) -->
//     <text x="300" y="300" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="24" fill="#888888">
//       Your Design Here
//     </text>

//     <!-- Placeholder for user image -->
//     <image id="custom-image-placeholder" x="240" y="220" width="120" height="120" xlink:href="" preserveAspectRatio="xMidYMid meet"/>

//     <!-- Customization area outline (optional, for visual guidance) -->
//     <rect x="240" y="220" width="120" height="120" fill="none" stroke="#cccccc" stroke-width="1" stroke-dasharray="5,5"/>
//   </g>

//   <!-- Mug highlights -->
//   <path d="M210,210 C220,190 235,180 250,180 L255,180" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
//   <path d="M240,420 C235,420 225,415 220,410 L215,400" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.5"/>

//   <!-- Product title -->
//   <text x="300" y="100" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold" fill="#333333">
//     Customizable Mug
//   </text>

//   <!-- Instructions -->
//   <text x="300" y="520" text-anchor="middle" font-family="Arial" font-size="14" fill="#666666">
//     Preview 1: Front view of mug
//   </text>
// </svg>`,

//         // Template 2: Mug with angled view
//         `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 600 600">
//   <!-- Background -->
//   <rect width="600" height="600" fill="#f8f9fa" />

//   <!-- Mug from different angle (perspective view) -->
//   <g transform="translate(300, 300) rotate(-15) translate(-300, -300)">
//     <!-- Mug Base -->
//     <ellipse cx="300" cy="440" rx="80" ry="20" fill="#dddddd" stroke="none"/>
//     <path d="M220,200 C220,180 240,160 270,160 L330,160 C360,160 380,180 380,200 L380,400 C380,420 360,440 330,440 L270,440 C240,440 220,420 220,400 Z" fill="#ffffff" stroke="#333333" stroke-width="5"/>

//     <!-- Mug Top Edge (perspective ellipse) -->
//     <ellipse cx="300" cy="160" rx="55" ry="20" fill="#ffffff" stroke="#333333" stroke-width="5"/>

//     <!-- Mug Handle (adjusted for perspective) -->
//     <path d="M380,220 C430,230 440,260 440,300 C440,340 430,370 380,380" fill="transparent" stroke="#333333" stroke-width="5" stroke-linecap="round"/>

//     <!-- Customization Area (adjusted for perspective) -->
//     <g id="customization-area">
//       <!-- Default placeholder text -->
//       <text x="300" y="300" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="24" fill="#888888" transform="rotate(15, 300, 300)">
//         Your Design Here
//       </text>

//       <!-- Placeholder for user image -->
//       <image id="custom-image-placeholder" x="240" y="220" width="120" height="120" xlink:href="" preserveAspectRatio="xMidYMid meet"/>

//       <!-- Customization area outline -->
//       <rect x="240" y="220" width="120" height="120" fill="none" stroke="#cccccc" stroke-width="1" stroke-dasharray="5,5"/>
//     </g>
//   </g>

//   <!-- Product title -->
//   <text x="300" y="100" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold" fill="#333333">
//     Customizable Mug
//   </text>

//   <!-- Instructions -->
//   <text x="300" y="520" text-anchor="middle" font-family="Arial" font-size="14" fill="#666666">
//     Preview 2: Angled view of mug
//   </text>
// </svg>`,

//         // Template 3: Circle input template
//         `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 600 600">
//   <!-- Background -->
//   <rect width="600" height="600" fill="#f8f9fa" />

//   <!-- Mug Base -->
//   <path d="M200,200 C200,180 220,160 240,160 L360,160 C380,160 400,180 400,200 L400,400 C400,420 380,440 360,440 L240,440 C220,440 200,420 200,400 Z" fill="#ffffff" stroke="#333333" stroke-width="5"/>

//   <!-- Mug Handle -->
//   <path d="M400,220 C450,220 470,260 470,300 C470,340 450,380 400,380" fill="transparent" stroke="#333333" stroke-width="5" stroke-linecap="round"/>

//   <!-- Mug Top Edge -->
//   <ellipse cx="300" cy="160" rx="60" ry="20" fill="#ffffff" stroke="#333333" stroke-width="5"/>

//   <!-- Mug Bottom Shadow -->
//   <ellipse cx="300" cy="440" rx="60" ry="10" fill="#dddddd" stroke="none"/>

//   <!-- Circular Customization Area -->
//   <g id="customization-area">
//     <!-- Circle clip path -->
//     <defs>
//       <clipPath id="circle-clip">
//         <circle cx="300" cy="280" r="70" />
//       </clipPath>
//     </defs>

//     <!-- Circle outline for guidance -->
//     <circle cx="300" cy="280" r="70" fill="none" stroke="#cccccc" stroke-width="2" stroke-dasharray="5,5"/>

//     <!-- Default placeholder text -->
//     <text x="300" y="280" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="18" fill="#888888">
//       Add Your
//     </text>
//     <text x="300" y="305" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="18" fill="#888888">
//       Circular Design
//     </text>

//     <!-- Placeholder for user image (clipped to circle) -->
//     <image id="custom-image-placeholder" x="230" y="210" width="140" height="140" xlink:href="" preserveAspectRatio="xMidYMid meet" clip-path="url(#circle-clip)"/>
//   </g>

//   <!-- Product title -->
//   <text x="300" y="100" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold" fill="#333333">
//     Circle Template Mug
//   </text>

//   <!-- Instructions -->
//   <text x="300" y="520" text-anchor="middle" font-family="Arial" font-size="14" fill="#666666">
//     Preview 3: Upload a circular image or logo
//   </text>
// </svg>`,

//         // Template 4: Heart shape template
//         `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 600 600">
//   <!-- Background -->
//   <rect width="600" height="600" fill="#f8f9fa" />

//   <!-- Mug Base -->
//   <path d="M200,200 C200,180 220,160 240,160 L360,160 C380,160 400,180 400,200 L400,400 C400,420 380,440 360,440 L240,440 C220,440 200,420 200,400 Z" fill="#ffffff" stroke="#333333" stroke-width="5"/>

//   <!-- Mug Handle -->
//   <path d="M400,220 C450,220 470,260 470,300 C470,340 450,380 400,380" fill="transparent" stroke="#333333" stroke-width="5" stroke-linecap="round"/>

//   <!-- Mug Top Edge -->
//   <ellipse cx="300" cy="160" rx="60" ry="20" fill="#ffffff" stroke="#333333" stroke-width="5"/>

//   <!-- Mug Bottom Shadow -->
//   <ellipse cx="300" cy="440" rx="60" ry="10" fill="#dddddd" stroke="none"/>

//   <!-- Heart-shaped Customization Area -->
//   <g id="customization-area">
//     <!-- Heart clip path -->
//     <defs>
//       <clipPath id="heart-clip">
//         <path d="M300,350 C260,310 220,270 220,230 C220,200 240,180 270,180 C285,180 295,190 300,200 C305,190 315,180 330,180 C360,180 380,200 380,230 C380,270 340,310 300,350 Z" />
//       </clipPath>
//     </defs>

//     <!-- Heart outline for guidance -->
//     <path d="M300,350 C260,310 220,270 220,230 C220,200 240,180 270,180 C285,180 295,190 300,200 C305,190 315,180 330,180 C360,180 380,200 380,230 C380,270 340,310 300,350 Z" fill="none" stroke="#cccccc" stroke-width="2" stroke-dasharray="5,5"/>

//     <!-- Default placeholder text -->
//     <text x="300" y="260" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="18" fill="#888888">
//       Add Your
//     </text>
//     <text x="300" y="285" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="18" fill="#888888">
//       Heart Design
//     </text>

//     <!-- Placeholder for user image (clipped to heart shape) -->
//     <image id="custom-image-placeholder" x="220" y="180" width="160" height="170" xlink:href="" preserveAspectRatio="xMidYMid meet" clip-path="url(#heart-clip)"/>
//   </g>

//   <!-- Product title -->
//   <text x="300" y="100" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold" fill="#333333">
//     Heart Template Mug
//   </text>

//   <!-- Instructions -->
//   <text x="300" y="520" text-anchor="middle" font-family="Arial" font-size="14" fill="#666666">
//     Preview 4: Upload an image for heart-shaped customization
//   </text>
// </svg>`
//       ];

//       // If customizationTemplate exists, use it as the first template and include the default ones
//       if (product.customizationTemplate) {
//         // Put the database template first in the array
//         svgTemplates.unshift(product.customizationTemplate.svgData);
//       }

//       return res.status(200).json({
//           svgTemplates: svgTemplates
//       });
//   } catch (error) {
//       console.error("Error fetching customized preview:", error);
//       res.status(500).json({ message: "Internal server error" });
//   }
// });

// CATEGORIES ROUTES
app.get("/categories", async (req, res) => {
  try {
    const categories = await prisma.category.findMany();
    res.status(200).json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/nav-categories", async (req, res) => {
  try {
    const navCategories = await prisma.navCategory.findMany();
    res.status(200).json(navCategories);
  } catch (error) {
    console.error("Error fetching navigation categories:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/all-categories", async (req, res) => {
  try {
    const allCategories = await prisma.allCategories.findMany();
    res.status(200).json(allCategories);
  } catch (error) {
    console.error("Error fetching all categories:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/get-categories", async (req, res) => {
  try {
    const categories = await prisma.categories.findMany();
    res.status(200).json(categories);
  } catch (error) {
    console.error("Error fetching all categories:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/get-occasions", async (req, res) => {
  try {
    const occasion = await prisma.occasions.findMany();
    res.status(200).json(occasion);
  } catch (error) {
    console.error("Error fetching all occasions:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/get-recipients", async (req, res) => {
  try {
    const recipient = await prisma.recipients.findMany();
    res.status(200).json(recipient);
  } catch (error) {
    console.error("Error fetching all recipients:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// HOME PAGE ROUTES
app.get("/home", async (req, res) => {
  try {
    const homeImages = await prisma.homeImages.findMany({
      include: {
        customSections: true,
      },
    });
    const occasions = await prisma.occasion.findMany();

    // Check if there's an active flash sale
    const currentTime = new Date();
    const activeFlashSales = await prisma.flashSale.findMany({
      where: {
        active: true,
        startTime: { lte: currentTime },
        endTime: { gte: currentTime },
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
          },
        },
      },
      take: 1,
    });

    res.status(200).json({
      homeImages,
      occasions,
      activeFlashSale: activeFlashSales.length > 0 ? activeFlashSales[0] : null,
    });
  } catch (error) {
    console.error("Error fetching home page data:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/flash-sales", async (req, res) => {
  try {
    const currentTime = new Date();

    const flashSales = await prisma.flashSale.findMany({
      where: {
        active: true,
        startTime: { lte: currentTime },
        endTime: { gte: currentTime },
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
          },
        },
      },
    });

    res.status(200).json(flashSales);
  } catch (error) {
    console.error("Error fetching flash sales:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/flash-sales/active", async (req, res) => {
  try {
    const now = new Date();

    const activeFlashSales = await prisma.flashSale.findMany({
      where: {
        active: true,
        startTime: {
          lte: now,
        },
        endTime: {
          gte: now,
        },
      },
      orderBy: {
        endTime: "asc",
      },
    });

    res.json(activeFlashSales);
  } catch (error) {
    console.error("Error fetching active flash sales:", error);
    res.status(500).json({ error: "Failed to fetch active flash sales" });
  }
});

app.get("/flash-sales/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const now = new Date();
    const flashSale = await prisma.flashSale.findFirst({
      where: {
        id: parseInt(id),
        active: true,
        startTime: {
          lte: now,
        },
        endTime: {
          gte: now,
        },
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
          },
        },
      },
    });

    if (!flashSale) {
      return res
        .status(404)
        .json({ error: "Flash sale not found or not active" });
    }

    res.json(flashSale);
  } catch (error) {
    console.error("Error fetching flash sale details:", error);
    res.status(500).json({ error: "Failed to fetch flash sale details" });
  }
});

app.post("/cart/add", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Find or create user's cart
    let cart = await prisma.cart.findFirst({
      where: { userId },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
      });
    }

    // Check if item is already in cart
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId,
      },
    });

    if (existingItem) {
      // Update quantity if item already exists
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity },
      });
    } else {
      // Add new item to cart
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity,
        },
      });
    }

    // Recalculate discounts if a coupon is applied
    if (cart.couponId) {
      await recalculateCartDiscount(cart.id);
    }

    res.status(201).json({ message: "Item added to cart" });
  } catch (error) {
    console.error("Error adding item to cart:", error);
    res.status(500).json({ message: "Failed to add item to cart" });
  }
});

async function recalculateCartDiscount(cartId) {
  try {
    // Fetch cart with items and coupon
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        appliedCoupon: true,
      },
    });

    if (!cart || !cart.coupon) {
      return; // No coupon to recalculate
    }

    // Calculate cart subtotal
    const subtotal = cart.items.reduce((total, item) => {
      const price = item.product.discountedPrice || item.product.price;
      return total + parseFloat(price) * item.quantity;
    }, 0);

    // Check if cart still meets minimum purchase requirement
    if (
      cart.coupon.minPurchaseAmount &&
      subtotal < parseFloat(cart.coupon.minPurchaseAmount)
    ) {
      // Remove coupon if minimum purchase is no longer met
      await prisma.cart.update({
        where: { id: cartId },
        data: {
          appliedCouponId: null,
          discountAmount: 0,
        },
      });
      return;
    }

    // Calculate discount amount
    let discountAmount = 0;

    if (cart.coupon.discountType === "PERCENTAGE") {
      discountAmount = subtotal * (parseFloat(cart.coupon.discountValue) / 100);

      // Apply max discount cap if exists
      if (cart.coupon.maxDiscountAmount) {
        discountAmount = Math.min(
          discountAmount,
          parseFloat(cart.coupon.maxDiscountAmount)
        );
      }
    } else {
      // FIXED discount
      discountAmount = parseFloat(cart.coupon.discountValue);

      // Ensure discount doesn't exceed cart total
      discountAmount = Math.min(discountAmount, subtotal);
    }

    // Update cart with new discount amount
    await prisma.cart.update({
      where: { id: cartId },
      data: {
        discountAmount,
      },
    });
  } catch (error) {
    console.error("Error recalculating cart discount:", error);
    throw error;
  }
}

app.get("/cart", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch cart with items and product details
    const cart = await prisma.cart.findFirst({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: true,
                productMasks: {
                  include: {
                    mask: true,
                  },
                },
              },
            },
          },
        },
        appliedCoupon: true,
      },
    });

    if (!cart) {
      return res.json({
        items: [],
        summary: {
          subtotal: 0,
          discount: 0,
          total: 0,
          deliveryFee: 0,
          tax: 0,
        },
      });
    }

    // Process cart items
    const items = cart.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      product: {
        id: item.product.id,
        name: item.product.name,
        price: parseFloat(item.product.price.toString()),
        discountedPrice: item.product.discountedPrice
          ? parseFloat(item.product.discountedPrice.toString())
          : null,
        description: item.product.description,
        images: item.product.images || [],
        color: item.product.color || null,
        size: item.product.size || null,
        deliveryFee: item.product.deliveryFee
          ? parseFloat(item.product.deliveryFee.toString())
          : 0,
        isCustomizable: item.product.isCustomizable,
        customizationOptions: item.product.customizationOptions || null,
        masks: item.product.productMasks.map((pm) => ({
          id: pm.mask.id,
          name: pm.mask.name,
          svgPath: pm.mask.svgPath,
          description: pm.mask.description,
          maskImageUrl: pm.mask.maskImageUrl,
        })),
        stock: item.product.stock || 0,
      },
      customizationDetails: item.customizationDetails || null,
      customizationImageUrls: item.customizationImageUrls || [],
      customTemplateId: item.customTemplateId || null,
      flashSalePrice: item.flashSalePrice
        ? parseFloat(item.flashSalePrice.toString())
        : null,
    }));

    // Calculate cart summary
    let subtotal = 0;
    let deliveryFee = 0;

    items.forEach((item) => {
      const price =
        item.flashSalePrice ||
        item.product.discountedPrice ||
        item.product.price;
      subtotal += price * item.quantity;
      deliveryFee += item.product.deliveryFee * item.quantity;
    });

    // Calculate discount
    let discountAmount = 0;
    if (cart.appliedCoupon) {
      if (cart.appliedCoupon.discountType === "PERCENTAGE") {
        const discountValue = parseFloat(
          cart.appliedCoupon.discountValue.toString()
        );
        discountAmount = subtotal * (discountValue / 100);

        // Apply max discount if specified
        if (cart.appliedCoupon.maxDiscountAmount) {
          const maxDiscount = parseFloat(
            cart.appliedCoupon.maxDiscountAmount.toString()
          );
          discountAmount = Math.min(discountAmount, maxDiscount);
        }
      } else {
        // FIXED amount
        discountAmount = parseFloat(
          cart.appliedCoupon.discountValue.toString()
        );
      }
    }

    // Apply any existing discount amount from cart as fallback
    if (cart.discountAmount) {
      const cartDiscount = parseFloat(cart.discountAmount.toString());
      discountAmount = Math.max(discountAmount, cartDiscount);
    }

    // Calculate tax and total
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * 0;
    const total = taxableAmount + deliveryFee + taxAmount;

    // Build response
    const response = {
      items,
      summary: {
        subtotal,
        discount: discountAmount,
        total,
        deliveryFee,
        tax: 0,
      },
    };

    if (cart.appliedCoupon) {
      response.appliedCoupon = {
        code: cart.appliedCoupon.code,
        discountType: cart.appliedCoupon.discountType,
        discountValue: parseFloat(cart.appliedCoupon.discountValue.toString()),
        description: cart.appliedCoupon.description,
        minPurchaseAmount: cart.appliedCoupon.minPurchaseAmount
          ? parseFloat(cart.appliedCoupon.minPurchaseAmount.toString())
          : null,
        maxDiscountAmount: cart.appliedCoupon.maxDiscountAmount
          ? parseFloat(cart.appliedCoupon.maxDiscountAmount.toString())
          : null,
      };
    }

    res.json(response);
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({
      message: "Failed to fetch cart",
      error: process.env.NODE_ENV === "development" ? error.message : null,
    });
  }
});

app.put("/cart/item/:itemId", authenticateUser, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: "Quantity must be at least 1" });
    }

    const cartItem = await prisma.cartItem.findUnique({
      where: { id: Number(itemId) },
      include: { cart: true },
    });

    if (!cartItem || cartItem.cart.userId !== req.user.id) {
      return res.status(404).json({ message: "Cart item not found" });
    }

    await prisma.cartItem.update({
      where: { id: Number(itemId) },
      data: { quantity: Number(quantity) },
    });

    res.status(200).json({ message: "Cart item updated" });
  } catch (error) {
    console.error("Error updating cart item:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// In your cart item update endpoint
app.put("/cart/item/:itemId", authenticateUser, async (req, res) => {
  try {
    const { quantity } = req.body;
    const itemId = parseInt(req.params.itemId);

    // Get the cart item with product details
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: {
        product: true,
        cart: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!cartItem) {
      return res.status(404).json({ message: "Cart item not found" });
    }

    if (cartItem.cart.user.id !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (quantity > cartItem.product.stock) {
      return res.status(400).json({
        message: `Only ${cartItem.product.stock} items available in stock`,
      });
    }

    const updatedItem = await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });

    res.json(updatedItem);
  } catch (error) {
    console.error("Error updating cart item:", error);
    res.status(500).json({ message: "Failed to update cart item" });
  }
});

app.delete("/cart/item/:itemId", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;

    if (!itemId) {
      return res.status(400).json({ message: "Item ID is required" });
    }

    const cart = await prisma.cart.findFirst({
      where: { userId },
    });

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    // Find the cart item
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: parseInt(itemId),
        cartId: cart.id,
      },
    });

    if (!cartItem) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    // Remove item from cart
    await prisma.cartItem.delete({
      where: { id: parseInt(itemId) },
    });

    // Recalculate discounts if a coupon is applied
    if (cart.couponId) {
      await recalculateCartDiscount(cart.id);
    }

    res.json({ message: "Item removed from cart" });
  } catch (error) {
    console.error("Error removing item from cart:", error);
    res.status(500).json({ message: "Failed to remove item from cart" });
  }
});

app.delete("/cart", authenticateUser, async (req, res) => {
  try {
    const cart = await prisma.cart.findUnique({
      where: { userId: req.user.id },
    });

    if (cart) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      });
    }

    res.status(200).json({ message: "Cart cleared" });
  } catch (error) {
    console.error("Error clearing cart:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/coupons/eligible", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const cartTotal = parseFloat(req.query.cartTotal || 0);

    const currentDate = new Date();

    const coupons = await prisma.coupon.findMany({
      where: {
        isActive: true,
        startDate: { lte: currentDate },
        endDate: { gte: currentDate },
        OR: [
          { applicableUserIds: { has: userId } },
          { applicableUserIds: { isEmpty: true } },
        ],
      },
    });

    const eligibleCoupons = [];

    for (const coupon of coupons) {
      // Check usage limit
      if (
        coupon.usageLimit !== null &&
        coupon.usageCount >= coupon.usageLimit
      ) {
        continue; // Skip this coupon
      }

      if (coupon.perUserLimit) {
        const userUsageCount = await prisma.couponUsage.count({
          where: {
            couponId: coupon.id,
            userId: userId,
          },
        });

        if (userUsageCount >= coupon.perUserLimit) {
          continue;
        }
      }

      eligibleCoupons.push({
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: parseFloat(coupon.discountValue),
        minPurchase: parseFloat(coupon.minPurchaseAmount || 0),
        maxDiscountAmount: coupon.maxDiscountAmount
          ? parseFloat(coupon.maxDiscountAmount)
          : null,
        expiryDate: coupon.endDate,
      });
    }

    res.json(eligibleCoupons);
  } catch (error) {
    console.error("Error fetching eligible coupons:", error);
    res.status(500).json({ message: "Failed to fetch eligible coupons" });
  }
});

app.get("/cart/coupon", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's cart with coupon
    const cart = await prisma.cart.findFirst({
      where: { userId },
      include: {
        appliedCoupon: true,
      },
    });

    if (!cart || !cart.couponId) {
      return res.status(404).json({ message: "No coupon applied to cart" });
    }

    const couponResponse = {
      id: cart.coupon.id,
      code: cart.coupon.code,
      description: cart.coupon.description,
      discountType: cart.coupon.discountType,
      discountValue: parseFloat(cart.coupon.discountValue),
      maxDiscountAmount: cart.coupon.maxDiscountAmount
        ? parseFloat(cart.coupon.maxDiscountAmount)
        : null,
    };

    // In the backend coupon application route
    res.json({
      message: "Coupon applied successfully",
      coupon: couponResponse,
      discountAmount,
      summary: calculateCartSummary(cart.items, couponResponse), // Return full summary
    });
  } catch (error) {
    console.error("Error fetching applied coupon:", error);
    res.status(500).json({ message: "Failed to fetch applied coupon" });
  }
});

app.post("/cart/coupon", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ message: "Coupon code is required" });
    }

    // Find the coupon
    const coupon = await prisma.coupon.findUnique({
      where: { code },
    });

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    // Verify coupon is active and valid date range
    const currentDate = new Date();
    if (
      !coupon.isActive ||
      coupon.startDate > currentDate ||
      coupon.endDate < currentDate
    ) {
      return res
        .status(400)
        .json({ message: "This coupon is not valid at this time" });
    }

    // Check if coupon has reached usage limit
    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      return res
        .status(400)
        .json({ message: "This coupon has reached its usage limit" });
    }

    // Check if user is eligible
    if (
      coupon.applicableUserIds.length > 0 &&
      !coupon.applicableUserIds.includes(userId)
    ) {
      return res
        .status(400)
        .json({ message: "This coupon is not applicable for your account" });
    }

    // Check if user has reached their personal usage limit
    if (coupon.perUserLimit !== null) {
      const userUsageCount = await prisma.couponUsage.count({
        where: {
          couponId: coupon.id,
          userId,
        },
      });

      if (userUsageCount >= coupon.perUserLimit) {
        return res.status(400).json({
          message:
            "You have already used this coupon the maximum number of times",
        });
      }
    }

    // Get user's cart
    const cart = await prisma.cart.findFirst({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Your cart is empty" });
    }

    // Calculate cart subtotal
    const subtotal = cart.items.reduce((total, item) => {
      const price = item.product.discountedPrice || item.product.price;
      return total + parseFloat(price) * item.quantity;
    }, 0);

    // Check minimum purchase amount
    if (
      coupon.minPurchaseAmount &&
      subtotal < parseFloat(coupon.minPurchaseAmount)
    ) {
      return res.status(400).json({
        message: `Minimum purchase amount of ₹${parseFloat(
          coupon.minPurchaseAmount
        ).toFixed(2)} required for this coupon`,
      });
    }

    // Check product and category eligibility if specified
    if (
      coupon.applicableProductIds.length > 0 ||
      coupon.applicableCategories.length > 0
    ) {
      const isEligible = cart.items.some((item) => {
        const productEligible =
          coupon.applicableProductIds.length === 0 ||
          coupon.applicableProductIds.includes(item.product.id);

        const categoryEligible =
          coupon.applicableCategories.length === 0 ||
          coupon.applicableCategories.some((category) =>
            item.product.categories.includes(category)
          );

        return productEligible || categoryEligible;
      });

      if (!isEligible) {
        return res.status(400).json({
          message: "This coupon is not applicable for the items in your cart",
        });
      }
    }

    // Calculate discount amount
    let discountAmount = 0;

    if (coupon.discountType === "PERCENTAGE") {
      discountAmount = subtotal * (parseFloat(coupon.discountValue) / 100);

      // Apply max discount cap if exists
      if (coupon.maxDiscountAmount) {
        discountAmount = Math.min(
          discountAmount,
          parseFloat(coupon.maxDiscountAmount)
        );
      }
    } else {
      // FIXED discount
      discountAmount = parseFloat(coupon.discountValue);

      // Ensure discount doesn't exceed cart total
      discountAmount = Math.min(discountAmount, subtotal);
    }

    // Update cart with coupon
    await prisma.cart.update({
      where: { id: cart.id },
      data: {
        appliedCouponId: coupon.id,
        discountAmount,
      },
    });

    // Format response
    const couponResponse = {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: parseFloat(coupon.discountValue),
      maxDiscountAmount: coupon.maxDiscountAmount
        ? parseFloat(coupon.maxDiscountAmount)
        : null,
    };

    res.json({
      message: "Coupon applied successfully",
      coupon: couponResponse,
      discountAmount,
    });
  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({ message: "Failed to apply coupon" });
  }
});

function calculateCartSummary(items, appliedCoupon) {
  const subtotal = items.reduce((sum, item) => {
    const itemPrice = Number(item.flashSalePrice || item.product.price);
    return sum + itemPrice * item.quantity;
  }, 0);

  let discount = 0;

  if (appliedCoupon) {
    if (appliedCoupon.discountType === "PERCENTAGE") {
      discount = (subtotal * Number(appliedCoupon.discountValue)) / 100;

      // Apply max discount cap if exists
      if (appliedCoupon.maxDiscountAmount) {
        discount = Math.min(discount, Number(appliedCoupon.maxDiscountAmount));
      }
    } else {
      discount = Number(appliedCoupon.discountValue);
    }
  }

  const total = Math.max(subtotal - discount, 0);

  const tax = 0;

  const deliveryFee = 0;
  return {
    subtotal,
    discount,
    total,
    deliveryFee,
    tax,
  };
}

app.delete("/cart/coupon", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's cart
    const cart = await prisma.cart.findFirst({
      where: { userId },
    });

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    // Check if cart has a coupon
    if (!cart.appliedCouponId) {
      return res.status(400).json({ message: "No coupon applied to remove" });
    }

    // Update cart to remove coupon
    await prisma.cart.update({
      where: { id: cart.id },
      data: {
        appliedCouponId: null,
        discountAmount: 0,
      },
    });

    res.json({ message: "Coupon removed successfully" });
  } catch (error) {
    console.error("Error removing coupon:", error);
    res.status(500).json({ message: "Failed to remove coupon" });
  }
});

// Assuming this is the endpoint for adding items to the wishlist
app.post("/wishlist/add", authenticateUser, async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user.id;

    if (!productId) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    // Check if the product exists
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Get or create user's wishlist
    let wishlist = await prisma.wishlist.findUnique({
      where: { userId },
    });

    if (!wishlist) {
      wishlist = await prisma.wishlist.create({
        data: {
          userId,
          updatedAt: new Date(), // Ensure updatedAt is set correctly
        },
      });
    }

    // Check if product already in wishlist
    const existingItem = await prisma.wishlistItem.findUnique({
      where: {
        wishlistId_productId: {
          wishlistId: wishlist.id,
          productId: parseInt(productId),
        },
      },
    });

    if (existingItem) {
      return res.json({
        success: true,
        message: "Product already in wishlist",
        wishlistId: wishlist.id,
      });
    }

    // Add to wishlist
    await prisma.wishlistItem.create({
      data: {
        wishlistId: wishlist.id,
        productId: parseInt(productId),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Update the wishlist's updatedAt timestamp
    await prisma.wishlist.update({
      where: { id: wishlist.id },
      data: { updatedAt: new Date() },
    });

    res.json({
      success: true,
      message: "Product added to wishlist",
      wishlistId: wishlist.id,
    });
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    res.status(500).json({ error: "Failed to add to wishlist" });
  }
});

// Endpoint to get the wishlist items
app.get("/wishlist", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;

    const wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
          },
        },
      },
    });

    if (!wishlist) {
      return res.json({ items: [] });
    }

    res.json({
      items: wishlist.items,
      wishlistId: wishlist.id,
    });
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    res.status(500).json({ error: "Failed to fetch wishlist" });
  }
});

app.get("/wishlist/check/:id", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const productId = parseInt(req.params.id);

    const wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      include: {
        items: {
          where: {
            productId: productId,
          },
        },
      },
    });

    const isInWishlist = wishlist && wishlist.items.length > 0;

    return res.json({
      isInWishlist: isInWishlist,
    });
  } catch (err) {
    console.error("Error checking wishlist status:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

app.get("/wishlist/items", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;

    const wishlistItems = await prisma.wishlist.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
          },
        },
      },
    });

    return res.json(wishlistItems);
  } catch (err) {
    console.error("Error fetching wishlist items:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

app.delete("/wishlist/remove", authenticateUser, async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user.id;

    if (!productId) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    const wishlist = await prisma.wishlist.findUnique({
      where: { userId },
    });

    if (!wishlist) {
      return res.status(404).json({ error: "Wishlist not found" });
    }

    await prisma.wishlistItem.deleteMany({
      where: {
        wishlistId: wishlist.id,
        productId: parseInt(productId),
      },
    });

    // Update the wishlist's updatedAt timestamp
    await prisma.wishlist.update({
      where: { id: wishlist.id },
      data: { updatedAt: new Date() },
    });

    res.json({ success: true, message: "Product removed from wishlist" });
  } catch (error) {
    console.error("Error removing from wishlist:", error);
    res.status(500).json({ error: "Failed to remove from wishlist" });
  }
});

app.get("/user/addresses", authenticateUser, async (req, res) => {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user.id },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });

    res.status(200).json(addresses);
  } catch (error) {
    console.error("Error fetching addresses:", error);
    res.status(500).json({ message: "Failed to fetch addresses" });
  }
});

app.post("/user/addresses", authenticateUser, async (req, res) => {
  try {
    const {
      name,
      line1,
      line2,
      city,
      state,
      postalCode,
      country,
      phone,
      isDefault,
    } = req.body;

    if (!name || !line1 || !city || !state || !postalCode || !phone) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const result = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.address.updateMany({
          where: {
            userId: req.user.id,
            isDefault: true,
          },
          data: { isDefault: false },
        });
      }

      const addressCount = await tx.address.count({
        where: { userId: req.user.id },
      });

      return tx.address.create({
        data: {
          userId: req.user.id,
          name,
          line1,
          line2: line2 || "",
          city,
          state,
          postalCode,
          country: country || "India",
          phone,
          isDefault: isDefault || addressCount === 0,
        },
      });
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating address:", error);
    res.status(500).json({ message: "Failed to create address" });
  }
});

app.post("/create-order", authenticateUser, async (req, res) => {
  try {
    const {
      amount,
      currency = "INR",
      receipt,
      useWallet,
      walletAmount = 0,
      addressId,
      shippingAddress,
      notes,
      cartItems, // Added to capture customization details
      deliveryFee,
    } = req.body;

    if (!amount || !receipt) {
      return res
        .status(400)
        .json({ message: "Amount and receipt are required" });
    }

    let address;

    if (addressId) {
      address = await prisma.address.findUnique({
        where: {
          id: parseInt(addressId),
          userId: req.user.id,
        },
      });

      if (!address) {
        return res.status(400).json({ message: "Invalid address selected" });
      }
    } else if (shippingAddress) {
      address = shippingAddress;
    } else {
      return res
        .status(400)
        .json({ message: "Address information is required" });
    }

    if (useWallet) {
      const wallet = await prisma.wallet.findUnique({
        where: { userId: req.user.id },
      });

      if (!wallet || wallet.balance < walletAmount) {
        return res.status(400).json({
          message: "Insufficient wallet balance",
        });
      }
    }

    const razorpayNotes = {
      shipping_address: JSON.stringify({
        name: address.name,
        line1: address.line1,
        line2: address.line2 || "",
        city: address.city,
        state: address.state,
        postal_code: address.postalCode || address.postal_code || address.zip,
        country: address.country,
        phone: address.phone,
      }),
    };

    // Add customization details to Razorpay notes if available
    if (cartItems && cartItems.length > 0) {
      // Ensure we handle the customizationImageUrls as arrays
      const processedCartItems = cartItems.map((item) => {
        const processed = { ...item };

        // Ensure customizationImageUrls is always an array
        if (!processed.customizationImageUrls) {
          processed.customizationImageUrls = [];

          // For backward compatibility - convert single URL to array if provided
          if (processed.customizationImageUrl) {
            processed.customizationImageUrls.push(
              processed.customizationImageUrl
            );
          }
        }

        // Extract image URLs from customizationDetails if available
        if (processed.customizationDetails) {
          let details = processed.customizationDetails;

          // Parse if it's a string
          if (typeof details === "string") {
            try {
              details = JSON.parse(details);
            } catch (e) {
              console.error("Error parsing customization details:", e);
            }
          }

          // Extract image URLs from various potential structures
          if (typeof details === "object") {
            // Check for direct imageUrl property
            if (details.imageUrl) {
              processed.customizationImageUrls.push(details.imageUrl);
            }

            // Check for uploadedImage property
            if (details.uploadedImage) {
              processed.customizationImageUrls.push(details.uploadedImage);
            }

            // Check for uploads array
            if (details.uploads && Array.isArray(details.uploads)) {
              details.uploads.forEach((upload) => {
                if (upload.imageUrl) {
                  processed.customizationImageUrls.push(upload.imageUrl);
                }
              });
            }

            // Check for masks array
            if (details.masks && Array.isArray(details.masks)) {
              details.masks.forEach((mask) => {
                if (mask.imageUrl) {
                  processed.customizationImageUrls.push(mask.imageUrl);
                }
                if (mask.upload && mask.upload.imageUrl) {
                  processed.customizationImageUrls.push(mask.upload.imageUrl);
                }
              });
            }
          }
        }

        // Remove duplicates from customizationImageUrls
        processed.customizationImageUrls = [
          ...new Set(processed.customizationImageUrls),
        ];

        return processed;
      });

      razorpayNotes.customization_details = JSON.stringify(processedCartItems);
    }

    if (notes && typeof notes === "object" && notes.custom_notes) {
      razorpayNotes.custom_notes = notes.custom_notes;
    } else if (typeof notes === "string") {
      razorpayNotes.custom_notes = notes;
    }

    const options = {
      amount: amount * 100,
      currency: currency,
      receipt: receipt,
      payment_capture: 1,
      notes: razorpayNotes,
    };

    const razorpayOrder = await razorpay.orders.create(options);

    // Process customization details for storing in the database
    const customizationMetadata =
      cartItems && cartItems.length > 0
        ? JSON.stringify(razorpayNotes.customization_details)
        : null;

    const notesForPrisma =
      typeof notes === "object" ? JSON.stringify(notes) : notes || null;

    const order = await prisma.order.create({
      data: {
        userId: req.user.id,
        razorpayOrderId: razorpayOrder.id,
        amount: amount,
        status: "INITIATED",
        currency: currency,
        useWallet: useWallet || false,
        walletAmount: walletAmount || 0,
        deliveryFee: deliveryFee,
        notes: notesForPrisma,
        customizationDetails: customizationMetadata, // Store customization details
        shippingAddress: {
          create: {
            name: address.name,
            line1: address.line1,
            line2: address.line2 || "",
            city: address.city,
            state: address.state,
            postalCode:
              address.postalCode || address.postal_code || address.zip,
            country: address.country,
            phone: address.phone,
          },
        },
      },
    });

    res.status(200).json({
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      orderId: order.id,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ message: "Failed to create order" });
  }
});

app.post("/verify-payment", authenticateUser, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      useWallet,
      walletAmount = 0,
      customizationDetails, // Added to capture customization details
    } = req.body;

    // Validate input
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        status: "error",
        message: "Missing payment details",
      });
    }

    // Verify signature
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({
        status: "error",
        message: "Invalid payment signature",
      });
    }

    const order = await prisma.order.findUnique({
      where: { razorpayOrderId: razorpay_order_id },
      include: { shippingAddress: true },
    });

    if (!order) {
      return res.status(404).json({
        status: "error",
        message: "Order not found",
      });
    }

    if (useWallet && walletAmount > 0) {
      const wallet = await prisma.wallet.findUnique({
        where: { userId: req.user.id },
      });

      if (!wallet || wallet.balance < walletAmount) {
        return res.status(400).json({
          status: "error",
          message: "Insufficient wallet balance",
        });
      }

      await prisma.wallet.update({
        where: { userId: req.user.id },
        data: { balance: { decrement: walletAmount } },
      });

      await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          amount: walletAmount,
          type: "debit",
          description: `Order payment: ${order.id}`,
        },
      });
    }

    await prisma.order.update({
      where: { razorpayOrderId: razorpay_order_id },
      data: {
        status: "PAID",
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      },
    });

    const cart = await prisma.cart.findUnique({
      where: { userId: req.user.id },
      include: { items: { include: { product: true } } },
    });

    if (cart && cart.items.length > 0) {
      // Retrieve customization details for each cart item
      for (const item of cart.items) {
        // Find matching customization details from the submitted data
        let customizationImageUrls = [];
        let itemCustomizationDetails = null;

        if (customizationDetails && Array.isArray(customizationDetails)) {
          const matchingCustomization = customizationDetails.find(
            (custom) =>
              custom.itemId === item.id || custom.productId === item.productId
          );

          if (matchingCustomization) {
            // Handle customizationImageUrls as array
            if (
              matchingCustomization.customizationImageUrls &&
              Array.isArray(matchingCustomization.customizationImageUrls)
            ) {
              customizationImageUrls =
                matchingCustomization.customizationImageUrls;
            }
            // For backward compatibility - convert single URL to array if provided
            else if (matchingCustomization.customizationImageUrl) {
              customizationImageUrls = [
                matchingCustomization.customizationImageUrl,
              ];
            }

            // Handle customization details
            itemCustomizationDetails =
              matchingCustomization.customizationDetails;
          }
        }

        // Create order item with customization
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.product.discountedPrice || item.product.price,
            customizationImageUrl: customizationImageUrls, // Now using the array
            customizationDetails: itemCustomizationDetails
              ? typeof itemCustomizationDetails === "object"
                ? JSON.stringify(itemCustomizationDetails)
                : itemCustomizationDetails
              : null,
          },
        });
      }

      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      });
    }

    res.status(200).json({
      status: "success",
      message: "Payment verified successfully",
      orderId: order.id,
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({
      status: "error",
      message: "Payment verification failed",
    });
  }
});

app.get("/orders", authenticateUser, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: {
        orderItems: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const transformedOrders = orders.map((order) => ({
      ...order,
      summary: {
        total: order.orderItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        ),
        deliveryFee: order.deliveryFee ? Number(order.deliveryFee) : 0,
        tax: order.orderItems.reduce(
          (sum, item) => sum + item.price * item.quantity * 0.1,
          0
        ),
      },
    }));

    res.status(200).json(transformedOrders);
  } catch (error) {
    console.error("Error fetching order history:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch order history", error: error.message });
  }
});

app.get("/order/:orderId", authenticateUser, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: {
        id: parseInt(orderId),
        userId: req.user.id,
      },
      include: {
        orderItems: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Parse customizationDetails from string to object in both order and items
    const parsedOrder = {
      ...order,
      customizationDetails: parseJSONSafe(order.customizationDetails),
      orderItems: order.orderItems.map((item) => ({
        ...item,
        customizationDetails: parseJSONSafe(item.customizationDetails),
      })),
    };

    // Summary Calculation
    const total = parsedOrder.orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const deliveryFee = parsedOrder.deliveryFee
      ? Number(parsedOrder.deliveryFee)
      : 0;
    const tax = total * 0; // 10% GST

    const summary = {
      total,
      deliveryFee,
      tax,
    };

    res.status(200).json({ ...parsedOrder, summary });
  } catch (error) {
    console.error("Error fetching order details:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch order details", error: error.message });
  }
});

// Helper to safely parse JSON strings
function parseJSONSafe(input) {
  try {
    return typeof input === "string" ? JSON.parse(input) : input;
  } catch {
    return input; // fallback to original if not parsable
  }
}

app.get("/orders/latest", authenticateUser, async (req, res) => {
  try {
    const latestOrder = await prisma.order.findFirst({
      where: {
        userId: req.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        orderItems: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
          },
        },
        shippingAddress: true,
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!latestOrder) {
      return res.status(404).json({
        message: "No orders found for this user",
      });
    }
    console.log(latestOrder);

    const subtotal = latestOrder.orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const tax = subtotal * 0;
    const deliveryFee = latestOrder.deliveryFee
      ? Number(latestOrder.deliveryFee)
      : 0;
    const total =
      subtotal + tax + deliveryFee - (latestOrder.walletAmount || 0);

    const response = {
      id: latestOrder.id,
      orderNumber: `ORD-${latestOrder.id.toString().padStart(6, "0")}`,
      createdAt: latestOrder.createdAt,
      paymentMethod: latestOrder.razorpayPaymentId
        ? "Online Payment"
        : "Wallet",
      status: latestOrder.status,
      discount: 0,
      walletAmountUsed: latestOrder.walletAmount || 0,
      subtotal: parseFloat(subtotal.toFixed(2)),
      deliveryFee: parseFloat(deliveryFee.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      items: latestOrder.orderItems.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
        product: {
          id: item.product.id,
          name: item.product.name,
          image: item.product.images[0]?.mainImage || null,
        },
      })),
      shippingAddress: latestOrder.shippingAddress || {
        name: `${latestOrder.user.firstName} ${latestOrder.user.lastName}`,
        line1: "Not specified",
        line2: "Not specified",
        city: "Not specified",
        state: "Not specified",
        postalCode: "000000",
        country: "India",
        phone: "Not specified",
      },
      customer: {
        email: latestOrder.user.email,
        name: `${latestOrder.user.firstName} ${latestOrder.user.lastName}`,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching latest order:", error);
    res.status(500).json({
      message: "Failed to fetch latest order",
      error: error.message,
    });
  }
});

app.post("/wallet/create-order", authenticateUser, async (req, res) => {
  const { useWallet, walletAmount, shippingAddress, notes, deliveryFee } =
    orderData;

  try {
    return await prisma.$transaction(async (prisma) => {
      // Get user's cart with items
      const cart = await prisma.cart.findFirst({
        where: { userId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          coupon: true,
        },
      });

      if (!cart || cart.items.length === 0) {
        throw new Error("Cart is empty");
      }

      let subtotal = 0;
      const orderItems = cart.items.map((item) => {
        const price = item.product.discountedPrice || item.product.price;
        const itemTotal = parseFloat(price) * item.quantity;
        subtotal += itemTotal;

        return {
          productId: item.productId,
          quantity: item.quantity,
          price: parseFloat(price),
          total: itemTotal,
        };
      });

      const discountAmount = parseFloat(cart.discountAmount || 0);
      const taxRate = 0;
      const taxAmount = (subtotal - discountAmount) * taxRate;

      const totalBeforeWallet =
        subtotal - discountAmount + deliveryFee + taxAmount;

      let walletApplied = 0;
      if (useWallet && walletAmount > 0) {
        const wallet = await prisma.wallet.findUnique({
          where: { userId },
        });

        if (wallet) {
          walletApplied = Math.min(
            parseFloat(wallet.balance),
            parseFloat(walletAmount),
            totalBeforeWallet
          );

          if (walletApplied > 0) {
            await prisma.wallet.update({
              where: { userId },
              data: {
                balance: {
                  decrement: walletApplied,
                },
              },
            });

            // Create wallet transaction record
            await prisma.walletTransaction.create({
              data: {
                userId,
                amount: -walletApplied,
                type: "PURCHASE",
                description: "Used for order payment",
                status: "COMPLETED",
              },
            });
          }
        }
      }

      const finalAmount = Math.max(totalBeforeWallet - walletApplied, 0);

      const razorpayOrder = await razorpay.createOrder({
        amount: finalAmount,
        currency: "INR",
        receipt: `order_${Date.now()}`,
      });

      const order = await prisma.order.create({
        data: {
          userId,
          razorpayOrderId: razorpayOrder.id,
          subtotal,
          discount: discountAmount,
          tax: taxAmount,
          deliveryFee: deliveryFee,
          walletAmount: walletApplied,
          total: finalAmount,
          couponId: cart.couponId,
          status: "PENDING",
          paymentStatus: "PENDING",
          shippingAddress: {
            create: {
              name: shippingAddress.name,
              line1: shippingAddress.line1,
              line2: shippingAddress.line2,
              city: shippingAddress.city,
              state: shippingAddress.state,
              postalCode: shippingAddress.postalCode,
              country: shippingAddress.country,
              phone: shippingAddress.phone,
            },
          },
          items: {
            create: orderItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              total: item.total,
            })),
          },
          notes,
        },
      });

      // If a coupon was used, record its usage (but don't increment coupon.usageCount yet)
      if (cart.couponId) {
        await prisma.couponUsage.create({
          data: {
            couponId: cart.couponId,
            userId,
            orderId: order.id,
          },
        });
      }

      // Return order info with Razorpay details
      return {
        id: razorpayOrder.id,
        amount: finalAmount,
        currency: razorpayOrder.currency,
        orderId: order.id,
      };
    });
  } catch (error) {
    console.error("Error creating order:", error);
    throw error;
  }
});

// Verify Razorpay payment for wallet top-up
app.post("/wallet/verify-payment", authenticateUser, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    // Validate input
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        status: "error",
        message: "Missing payment details",
      });
    }

    // Verify signature
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    // Check if signatures match
    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({
        status: "error",
        message: "Invalid payment signature",
      });
    }

    // Find the corresponding wallet order
    const walletOrder = await prisma.walletOrder.findUnique({
      where: { razorpayOrderId: razorpay_order_id },
    });

    if (!walletOrder) {
      return res.status(404).json({
        status: "error",
        message: "Wallet order not found",
      });
    }

    // Find or create wallet
    let wallet = await prisma.wallet.findUnique({
      where: { userId: req.user.id },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId: req.user.id,
          balance: 0,
        },
      });
    }

    // Update wallet balance
    const updatedWallet = await prisma.wallet.update({
      where: { userId: req.user.id },
      data: {
        balance: { increment: walletOrder.amount },
      },
    });

    // Create transaction record
    await prisma.transaction.create({
      data: {
        walletId: updatedWallet.id,
        amount: walletOrder.amount,
        type: "credit",
        description: "Razorpay Wallet Top-up",
      },
    });

    // Update wallet order status
    await prisma.walletOrder.update({
      where: { razorpayOrderId: razorpay_order_id },
      data: {
        status: "PAID",
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      },
    });

    res.status(200).json({
      status: "success",
      message: "Wallet top-up successful",
      newBalance: updatedWallet.balance,
    });
  } catch (error) {
    console.error("Error verifying wallet top-up payment:", error);
    res.status(500).json({
      status: "error",
      message: "Wallet top-up payment verification failed",
    });
  }
});

app.get("/wallet/balance", authenticateUser, async (req, res) => {
  try {
    let wallet = await prisma.wallet.findUnique({
      where: { userId: req.user.id },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 10, // Limit to 10 most recent transactions
        },
      },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId: req.user.id,
          balance: 0,
        },
        include: { transactions: true },
      });

      return res.status(200).json({
        balance: wallet.balance,
        transactions: [],
      });
    }

    res.status(200).json({
      balance: wallet.balance,
      transactions: wallet.transactions.map((transaction) => ({
        id: transaction.id,
        amount: transaction.amount,
        type: transaction.type,
        description: transaction.description,
        createdAt: transaction.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    res.status(500).json({ message: "Failed to fetch wallet balance" });
  }
});

// Add money to wallet
app.post("/wallet/add-money", authenticateUser, async (req, res) => {
  try {
    const { amount } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    // Find or create wallet
    let wallet = await prisma.wallet.findUnique({
      where: { userId: req.user.id },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId: req.user.id,
          balance: 0,
        },
      });
    }

    // Update wallet balance
    const updatedWallet = await prisma.wallet.update({
      where: { userId: req.user.id },
      data: {
        balance: { increment: amount },
      },
    });

    // Create transaction record
    await prisma.transaction.create({
      data: {
        walletId: updatedWallet.id,
        amount: amount,
        type: "credit",
        description: "Manual Wallet Topup",
      },
    });

    res.status(200).json({
      message: "Money added successfully",
      newBalance: updatedWallet.balance,
    });
  } catch (error) {
    console.error("Error adding money to wallet:", error);
    res.status(500).json({ message: "Failed to add money to wallet" });
  }
});

app.get("/wallet/transactions", authenticateUser, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user.id },
    });

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.transaction.count({
        where: { walletId: wallet.id },
      }),
    ]);

    res.status(200).json({
      transactions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalTransactions: total,
      },
    });
  } catch (error) {
    console.error("Error fetching wallet transactions:", error);
    res.status(500).json({ message: "Failed to fetch wallet transactions" });
  }
});

app.get(
  "/products/:productId/templates",
  authenticateUser,
  async (req, res) => {
    try {
      const { productId } = req.params;

      // Get templates for the product
      const templates = await prisma.customizationTemplate.findMany({
        where: {
          productId: Number(productId),
          isActive: true,
        },
        include: {
          customizableAreas: {
            orderBy: { orderIndex: "asc" },
          },
        },
        orderBy: { orderIndex: "asc" },
      });

      // Format the templates for frontend consumption
      const formattedTemplates = templates.map((template) => ({
        id: template.id,
        name: template.name,
        svgData: template.svgData,
        thumbnailUrl: template.thumbnailUrl,
        customizableAreas: template.customizableAreas.map((area) => ({
          id: area.id,
          name: area.name || `Area ${area.orderIndex + 1}`,
          description: area.description,
          shape: area.shape,
          centerX: area.centerX,
          centerY: area.centerY,
          width: area.width,
          height: area.height,
          radius: area.radius,
          allowedFormats: area.allowedFormats,
          maxFileSizeMB: area.maxFileSizeMB,
        })),
      }));

      return res.json(formattedTemplates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

// Get a specific template with areas
app.get("/templates/:templateId", async (req, res) => {
  try {
    const template = await prisma.customizationTemplate.findUnique({
      where: { id: parseInt(req.params.templateId) },
      include: { customizableAreas: true },
    });
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: "Error fetching template" });
  }
});

app.post(
  "/upload/custom-image",
  authenticateUser,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const { productId, templateId, areaId, width, height, shape } = req.body;
      const userId = req.user.id;

      // Process image according to shape (this is a placeholder for your image processing logic)
      // You would implement actual image processing based on shape here
      const processedImagePath = await processImageByShape(
        req.file.path,
        shape,
        Number(width),
        Number(height)
      );

      // Upload both original and processed images to storage (e.g., S3, cloudinary)
      const originalImageUrl = await uploadToStorage(req.file.path);
      const processedImageUrl = await uploadToStorage(processedImagePath);

      // Create a custom upload record
      const customUpload = await prisma.customUpload.create({
        data: {
          productId: Number(productId),
          userId,
          templateId: Number(templateId),
          areaId: areaId ? Number(areaId) : undefined,
          imageUrl: processedImageUrl,
          originalImageUrl,
          width: Number(width),
          height: Number(height),
          shape,
          // Default values for these properties
          scale: 1.0,
          rotation: 0.0,
          positionX: 0.0,
          positionY: 0.0,
        },
      });

      // Clean up temporary files
      await fs.unlink(req.file.path);
      await fs.unlink(processedImagePath);

      return res.status(201).json(customUpload);
    } catch (error) {
      console.error("Upload error:", error);
      return res.status(500).json({ message: "Error uploading image" });
    }
  }
);

// Associate custom uploads with cart item
app.post(
  "/cart/:cartId/items/:itemId/link-uploads",
  authenticateUser,
  async (req, res) => {
    try {
      const { uploadIds } = req.body;

      await prisma.customUpload.updateMany({
        where: { id: { in: uploadIds }, userId: req.user.id },
        data: { cartItemId: parseInt(req.params.itemId) },
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

app.get("/products/:productId/customized-preview", async (req, res) => {
  try {
    const { productId } = req.params;

    // Get product details
    const product = await prisma.product.findUnique({
      where: { id: Number(productId) },
      include: {
        images: true,
      },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Get SVG data from product images
    let svgData = null;
    if (product.images && product.images.length > 0) {
      svgData = product.images[0].mainImage;
    }

    return res.json({
      id: product.id,
      name: product.name,
      svgData: svgData,
      isCustomizable: product.isCustomizable,
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Upload custom image
app.post("/upload/custom-image", authenticateUser, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const { productId, templateId, areaId, width, height, shape } = req.body;
    const userId = req.user.id;

    // Process image according to shape
    const processedImagePath = await processImageByShape(
      req.file.path,
      shape,
      Number(width),
      Number(height)
    );

    // Upload both original and processed images to storage
    const originalImageUrl = await uploadToStorage(req.file.path);
    const processedImageUrl = await uploadToStorage(processedImagePath);

    // Create a custom upload record
    const customUpload = await prisma.customUpload.create({
      data: {
        productId: Number(productId),
        userId,
        templateId: Number(templateId),
        areaId: areaId ? Number(areaId) : undefined,
        imageUrl: processedImageUrl,
        originalImageUrl,
        width: Number(width),
        height: Number(height),
        shape,
        scale: 1.0,
        rotation: 0.0,
        positionX: 0.0,
        positionY: 0.0,
      },
    });

    // Clean up temporary files
    await fs.unlink(req.file.path);
    await fs.unlink(processedImagePath);

    return res.status(201).json(customUpload);
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ message: "Error uploading image" });
  }
});
app.post("/cart/add-customized", authenticateUser, async (req, res) => {
  try {
    const { productId, customTemplateId } = req.body;
    const userId = req.user.id;

    // Get product information
    const product = await prisma.product.findUnique({
      where: { id: Number(productId) },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Verify the template exists for this product
    const template = await prisma.customizationTemplate.findFirst({
      where: {
        id: Number(customTemplateId),
        productId: Number(productId),
      },
    });

    if (!template) {
      return res
        .status(404)
        .json({ message: "Template not found for this product" });
    }

    // Find or create user cart
    let cart = await prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
      });
    }

    // Check if item already exists in cart with the same template
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: Number(productId),
        customTemplateId: Number(customTemplateId),
      },
    });

    let cartItem;

    if (existingItem) {
      // Update existing item quantity
      cartItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + 1 },
      });
    } else {
      // Create new cart item with customization template
      cartItem = await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: Number(productId),
          customTemplateId: Number(customTemplateId),
          customizationDetails: {}, // Will be populated with linked uploads
          customizationImageUrls: [], // Will be populated with image URLs
        },
      });
    }

    return res.status(201).json(cartItem);
  } catch (error) {
    console.error("Error adding to cart:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Add a new endpoint to link custom uploads to a cart item
app.post(
  "/cart/:cartItemId/link-uploads",
  authenticateUser,
  async (req, res) => {
    try {
      const { cartItemId } = req.params;
      const { uploadIds } = req.body;
      const userId = req.user.id;

      if (!uploadIds || !Array.isArray(uploadIds) || uploadIds.length === 0) {
        return res.status(400).json({ message: "Upload IDs are required" });
      }

      // Find the cart item
      const cartItem = await prisma.cartItem.findFirst({
        where: {
          id: Number(cartItemId),
        },
        include: {
          cart: true,
        },
      });

      if (!cartItem) {
        return res.status(404).json({ message: "Cart item not found" });
      }

      // Verify the cart belongs to the user
      if (cartItem.cart.userId !== userId) {
        return res
          .status(403)
          .json({ message: "Not authorized to modify this cart" });
      }

      // Get all the custom uploads
      const customUploads = await prisma.customUpload.findMany({
        where: {
          id: { in: uploadIds.map((id) => Number(id)) },
          userId: userId,
          productId: cartItem.productId,
          templateId: cartItem.customTemplateId,
        },
        include: {
          area: true,
        },
      });

      if (customUploads.length === 0) {
        return res.status(404).json({ message: "No valid uploads found" });
      }

      const imageUrls = customUploads.map((upload) => upload.imageUrl);
      const customizationDetails = customUploads.map((upload) => ({
        uploadId: upload.id,
        areaId: upload.areaId,
        areaName: upload.area?.name || `Area ${upload.areaId}`,
        imageUrl: upload.imageUrl,
        shape: upload.shape,
        scale: upload.scale || 1.0,
        rotation: upload.rotation || 0,
        positionX: upload.positionX || 0,
        positionY: upload.positionY || 0,
      }));

      // Update the cart item with the custom image details
      const updatedCartItem = await prisma.cartItem.update({
        where: { id: Number(cartItemId) },
        data: {
          customizationImageUrls: imageUrls,
          customizationDetails: customizationDetails,
        },
      });

      return res.status(200).json(updatedCartItem);
    } catch (error) {
      console.error("Error linking uploads:", error);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

app.get(
  "/products/:productId/custom-uploads",
  authenticateUser,
  async (req, res) => {
    try {
      const { productId } = req.params;
      const userId = req.user.id;

      const uploads = await prisma.customUpload.findMany({
        where: {
          productId: Number(productId),
          userId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return res.json(uploads);
    } catch (error) {
      console.error("Error fetching custom uploads:", error);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

app.use("/testimonials", testimonialsapp);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
