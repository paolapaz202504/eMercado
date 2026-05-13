const express = require('express');
const router = express.Router();
const amazonController = require('../controllers/amazonController');

// Definimos la ruta GET para buscar productos
router.get('/buscar', amazonController.searchProducts);

// Definimos la ruta GET para las categorías
router.get('/categorias', amazonController.getCategories);

// Definimos la ruta GET para el proxy de imágenes enmascaradas
router.get('/imagen', amazonController.proxyImage);

// Definimos la ruta GET para ver el detalle de un producto y su stock
router.get('/producto/:asin', amazonController.getProductDetails);

module.exports = router;