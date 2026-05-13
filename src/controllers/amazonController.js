const amazonModel = require('../models/amazonModel');

const searchProducts = async (req, res) => {
  // Obtenemos el término de búsqueda desde la URL. Ej: /api/amazon/buscar?q=laptops
  const searchQuery = req.query.q; 

  if (!searchQuery) {
    return res.status(400).json({ error: 'Debes proporcionar un término de búsqueda válido usando el parámetro "q".' });
  }

  try {
    const products = await amazonModel.searchProducts(searchQuery);
    res.json({ success: true, query: searchQuery, products });
  } catch (error) {
    console.error("Error en el controlador:", error);
    res.status(500).json({ error: 'Ocurrió un error al intentar obtener los productos.', detalle: error.message });
  }
};

const getCategories = async (req, res) => {
  try {
    const categories = await amazonModel.getCategories();
    res.json({ success: true, source: 'amazon', categories });
  } catch (error) {
    console.error("Error en el controlador de categorías:", error);
    res.status(500).json({ error: 'Ocurrió un error al intentar obtener las categorías.', detalle: error.message });
  }
};

module.exports = { searchProducts, getCategories };