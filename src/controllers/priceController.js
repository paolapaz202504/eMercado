// Importamos la lógica de negocio desde el modelo
const priceModel = require('../models/priceModel');

const cotizarProducto = (req, res) => {
  const { amazonPrice, weightKg } = req.body;
  
  // Validaciones iniciales
  if (amazonPrice === undefined || weightKg === undefined) {
    return res.status(400).json({ error: 'Faltan parámetros: amazonPrice y weightKg son requeridos en el JSON.' });
  }

  try {
    // El controlador llama al modelo para hacer el cálculo
    const finalPriceDetails = priceModel.calculateFinalPrice(amazonPrice, weightKg);
    res.json(finalPriceDetails); // Esta es nuestra "Vista" (Respuesta JSON)
  } catch (error) {
    res.status(500).json({ error: 'Ocurrió un error al calcular el precio.' });
  }
};

module.exports = { cotizarProducto };