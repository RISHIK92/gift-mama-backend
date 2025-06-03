import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateUser } from "../../auth/middleware.js";

const router = express.Router();
const prisma = new PrismaClient();

router.post("/add", authenticateUser, async (req, res) => {
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
router.get("/", authenticateUser, async (req, res) => {
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

router.get("/check/:id", authenticateUser, async (req, res) => {
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

router.get("/items", authenticateUser, async (req, res) => {
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

router.delete("/remove", authenticateUser, async (req, res) => {
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

export default router;
