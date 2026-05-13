/**
 * Tabla de configuración de precios por peso del courier.
 * Próximamente esto vendrá de la base de datos.
 */
const courierRates = [
  { maxWeightKg: 1, price: 50 },
  { maxWeightKg: 5, price: 150 },
  { maxWeightKg: 10, price: 250 },
  { maxWeightKg: Infinity, price: 500 }
];

/**
 * Calcula el precio final del producto
 * @param {number} amazonPrice 
 * @param {number} weightKg 
 */
function calculateFinalPrice(amazonPrice, weightKg) {
  const commissionRate = parseFloat(process.env.COMMISSION_PERCENTAGE) || 0.05;
  
  const shippingRate = courierRates.find(rate => weightKg <= rate.maxWeightKg);
  const shippingCost = shippingRate ? shippingRate.price : 0;
  
  const commissionAmount = amazonPrice * commissionRate;
  const finalPrice = amazonPrice + shippingCost + commissionAmount;
  
  return {
    amazonPrice,
    weightKg,
    shippingCost,
    commissionAmount,
    finalPrice
  };
}

// Exportamos la lógica del modelo
module.exports = {
  calculateFinalPrice
};