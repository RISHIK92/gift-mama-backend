import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { signInSchema, signUpSchema } from "../utils/types/zodTypes.js";
import { authenticateUser } from "../auth/middleware.js";
import Razorpay from 'razorpay';
import crypto from 'crypto';

dotenv.config();

const prisma = new PrismaClient();
const app = express();

app.use(express.json());
app.use(cors());

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });

app.post('/register', async (req, res) => {
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
            password 
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
                password: hashPassword 
            }
        });

        return res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post('/login', async (req, res) => {
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
            process.env.JWT_SECRET,
        );

        return res.status(200).json({ message: "Login successful", token });
    } catch (error) {
        console.error("Error logging in:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get('/user', authenticateUser, async (req, res) => {
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
        pinCode: true
      }
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

app.put('/update-profile', authenticateUser, async (req, res) => {
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
      pinCode
    } = req.body;

    if (email !== req.user.email) {
      const existingUser = await prisma.user.findUnique({ 
        where: { email } 
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
        pinCode
      }
    });

    const { password, ...userWithoutPassword } = updatedUser;

    return res.status(200).json({ 
      message: "Profile updated successfully", 
      user: userWithoutPassword 
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PRODUCT ROUTES
app.get('/products', async (req, res) => {
    try {
        const { 
            category, 
            occasion, 
            recipient, 
            subCategory, 
            minPrice, 
            maxPrice, 
            search 
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
                lte: parseFloat(maxPrice) 
            };
        }
        
        if (search) {
            whereConditions.name = { contains: search, mode: 'insensitive' };
        }
        
        const products = await prisma.product.findMany({
            where: whereConditions,
            include: { 
                images: true,
                customizationTemplate: true
            }
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

app.get('/products/:name', async (req, res) => {
    try {
        const name = decodeURIComponent(req.params.name);
        const product = await prisma.product.findUnique({
            where: { name },
            include: { 
                images: true,
                customizationTemplate: true
            }
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

app.get('/products/:id/customized-preview', async (req, res) => {
  try {
      const productId = parseInt(req.params.id);
      
      const product = await prisma.product.findUnique({
          where: { id: productId },
          include: { customizationTemplate: true }
      });

      if (!product) {
          return res.status(404).json({ message: "Product not found" });
      }
      const svgTemplates = [
        // Mug
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 600 600">
  <!-- Background -->
  <rect width="600" height="600" fill="#f8f9fa" />
  
  <!-- Mug Base -->
  <path d="M200,200 C200,180 220,160 240,160 L360,160 C380,160 400,180 400,200 L400,400 C400,420 380,440 360,440 L240,440 C220,440 200,420 200,400 Z" fill="#ffffff" stroke="#333333" stroke-width="5"/>
  
  <!-- Mug Handle -->
  <path d="M400,220 C450,220 470,260 470,300 C470,340 450,380 400,380" fill="transparent" stroke="#333333" stroke-width="5" stroke-linecap="round"/>
  
  <!-- Mug Top Edge -->
  <ellipse cx="300" cy="160" rx="60" ry="20" fill="#ffffff" stroke="#333333" stroke-width="5"/>
  
  <!-- Mug Bottom Shadow -->
  <ellipse cx="300" cy="440" rx="60" ry="10" fill="#dddddd" stroke="none"/>
  
  <!-- Customization Area -->
  <g id="customization-area">
    <!-- Default placeholder text (will be hidden when image is uploaded) -->
    <text x="300" y="300" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="24" fill="#888888">
      Your Design Here
    </text>
    
    <!-- Placeholder for user image -->
    <image id="custom-image-placeholder" x="240" y="220" width="120" height="120" xlink:href="" preserveAspectRatio="xMidYMid meet"/>
    
    <!-- Customization area outline (optional, for visual guidance) -->
    <rect x="240" y="220" width="120" height="120" fill="none" stroke="#cccccc" stroke-width="1" stroke-dasharray="5,5"/>
  </g>
  
  <!-- Mug highlights -->
  <path d="M210,210 C220,190 235,180 250,180 L255,180" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
  <path d="M240,420 C235,420 225,415 220,410 L215,400" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
  
  <!-- Product title -->
  <text x="300" y="100" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold" fill="#333333">
    Customizable Mug
  </text>
  
  <!-- Instructions -->
  <text x="300" y="520" text-anchor="middle" font-family="Arial" font-size="14" fill="#666666">
    Preview 1: Front view of mug
  </text>
</svg>`,

        // Template 2: Mug with angled view
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 600 600">
  <!-- Background -->
  <rect width="600" height="600" fill="#f8f9fa" />
  
  <!-- Mug from different angle (perspective view) -->
  <g transform="translate(300, 300) rotate(-15) translate(-300, -300)">
    <!-- Mug Base -->
    <ellipse cx="300" cy="440" rx="80" ry="20" fill="#dddddd" stroke="none"/>
    <path d="M220,200 C220,180 240,160 270,160 L330,160 C360,160 380,180 380,200 L380,400 C380,420 360,440 330,440 L270,440 C240,440 220,420 220,400 Z" fill="#ffffff" stroke="#333333" stroke-width="5"/>
    
    <!-- Mug Top Edge (perspective ellipse) -->
    <ellipse cx="300" cy="160" rx="55" ry="20" fill="#ffffff" stroke="#333333" stroke-width="5"/>
    
    <!-- Mug Handle (adjusted for perspective) -->
    <path d="M380,220 C430,230 440,260 440,300 C440,340 430,370 380,380" fill="transparent" stroke="#333333" stroke-width="5" stroke-linecap="round"/>
    
    <!-- Customization Area (adjusted for perspective) -->
    <g id="customization-area">
      <!-- Default placeholder text -->
      <text x="300" y="300" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="24" fill="#888888" transform="rotate(15, 300, 300)">
        Your Design Here
      </text>
      
      <!-- Placeholder for user image -->
      <image id="custom-image-placeholder" x="240" y="220" width="120" height="120" xlink:href="" preserveAspectRatio="xMidYMid meet"/>
      
      <!-- Customization area outline -->
      <rect x="240" y="220" width="120" height="120" fill="none" stroke="#cccccc" stroke-width="1" stroke-dasharray="5,5"/>
    </g>
  </g>
  
  <!-- Product title -->
  <text x="300" y="100" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold" fill="#333333">
    Customizable Mug
  </text>
  
  <!-- Instructions -->
  <text x="300" y="520" text-anchor="middle" font-family="Arial" font-size="14" fill="#666666">
    Preview 2: Angled view of mug
  </text>
</svg>`,

        // Template 3: Circle input template
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 600 600">
  <!-- Background -->
  <rect width="600" height="600" fill="#f8f9fa" />
  
  <!-- Mug Base -->
  <path d="M200,200 C200,180 220,160 240,160 L360,160 C380,160 400,180 400,200 L400,400 C400,420 380,440 360,440 L240,440 C220,440 200,420 200,400 Z" fill="#ffffff" stroke="#333333" stroke-width="5"/>
  
  <!-- Mug Handle -->
  <path d="M400,220 C450,220 470,260 470,300 C470,340 450,380 400,380" fill="transparent" stroke="#333333" stroke-width="5" stroke-linecap="round"/>
  
  <!-- Mug Top Edge -->
  <ellipse cx="300" cy="160" rx="60" ry="20" fill="#ffffff" stroke="#333333" stroke-width="5"/>
  
  <!-- Mug Bottom Shadow -->
  <ellipse cx="300" cy="440" rx="60" ry="10" fill="#dddddd" stroke="none"/>
  
  <!-- Circular Customization Area -->
  <g id="customization-area">
    <!-- Circle clip path -->
    <defs>
      <clipPath id="circle-clip">
        <circle cx="300" cy="280" r="70" />
      </clipPath>
    </defs>
    
    <!-- Circle outline for guidance -->
    <circle cx="300" cy="280" r="70" fill="none" stroke="#cccccc" stroke-width="2" stroke-dasharray="5,5"/>
    
    <!-- Default placeholder text -->
    <text x="300" y="280" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="18" fill="#888888">
      Add Your
    </text>
    <text x="300" y="305" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="18" fill="#888888">
      Circular Design
    </text>
    
    <!-- Placeholder for user image (clipped to circle) -->
    <image id="custom-image-placeholder" x="230" y="210" width="140" height="140" xlink:href="" preserveAspectRatio="xMidYMid meet" clip-path="url(#circle-clip)"/>
  </g>
  
  <!-- Product title -->
  <text x="300" y="100" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold" fill="#333333">
    Circle Template Mug
  </text>
  
  <!-- Instructions -->
  <text x="300" y="520" text-anchor="middle" font-family="Arial" font-size="14" fill="#666666">
    Preview 3: Upload a circular image or logo
  </text>
</svg>`,

        // Template 4: Heart shape template
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 600 600">
  <!-- Background -->
  <rect width="600" height="600" fill="#f8f9fa" />
  
  <!-- Mug Base -->
  <path d="M200,200 C200,180 220,160 240,160 L360,160 C380,160 400,180 400,200 L400,400 C400,420 380,440 360,440 L240,440 C220,440 200,420 200,400 Z" fill="#ffffff" stroke="#333333" stroke-width="5"/>
  
  <!-- Mug Handle -->
  <path d="M400,220 C450,220 470,260 470,300 C470,340 450,380 400,380" fill="transparent" stroke="#333333" stroke-width="5" stroke-linecap="round"/>
  
  <!-- Mug Top Edge -->
  <ellipse cx="300" cy="160" rx="60" ry="20" fill="#ffffff" stroke="#333333" stroke-width="5"/>
  
  <!-- Mug Bottom Shadow -->
  <ellipse cx="300" cy="440" rx="60" ry="10" fill="#dddddd" stroke="none"/>
  
  <!-- Heart-shaped Customization Area -->
  <g id="customization-area">
    <!-- Heart clip path -->
    <defs>
      <clipPath id="heart-clip">
        <path d="M300,350 C260,310 220,270 220,230 C220,200 240,180 270,180 C285,180 295,190 300,200 C305,190 315,180 330,180 C360,180 380,200 380,230 C380,270 340,310 300,350 Z" />
      </clipPath>
    </defs>
    
    <!-- Heart outline for guidance -->
    <path d="M300,350 C260,310 220,270 220,230 C220,200 240,180 270,180 C285,180 295,190 300,200 C305,190 315,180 330,180 C360,180 380,200 380,230 C380,270 340,310 300,350 Z" fill="none" stroke="#cccccc" stroke-width="2" stroke-dasharray="5,5"/>
    
    <!-- Default placeholder text -->
    <text x="300" y="260" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="18" fill="#888888">
      Add Your
    </text>
    <text x="300" y="285" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="18" fill="#888888">
      Heart Design
    </text>
    
    <!-- Placeholder for user image (clipped to heart shape) -->
    <image id="custom-image-placeholder" x="220" y="180" width="160" height="170" xlink:href="" preserveAspectRatio="xMidYMid meet" clip-path="url(#heart-clip)"/>
  </g>
  
  <!-- Product title -->
  <text x="300" y="100" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold" fill="#333333">
    Heart Template Mug
  </text>
  
  <!-- Instructions -->
  <text x="300" y="520" text-anchor="middle" font-family="Arial" font-size="14" fill="#666666">
    Preview 4: Upload an image for heart-shaped customization
  </text>
</svg>`
      ];

      // If customizationTemplate exists, use it as the first template and include the default ones
      if (product.customizationTemplate) {
        // Put the database template first in the array
        svgTemplates.unshift(product.customizationTemplate.svgData);
      }

      return res.status(200).json({ 
          svgTemplates: svgTemplates
      });
  } catch (error) {
      console.error("Error fetching customized preview:", error);
      res.status(500).json({ message: "Internal server error" });
  }
});

// CATEGORIES ROUTES
app.get('/categories', async (req, res) => {
    try {
        const categories = await prisma.category.findMany();
        res.status(200).json(categories);
    } catch(error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get('/nav-categories', async (req, res) => {
    try {
        const navCategories = await prisma.navCategory.findMany();
        res.status(200).json(navCategories);
    } catch(error) {
        console.error("Error fetching navigation categories:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get('/all-categories', async (req, res) => {
    try {
        const allCategories = await prisma.allCategories.findMany();
        res.status(200).json(allCategories);
    } catch (error) {
        console.error("Error fetching all categories:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get('/get-categories', async (req, res) => {
    try {
        const categories = await prisma.categories.findMany();
        res.status(200).json(categories);
    } catch (error) {
        console.error("Error fetching all categories:", error);
        res.status(500).json({ message: "Internal server error" });
    } 
})

// HOME PAGE ROUTES
app.get('/home', async (req, res) => {
    try {
        const homeImages = await prisma.homeImages.findMany({
            include: {
                customSections: true
            }
        });
        const occasions = await prisma.occasion.findMany();
        
        // Check if there's an active flash sale
        const currentTime = new Date();
        const activeFlashSales = await prisma.flashSale.findMany({
            where: {
                active: true,
                startTime: { lte: currentTime },
                endTime: { gte: currentTime }
            },
            include: {
                items: {
                    include: {
                        product: {
                            include: {
                                images: true
                            }
                        }
                    }
                }
            },
            take: 1
        });
        
        res.status(200).json({
            homeImages,
            occasions,
            activeFlashSale: activeFlashSales.length > 0 ? activeFlashSales[0] : null
        });
    } catch (error) {
        console.error("Error fetching home page data:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// FLASH SALES ROUTES
app.get('/flash-sales', async (req, res) => {
    try {
        const currentTime = new Date();
        
        const flashSales = await prisma.flashSale.findMany({
            where: {
                active: true,
                startTime: { lte: currentTime },
                endTime: { gte: currentTime }
            },
            include: {
                items: {
                    include: {
                        product: {
                            include: {
                                images: true
                            }
                        }
                    }
                }
            }
        });
        
        res.status(200).json(flashSales);
    } catch (error) {
        console.error("Error fetching flash sales:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get('/flash-sales/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const flashSale = await prisma.flashSale.findUnique({
            where: { id: Number(id) },
            include: {
                items: {
                    include: {
                        product: {
                            include: {
                                images: true
                            }
                        }
                    }
                }
            }
        });
        
        if (!flashSale) {
            return res.status(404).json({ message: "Flash sale not found" });
        }
        
        res.status(200).json(flashSale);
    } catch (error) {
        console.error("Error fetching flash sale:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// CART ROUTES
app.post('/cart/add', authenticateUser, async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;
        
        if (!productId) {
            return res.status(400).json({ message: "Product ID is required" });
        }
        
        // Check if product exists
        const product = await prisma.product.findUnique({
            where: { id: Number(productId) }
        });
        
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        
        // Get or create user's cart
        let cart = await prisma.cart.findUnique({
            where: { userId: req.user.id }
        });
        
        if (!cart) {
            cart = await prisma.cart.create({
                data: { userId: req.user.id }
            });
        }
        
        // Check if item already exists in cart
        const existingItem = await prisma.cartItem.findUnique({
            where: {
                cartId_productId: {
                    cartId: cart.id,
                    productId: Number(productId)
                }
            }
        });
        
        if (existingItem) {
            await prisma.cartItem.update({
                where: { id: existingItem.id },
                data: { quantity: existingItem.quantity + Number(quantity) }
            });
        } else {
            await prisma.cartItem.create({
                data: {
                    cartId: cart.id,
                    productId: Number(productId),
                    quantity: Number(quantity)
                }
            });
        }
        
        const updatedCart = await prisma.cart.findUnique({
            where: { userId: req.user.id },
            include: {
                items: {
                    include: {
                        product: {
                            include: {
                                images: true
                            }
                        }
                    }
                }
            }
        });
        
        res.status(200).json({ message: "Item added to cart", cart: updatedCart });
    } catch (error) {
        console.error("Error adding to cart:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get('/cart', authenticateUser, async (req, res) => {
    try {
      const [cart, wallet] = await Promise.all([
        prisma.cart.findUnique({
          where: { userId: req.user.id },
          include: {
            items: {
              include: {
                product: {
                  include: {
                    images: true
                  }
                }
              }
            }
          }
        }),
        prisma.wallet.findUnique({
          where: { userId: req.user.id }
        })
      ]);
  
      if (!cart) {
        return res.status(200).json({ 
          items: [], 
          summary: { 
            subtotal: 0, 
            discount: 0, 
            total: 0, 
            deliveryFee: 200, 
            tax: 0 
          },
          walletBalance: wallet?.balance || 0
        });
      }
  
      let subtotal = 0;
      let discount = 0;
      
      cart.items.forEach(item => {
        const price = Number(item.product.price);
        const discountedPrice = item.product.discountedPrice ? 
          Number(item.product.discountedPrice) : price;
        
        subtotal += price * item.quantity;
        discount += (price - discountedPrice) * item.quantity;
      });
  
      const total = subtotal - discount;
      const tax = Math.round(total * 0.02); // 2% tax
      const deliveryFee = 200;
  
      res.status(200).json({
        items: cart.items,
        summary: {
          subtotal,
          discount,
          total,
          deliveryFee,
          tax
        },
        walletBalance: wallet?.balance || 0
      });
    } catch (error) {
      console.error("Error fetching cart:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

app.put('/cart/item/:itemId', authenticateUser, async (req, res) => {
    try {
        const { itemId } = req.params;
        const { quantity } = req.body;
        
        if (!quantity || quantity < 1) {
            return res.status(400).json({ message: "Quantity must be at least 1" });
        }
        
        const cartItem = await prisma.cartItem.findUnique({
            where: { id: Number(itemId) },
            include: { cart: true }
        });
        
        if (!cartItem || cartItem.cart.userId !== req.user.id) {
            return res.status(404).json({ message: "Cart item not found" });
        }
        
        await prisma.cartItem.update({
            where: { id: Number(itemId) },
            data: { quantity: Number(quantity) }
        });
        
        res.status(200).json({ message: "Cart item updated" });
    } catch (error) {
        console.error("Error updating cart item:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.put('/cart/item/:itemId', authenticateUser, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    
    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: "Quantity must be at least 1" });
    }
    
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: Number(itemId) },
      include: { cart: true }
    });
    
    if (!cartItem || cartItem.cart.userId !== req.user.id) {
      return res.status(404).json({ message: "Cart item not found" });
    }
    
    await prisma.cartItem.update({
      where: { id: Number(itemId) },
      data: { quantity: Number(quantity) }
    });
    
    res.status(200).json({ message: "Cart item updated" });
  } catch (error) {
    console.error("Error updating cart item:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.delete('/cart/item/:itemId', authenticateUser, async (req, res) => {
  try {
    const { itemId } = req.params;
    
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: Number(itemId) },
      include: { cart: true }
    });
    
    if (!cartItem || cartItem.cart.userId !== req.user.id) {
      return res.status(404).json({ message: "Cart item not found" });
    }
    
    await prisma.cartItem.delete({
      where: { id: Number(itemId) }
    });
    
    res.status(200).json({ message: "Item removed from cart" });
  } catch (error) {
    console.error("Error removing cart item:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.delete('/cart', authenticateUser, async (req, res) => {
  try {
    const cart = await prisma.cart.findUnique({
      where: { userId: req.user.id }
    });
    
    if (cart) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id }
      });
    }
    
    res.status(200).json({ message: "Cart cleared" });
  } catch (error) {
    console.error("Error clearing cart:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post('/create-order', authenticateUser, async (req, res) => {
    try {
      const { amount, currency = 'INR', receipt, useWallet, walletAmount = 0 } = req.body;
  
      // Validate input
      if (!amount || !receipt) {
        return res.status(400).json({ message: "Amount and receipt are required" });
      }
  
      // Check wallet balance if using wallet
      if (useWallet) {
        const wallet = await prisma.wallet.findUnique({
          where: { userId: req.user.id }
        });
  
        if (!wallet || wallet.balance < walletAmount) {
          return res.status(400).json({ 
            message: "Insufficient wallet balance" 
          });
        }
      }
  
      // Create order with Razorpay
      const options = {
        amount: amount * 100, // Convert to paisa
        currency: currency,
        receipt: receipt,
        payment_capture: 1 // Auto-capture payment
      };
  
      const order = await razorpay.orders.create(options);
  
      // Save order details in database with wallet info
      await prisma.order.create({
        data: {
          userId: req.user.id,
          razorpayOrderId: order.id,
          amount: amount,
          status: 'INITIATED',
          currency: currency,
          useWallet: useWallet || false,
          walletAmount: walletAmount || 0
        }
      });
  
      res.status(200).json({
        id: order.id,
        amount: order.amount,
        currency: order.currency
      });
    } catch (error) {
      console.error("Error creating Razorpay order:", error);
      res.status(500).json({ message: "Failed to create order" });
    }
  });
  
  app.post('/verify-payment', authenticateUser, async (req, res) => {
    try {
      const { 
        razorpay_order_id, 
        razorpay_payment_id, 
        razorpay_signature,
        useWallet,
        walletAmount = 0
      } = req.body;
  
      // Validate input
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ 
          status: 'error', 
          message: "Missing payment details" 
        });
      }
  
      // Verify signature
      const generated_signature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest('hex');
  
      if (generated_signature !== razorpay_signature) {
        return res.status(400).json({ 
          status: 'error', 
          message: "Invalid payment signature" 
        });
      }
  
      // Find the order
      const order = await prisma.order.findUnique({
        where: { razorpayOrderId: razorpay_order_id }
      });
  
      if (!order) {
        return res.status(404).json({ 
          status: 'error', 
          message: "Order not found" 
        });
      }
  
      // Process wallet deduction if used
      if (useWallet && walletAmount > 0) {
        const wallet = await prisma.wallet.findUnique({
          where: { userId: req.user.id }
        });
  
        if (!wallet || wallet.balance < walletAmount) {
          return res.status(400).json({ 
            status: 'error', 
            message: "Insufficient wallet balance" 
          });
        }
  
        // Deduct from wallet
        await prisma.wallet.update({
          where: { userId: req.user.id },
          data: { balance: { decrement: walletAmount } }
        });
  
        // Record wallet transaction
        await prisma.transaction.create({
          data: {
            walletId: wallet.id,
            amount: walletAmount,
            type: 'debit',
            description: `Order payment: ${order.id}`
          }
        });
      }
  
      // Update order status
      await prisma.order.update({
        where: { razorpayOrderId: razorpay_order_id },
        data: {
          status: 'PAID',
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature
        }
      });
  
      // Process cart items
      const cart = await prisma.cart.findUnique({
        where: { userId: req.user.id },
        include: { items: { include: { product: true } } }
      });
  
      if (cart && cart.items.length > 0) {
        // Create order items
        await prisma.orderItem.createMany({
          data: cart.items.map(item => ({
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.product.discountedPrice || item.product.price
          }))
        });
  
        // Clear the cart
        await prisma.cartItem.deleteMany({
          where: { cartId: cart.id }
        });
      }
  
      res.status(200).json({ 
        status: 'success', 
        message: "Payment verified successfully",
        orderId: order.id
      });
    } catch (error) {
      console.error("Error verifying payment:", error);
      res.status(500).json({ 
        status: 'error', 
        message: "Payment verification failed" 
      });
    }
  });

app.get('/orders', authenticateUser, async (req,res) => {
    try {
        const orders = await prisma.order.findMany({
          where: { userId: req.user.id },
          include: {
            orderItems: {
              include: {
                product: {
                  include: {
                    images: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        });
    
        const transformedOrders = orders.map(order => ({
          ...order,
          summary: {
            total: order.orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            deliveryFee: 50,
            tax: order.orderItems.reduce((sum, item) => sum + (item.price * item.quantity * 0.1), 0)
          }
        }));
    
        res.status(200).json(transformedOrders);
      } catch (error) {
        console.error("Error fetching order history:", error);
        res.status(500).json({ message: "Failed to fetch order history", error: error.message });
      }
})

app.get('/order/:orderId',authenticateUser, async (req,res) => {
    try {
        const { orderId } = req.params;
    
        const order = await prisma.order.findUnique({
          where: { 
            id: parseInt(orderId),
            userId: req.user.id 
          },
          include: {
            orderItems: {
              include: {
                product: {
                  include: {
                    images: true
                  }
                }
              }
            }
          }
        });
    
        if (!order) {
          return res.status(404).json({ message: "Order not found" });
        }
    
        const summary = {
          total: order.orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
          deliveryFee: 50, // Example fixed delivery fee
          tax: order.orderItems.reduce((sum, item) => sum + (item.price * item.quantity * 0.1), 0) // 10% tax example
        };
    
        res.status(200).json({ ...order, summary });
      } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).json({ message: "Failed to fetch order details", error: error.message });
      }
})

app.get('/orders/latest', authenticateUser, async (req, res) => {
    try {
        const latestOrder = await prisma.order.findFirst({
            where: { 
                userId: req.user.id 
            },
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                orderItems: {
                    include: {
                        product: {
                            include: {
                                images: true
                            }
                        }
                    }
                },
                user: {
                    select: {
                        email: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });

        if (!latestOrder) {
            return res.status(404).json({ 
                success: false,
                message: "No orders found for this user" 
            });
        }

        // Calculate order values
        const subtotal = latestOrder.orderItems.reduce(
            (sum, item) => sum + (item.price * item.quantity), 
            0
        );
        
        const taxRate = 0.1; // 10% tax
        const deliveryFee = 50;
        const tax = subtotal * taxRate;
        const total = subtotal + tax + deliveryFee - (latestOrder.walletAmount || 0);

        // Prepare clean response object
        const response = {
            success: true,
            data: {
                orderId: latestOrder.id,
                orderNumber: `ORD-${latestOrder.id.toString().padStart(6, '0')}`,
                date: latestOrder.createdAt.toISOString(),
                payment: {
                    method: latestOrder.razorpayPaymentId ? 'Online' : 'Wallet',
                    status: latestOrder.status,
                    walletUsed: latestOrder.walletAmount || 0
                },
                summary: {
                    subtotal: parseFloat(subtotal.toFixed(2)),
                    delivery: deliveryFee,
                    tax: parseFloat(tax.toFixed(2)),
                    total: parseFloat(total.toFixed(2))
                },
                items: latestOrder.orderItems.map(item => ({
                    itemId: item.id,
                    quantity: item.quantity,
                    unitPrice: item.price,
                    product: {
                        id: item.product.id,
                        name: item.product.name,
                        image: item.product.images[0]?.mainImage || null
                    }
                })),
                customer: {
                    email: latestOrder.user.email,
                    name: `${latestOrder.user.firstName} ${latestOrder.user.lastName}`
                }
            }
        };

        res.status(200).json(response);
    } catch (error) {
        console.error("Order fetch error:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to retrieve order details",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});


app.post('/wallet/create-order', authenticateUser, async (req, res) => {
    try {
      const { amount, currency = 'INR' } = req.body;
  
      // Validate input
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }
  
      // Generate a unique receipt
      const receipt = `wallet_topup_${req.user.id}_${Date.now()}`;
  
      // Create Razorpay order
      const options = {
        amount: amount * 100,
        currency: currency,
        receipt: receipt,
        payment_capture: 1 // Auto-capture payment
      };
      const order = await razorpay.orders.create(options);
  
      // Save order details in database
      await prisma.walletOrder.create({
        data: {
          userId: req.user.id,
          razorpayOrderId: order.id,
          amount: amount,
          status: 'INITIATED',
          currency: currency
        }
      });
  
      res.status(200).json({
        id: order.id,
        amount: order.amount,
        currency: order.currency
      });
    } catch (error) {
      console.error("Error creating Razorpay wallet top-up order:", error);
      res.status(500).json({ message: "Failed to create wallet top-up order" });
    }
  });
  
  // Verify Razorpay payment for wallet top-up
  app.post('/wallet/verify-payment', authenticateUser, async (req, res) => {
    try {
      const { 
        razorpay_order_id, 
        razorpay_payment_id, 
        razorpay_signature 
      } = req.body;
  
      // Validate input
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ 
          status: 'error', 
          message: "Missing payment details" 
        });
      }
  
      // Verify signature
      const generated_signature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest('hex');
  
      // Check if signatures match
      if (generated_signature !== razorpay_signature) {
        return res.status(400).json({ 
          status: 'error', 
          message: "Invalid payment signature" 
        });
      }
  
      // Find the corresponding wallet order
      const walletOrder = await prisma.walletOrder.findUnique({
        where: { razorpayOrderId: razorpay_order_id }
      });
  
      if (!walletOrder) {
        return res.status(404).json({ 
          status: 'error', 
          message: "Wallet order not found" 
        });
      }
  
      // Find or create wallet
      let wallet = await prisma.wallet.findUnique({
        where: { userId: req.user.id }
      });
  
      if (!wallet) {
        wallet = await prisma.wallet.create({
          data: {
            userId: req.user.id,
            balance: 0
          }
        });
      }
  
      // Update wallet balance
      const updatedWallet = await prisma.wallet.update({
        where: { userId: req.user.id },
        data: {
          balance: { increment: walletOrder.amount }
        }
      });
  
      // Create transaction record
      await prisma.transaction.create({
        data: {
          walletId: updatedWallet.id,
          amount: walletOrder.amount,
          type: 'credit',
          description: 'Razorpay Wallet Top-up'
        }
      });
  
      // Update wallet order status
      await prisma.walletOrder.update({
        where: { razorpayOrderId: razorpay_order_id },
        data: {
          status: 'PAID',
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature
        }
      });
  
      res.status(200).json({ 
        status: 'success', 
        message: "Wallet top-up successful",
        newBalance: updatedWallet.balance
      });
    } catch (error) {
      console.error("Error verifying wallet top-up payment:", error);
      res.status(500).json({ 
        status: 'error', 
        message: "Wallet top-up payment verification failed" 
      });
    }
  });

app.get('/wallet/balance', authenticateUser, async (req, res) => {
    try {
      let wallet = await prisma.wallet.findUnique({
        where: { userId: req.user.id },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 10 // Limit to 10 most recent transactions
          }
        }
      });
  
      if (!wallet) {
        wallet = await prisma.wallet.create({
          data: {
            userId: req.user.id,
            balance: 0
          },
          include: { transactions: true }
        });
  
        return res.status(200).json({
          balance: wallet.balance,
          transactions: []
        });
      }
  
      res.status(200).json({
        balance: wallet.balance,
        transactions: wallet.transactions.map(transaction => ({
          id: transaction.id,
          amount: transaction.amount,
          type: transaction.type,
          description: transaction.description,
          createdAt: transaction.createdAt
        }))
      });
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
      res.status(500).json({ message: "Failed to fetch wallet balance" });
    }
  });
  
  // Add money to wallet
  app.post('/wallet/add-money', authenticateUser, async (req, res) => {
    try {
      const { amount } = req.body;
  
      // Validate amount
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }
  
      // Find or create wallet
      let wallet = await prisma.wallet.findUnique({
        where: { userId: req.user.id }
      });
  
      if (!wallet) {
        wallet = await prisma.wallet.create({
          data: {
            userId: req.user.id,
            balance: 0
          }
        });
      }
  
      // Update wallet balance
      const updatedWallet = await prisma.wallet.update({
        where: { userId: req.user.id },
        data: {
          balance: { increment: amount }
        }
      });
  
      // Create transaction record
      await prisma.transaction.create({
        data: {
          walletId: updatedWallet.id,
          amount: amount,
          type: 'credit',
          description: 'Manual Wallet Topup'
        }
      });
  
      res.status(200).json({
        message: "Money added successfully",
        newBalance: updatedWallet.balance
      });
    } catch (error) {
      console.error("Error adding money to wallet:", error);
      res.status(500).json({ message: "Failed to add money to wallet" });
    }
  });
  
  
  app.get('/wallet/transactions', authenticateUser, async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
  
      const wallet = await prisma.wallet.findUnique({
        where: { userId: req.user.id }
      });
  
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
  
      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where: { walletId: wallet.id },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.transaction.count({
          where: { walletId: wallet.id }
        })
      ]);
  
      res.status(200).json({
        transactions,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalTransactions: total
        }
      });
    } catch (error) {
      console.error("Error fetching wallet transactions:", error);
      res.status(500).json({ message: "Failed to fetch wallet transactions" });
    }
  });

app.listen(3000, () => {
    console.log("Server running on port 3000");
});