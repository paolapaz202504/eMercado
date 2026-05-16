const exchangeTool = require('../tools/exchangeTool');
const sacTool = require('../tools/sacTool');

/**
 * Clase con responsabilidad única: Obtener tasas y porcentajes para el cálculo de precios.
 */
class AmazonPricingRatesModel {
  constructor() {
    this.defaultValues = {
      insuranceCommission: parseFloat(process.env.INSURANCE_COMMISSION) || 0.10, // 10% de comisión por seguro.
      comissionRate: parseFloat(process.env.COMMISSION_PERCENTAGE) || 0.10, // 10% de comisión por venta.
      importDutyRate: parseFloat(process.env.IMPORT_DUTY_RATE) || 0.15, // 15% de derechos de importación DAI.
      valueAddedRate: parseFloat(process.env.VALUE_ADDED_RATE) || 0.12, // 12% del impuesto del valor agregado IVA.
      exchangeRateAdjustmentUsdGTQ: parseFloat(process.env.EXCHANGE_RATE_ADJUSTMENT_USD_GTQ) || 0.02, // Ajuste del 2% para el tipo de cambio USD a GTQ.
      exchangeRateAdjustmentMxnUsd: parseFloat(process.env.EXCHANGE_RATE_ADJUSTMENT_MXN_USD) || 0.002, // Ajuste del 0.2% para el tipo de cambio MXN a USD.
      foreignExchangeManagementExpense: parseFloat(process.env.FOREIGN_EXCHANGE_MANAGEMENT_EXPENSE) || 0.04 // 4% Gasto de gestión de cambio extranjero.
    };
  }

  /**
   * Tasas para calcular el precio del producto
   * @param {string|null} productCategoryId
   */
  async getPricingRates(productCategoryId = null) {
    // Obtener el tipo de cambio antes de procesar los detalles
    const exchangeData = await exchangeTool.getExchangeRate();
  
    // Obtener los tipos de cambio base desde el resultado de getExchangeRate()
    const mxn_usd = exchangeData.exchange_rate_mxn_usd;
    const usd_gtq = exchangeData.exchange_rate_usd_gtq;

    // Calcular el tipo de cambio ajustado
    const mxn_usd_adjusted = mxn_usd ? (mxn_usd - this.defaultValues.exchangeRateAdjustmentMxnUsd) : null;
    const usd_gtq_adjusted = usd_gtq ? (usd_gtq * (1 + this.defaultValues.exchangeRateAdjustmentUsdGTQ)) : null;

    const rate = (mxn_usd_adjusted && usd_gtq_adjusted && this.defaultValues.foreignExchangeManagementExpense) 
                ? (mxn_usd_adjusted * usd_gtq_adjusted * (1 + this.defaultValues.foreignExchangeManagementExpense))
                : 0.60;

    console.log(`Tipo de cambio ajustado calculado: ${rate.toFixed(4)} GTQ por MXN`); 
    
    let categoryRates = null;
    if (productCategoryId) {
      categoryRates = await sacTool.findCategoryById(productCategoryId);
    }

    return {
      rate, 
      mxn_usd_adjusted, 
      usd_gtq_adjusted,
      foreignExchangeManagementExpense: this.defaultValues.foreignExchangeManagementExpense,
      comissionRate: this.defaultValues.comissionRate,
      insuranceCommission: this.defaultValues.insuranceCommission,
      importDutyRate: categoryRates !== null ? categoryRates.dai_rate : this.defaultValues.importDutyRate,
      valueAddedRate: categoryRates !== null ? categoryRates.iva_rate : this.defaultValues.valueAddedRate
    };
  }

  /**
   * Aplica las tasas calculadas a los precios de un producto individual.
   */
  applyPricingRules(productData, rateData) {
    let parsedPrice = 0;
    if (productData.product_price) {
      const match = productData.product_price.toString().match(/[\d,.]+/);
      if (match) parsedPrice = parseFloat(match[0].replace(/,/g, ''));
    }

    let basePriceGTQ = parsedPrice ? parsedPrice * rateData.rate : null;
    let insuranceValue = basePriceGTQ ? basePriceGTQ * rateData.insuranceCommission : null;
    let commissionValue = basePriceGTQ ? basePriceGTQ * rateData.comissionRate : null;
    let importDutyValue = basePriceGTQ ? basePriceGTQ * rateData.importDutyRate : null;
    let valueAddedValue = basePriceGTQ ? (basePriceGTQ + importDutyValue) * rateData.valueAddedRate : null;
    let productPrice = basePriceGTQ ? basePriceGTQ + insuranceValue + commissionValue + importDutyValue + valueAddedValue : null; 
    
    console.log('---------------------------------------------');
    console.log(`Producto: ${productData.product_title}`);
    console.log(`Precio en Quetzales (GTQ): ${basePriceGTQ} `);
    console.log(`Valor de seguros (GTQ): ${insuranceValue} `);
    console.log(`Valor de comisión (GTQ): ${commissionValue} `);
    console.log(`Valor de derechos de importación (GTQ): ${importDutyValue} `);
    console.log(`Valor de IVA (GTQ): ${valueAddedValue} `);
    console.log(`Precio total (GTQ): ${productPrice} `);

    return {
      ...productData,
      exchange_rate_mxn_usd: rateData.mxn_usd_adjusted,
      exchange_rate_usd_gtq: rateData.usd_gtq_adjusted,
      foreign_exchange_management_expense: rateData.foreignExchangeManagementExpense,
      exchange_rate_gt_mx: rateData.rate,
      comission_rate: rateData.comissionRate,
      insurrance_commission: rateData.insuranceCommission,
      import_duty_rate: rateData.importDutyRate,
      value_added_rate: rateData.valueAddedRate,  
      product_price_gt: productPrice
    };
  }
}

// Exportamos una única instancia (Singleton)
module.exports = new AmazonPricingRatesModel();