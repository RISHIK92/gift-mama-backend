import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Get all active testimonials
router.get('/', async (req, res) => {
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.json(testimonials);
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    res.status(500).json({ error: 'Failed to fetch testimonials' });
  }
});

// Create a new testimonial
router.post('/', async (req, res) => {
  try {
    const { name, content, rating, imageUrl } = req.body;
    const testimonial = await prisma.testimonial.create({
      data: {
        name,
        content,
        rating,
        imageUrl
      }
    });
    res.json(testimonial);
  } catch (error) {
    console.error('Error creating testimonial:', error);
    res.status(500).json({ error: 'Failed to create testimonial' });
  }
});

// Update a testimonial
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, content, rating, imageUrl, isActive } = req.body;
    const testimonial = await prisma.testimonial.update({
      where: { id: parseInt(id) },
      data: {
        name,
        content,
        rating,
        imageUrl,
        isActive
      }
    });
    res.json(testimonial);
  } catch (error) {
    console.error('Error updating testimonial:', error);
    res.status(500).json({ error: 'Failed to update testimonial' });
  }
});

// Delete a testimonial
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.testimonial.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Testimonial deleted successfully' });
  } catch (error) {
    console.error('Error deleting testimonial:', error);
    res.status(500).json({ error: 'Failed to delete testimonial' });
  }
});

export default router; 