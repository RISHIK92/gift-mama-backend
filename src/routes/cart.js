import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateUser } from "../../auth/middleware.js";

const router = express.Router();
const prisma = new PrismaClient();

router.post("/add", authenticateUser, async (req, res) => {
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

      // routerly max discount cap if exists
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

router.get("/", authenticateUser, async (req, res) => {
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

        // routerly max discount if specified
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

    // routerly any existing discount amount from cart as fallback
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

router.put("/item/:itemId", authenticateUser, async (req, res) => {
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
router.put("/item/:itemId", authenticateUser, async (req, res) => {
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

router.delete("/item/:itemId", authenticateUser, async (req, res) => {
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

router.delete("/", authenticateUser, async (req, res) => {
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

router.post(
  "/:cartId/items/:itemId/link-uploads",
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

router.post("/:cartItemId/link-uploads", authenticateUser, async (req, res) => {
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
});

router.post("/add-customized", authenticateUser, async (req, res) => {
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

router.get("/coupon", authenticateUser, async (req, res) => {
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

router.post("/coupon", authenticateUser, async (req, res) => {
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

router.delete("/coupon", authenticateUser, async (req, res) => {
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

export default router;
