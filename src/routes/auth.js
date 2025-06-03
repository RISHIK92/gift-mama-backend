import express from "express";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

router.post("/register", async (req, res) => {
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
      whatsrouterNumber,
      usePrimaryForWhatsrouter,
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
        whatsrouterNumber,
        usePrimaryForWhatsrouter: usePrimaryForWhatsrouter || false,
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

router.post("/login", async (req, res) => {
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

export default router;
