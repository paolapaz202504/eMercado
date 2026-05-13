const express = require('express');
const router = express.Router();
const priceController = require('../controllers/priceController');

// Definimos la ruta POST y le asignamos la función de su respectivo controlador
router.post('/cotizar-producto', priceController.cotizarProducto);

module.exports = router;