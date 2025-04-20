// Get customization preview data for a product
router.get('/:productId/customized-preview', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.productId) },
      include: {
        customizationTemplates: {
          where: { isActive: true },
          orderBy: { orderIndex: 'asc' }
        },
        customizationAreas: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      id: product.id,
      name: product.name,
      customizationTemplates: product.customizationTemplates,
      customizationAreas: product.customizationAreas
    });
  } catch (error) {
    console.error('Error fetching customization preview:', error);
    res.status(500).json({ error: 'Failed to fetch customization preview' });
  }
}); 