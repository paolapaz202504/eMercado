const amazonModel = require('../models/amazon/amazonModel');
const amazonCategoryModel = require('../models/amazon/amazonCategoryModel');

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
    const categories = await amazonCategoryModel.getCategories();
    res.json({ success: true, source: 'amazon', categories });
  } catch (error) {
    console.error("Error en el controlador de categorías:", error);
    res.status(500).json({ error: 'Ocurrió un error al intentar obtener las categorías.', detalle: error.message });
  }
};

const proxyImage = async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) return res.status(400).send('URL de imagen no proporcionada');
  
  try {
    // Descargamos la imagen del servidor original de Amazon
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('No se pudo obtener la imagen');
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    res.send(buffer);
  } catch (error) {
    res.status(500).send('Error al enmascarar imagen');
  }
};

const getProductDetails = async (req, res) => {
  const asin = req.params.asin;
  if (!asin) return res.status(400).json({ error: 'Falta el ASIN del producto.' });

  try {
    const details = await amazonModel.getProductDetails(asin);
    res.json({ success: true, details });
  } catch (error) {
    console.error("Error al obtener detalles:", error);
    res.status(500).json({ error: 'Error al obtener detalles del producto.', detalle: error.message });
  }
};

module.exports = { searchProducts, getCategories, proxyImage, getProductDetails };