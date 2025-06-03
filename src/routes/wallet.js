import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateUser } from "../../auth/middleware.js";
import Razorpay from "razorpay";
import crypto from "crypto";

const router = express.Router();
const prisma = new PrismaClient();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

router.post("/create-order", authenticateUser, async (req, res) => {
  const { amount } = req.body;
  const userId = req.user.id;

  // Validate input
  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({
      status: "error",
      message: "Please provide a valid amount",
    });
  }

  try {
    // Convert amount to paise (Razorpay expects amount in smallest currency unit)
    const amountInPaise = Math.round(amount * 100);

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `wallet_topup_${Date.now()}`,
      notes: {
        purpose: "Wallet Top-up",
      },
    });

    // Create wallet order record in database
    const walletOrder = await prisma.walletOrder.create({
      data: {
        userId,
        razorpayOrderId: razorpayOrder.id,
        amount: amount,
        status: "INITIATED",
      },
    });

    // Return the order details to frontend
    res.status(200).json({
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    });
  } catch (error) {
    console.error("Error creating wallet top-up order:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to create wallet top-up order",
    });
  }
});

router.post("/verify-payment", authenticateUser, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;
  const userId = req.user.id;

  try {
    // Validate input
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        status: "error",
        message: "Missing payment verification details",
      });
    }

    // Verify the payment signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        status: "error",
        message: "Invalid payment signature",
      });
    }

    // Find the wallet order
    const walletOrder = await prisma.walletOrder.findUnique({
      where: { razorpayOrderId: razorpay_order_id },
    });

    if (!walletOrder || walletOrder.userId !== userId) {
      return res.status(404).json({
        status: "error",
        message: "Wallet order not found",
      });
    }

    // Check if already processed
    if (walletOrder.status === "COMPLETED") {
      return res.status(200).json({
        status: "success",
        message: "Payment already processed",
        newBalance: wallet.balance,
      });
    }

    // Update wallet balance in a transaction
    const result = await prisma.$transaction(async (prisma) => {
      // Find or create wallet
      let wallet = await prisma.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        wallet = await prisma.wallet.create({
          data: { userId, balance: 0 },
        });
      }

      // Update wallet balance
      const updatedWallet = await prisma.wallet.update({
        where: { userId },
        data: { balance: { increment: walletOrder.amount } },
      });

      // Create transaction record
      await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          amount: walletOrder.amount,
          type: "credit",
          description: "Wallet Top-up via Razorpay",
        },
      });

      // Update wallet order status
      await prisma.walletOrder.update({
        where: { id: walletOrder.id },
        data: {
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          status: "COMPLETED",
        },
      });

      return updatedWallet;
    });

    res.status(200).json({
      status: "success",
      message: "Wallet top-up successful",
      newBalance: result.balance,
    });
  } catch (error) {
    console.error("Error verifying wallet payment:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to verify wallet payment",
    });
  }
});

router.get("/balance", authenticateUser, async (req, res) => {
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
router.post("/add-money", authenticateUser, async (req, res) => {
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

router.get("/transactions", authenticateUser, async (req, res) => {
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

export default router;
