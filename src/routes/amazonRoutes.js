const express = require('express');
const router = express.Router();
const amazonController = require('../controllers/amazonController');

// Definimos la ruta GET para buscar productos
router.get('/buscar', amazonController.searchProducts);

// Definimos la ruta GET para las categorías
router.get('/categorias', amazonController.getCategories);

module.exports = router;