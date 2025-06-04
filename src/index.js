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
import authRouter from "./routes/auth.js";
import cartRouter from "./routes/cart.js";
import wishlistRouter from "./routes/wishlist.js";
import walletRouter from "./routes/wallet.js";
import path from "path";
import sharp from "sharp";
import { processImageByShape } from "../utils/processImage.js";

dotenv.config();

const prisma = new PrismaClient();
const app = express();

app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL, // or your frontend URL
    credentials: true,
  })
);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

app.use("/", authRouter);
app.use("/testimonials", testimonialsapp);
app.use("/cart", cartRouter);
app.use("/wishlist", wishlistRouter);
app.use("/wallet", walletRouter);

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
      const imageUrl = `${process.env.CLOUDFRONT_URL}/${key}`;

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
      const imageUrl = `${process.env.CLOUDFRONT_URL}/custom-images/${filename}`;

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

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
