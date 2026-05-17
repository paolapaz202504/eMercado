const exchangeTool = require('../tools/exchangeTool');
const sacTool = require('../tools/sacTool');
const envTool = require('../tools/envTool');
 

/**
 * Clase con responsabilidad única: Obtener tasas y porcentajes para el cálculo de precios.
 */
class AmazonPricingRatesModel {
  constructor() {
    this.insuranceCommission = envTool.getFloat('INSURANCE_COMMISSION', 0.10); // 10% de comisión por seguro.
    this.internationalTransportInsuranceRate = envTool.getFloat('INTERNATIONAL_TRANSPORT_INSURANCE_RATE', 0.022); // 2.2% de seguro de transporte internacional para calcular CIF.
    this.comissionRate = envTool.getFloat('COMMISSION_PERCENTAGE', 0.10); // 10% de comisión por venta.
    this.importDutyRate =  envTool.getFloat('IMPORT_DUTY_RATE', 0.15); // 15% de derechos de importación DAI.
    this.valueAddedRate = envTool.getFloat('VALUE_ADDED_RATE', 0.12); // 12% del impuesto del valor agregado IVA.
    this.exchangeRateAdjustmentUsdGTQ = envTool.getFloat('EXCHANGE_RATE_ADJUSTMENT_USD_GTQ', 0.02); // Ajuste del 2% para el tipo de cambio USD a GTQ.
    this.exchangeRateAdjustmentMxnUsd = envTool.getFloat('EXCHANGE_RATE_ADJUSTMENT_MXN_USD', 0.002); // Ajuste del 0.2% para el tipo de cambio MXN a USD.
    this.foreignExchangeManagementExpense = envTool.getFloat('FOREIGN_EXCHANGE_MANAGEMENT_EXPENSE', 0.04); // 4% Gasto de gestión de cambio extranjero.
    this.storageCostPerProduct = envTool.getFloat('STORAGE_MX_COST_PER_PRODUCT_GTQ', 15); // Precio por almacenar cada producto en bodega méxico (en quetzales).
    this.transportCostPerProduct = envTool.getFloat('TRANSPORT_MX_COST_PER_PRODUCT_GTQ', 30); // Precio por transportar cada producto desde México a Guatemala (en quetzales).
    this.deliveryCostPerProduct = envTool.getFloat('DELIVERY_GT_COST_PER_PRODUCT_GTQ', 25); // Pago por servicio de enviar a domicilio en Guatemala (en quetzales). 
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
    const mxn_usd_adjusted = mxn_usd ? (mxn_usd - this.exchangeRateAdjustmentMxnUsd) : null;
    const usd_gtq_adjusted = usd_gtq ? (usd_gtq * (1 + this.exchangeRateAdjustmentUsdGTQ)) : null;

    let categoryRates = null;
    if (productCategoryId) {
      categoryRates = await sacTool.findCategoryById(productCategoryId);
    }

    return {
      mxn_usd_adjusted,
      usd_gtq_adjusted,
      foreignExchangeManagementExpense: this.foreignExchangeManagementExpense,
      comissionRate: this.comissionRate,
      internationalTransportInsuranceRate: this.internationalTransportInsuranceRate,
      insuranceCommission: this.insuranceCommission,
      importDutyRate: categoryRates !== null ? categoryRates.dai_rate : this.importDutyRate,
      valueAddedRate: categoryRates !== null ? categoryRates.iva_rate : this.valueAddedRate
    };
  }

  /**
   * Aplica las tasas calculadas a los precios de un producto individual.
   */
  applyPricingRules(productData, rateData) {
    let priceMXN = 0;
    if (productData.product_price) {
      const match = productData.product_price.toString().match(/[\d,.]+/);
      if (match) priceMXN = parseFloat(match[0].replace(/,/g, ''));
    }

    let priceUSD = priceMXN * rateData.mxn_usd_adjusted; // Convertir el precio de MXN a USD usando el tipo de cambio ajustado
    let priceGTQ = (priceUSD * rateData.usd_gtq_adjusted); // Convertir el precio de USD a GTQ usando el tipo de cambio ajustado
    let foreignExchangeExpenseValue = priceGTQ * rateData.foreignExchangeManagementExpense; // Calcular el gasto de gestión de cambio extranjero en GTQ
    priceGTQ += foreignExchangeExpenseValue; // Agregar el gasto de gestión de cambio extranjero al precio en GTQ

    let internationalTransportInsuranceValue = (priceGTQ + this.transportCostPerProduct) * rateData.internationalTransportInsuranceRate; // Calcular el seguro de transporte internacional para CIF
    let cifPriceGTQ = priceGTQ + internationalTransportInsuranceValue + this.transportCostPerProduct; // Calcular el precio CIF (Costo, Seguro y Flete) en GTQ

    let commissionValue = priceGTQ * rateData.comissionRate;
    let insuranceValue = priceGTQ * rateData.insuranceCommission;

    let importDutyValue = cifPriceGTQ * rateData.importDutyRate;
    let valueAddedValue = (cifPriceGTQ + importDutyValue) * rateData.valueAddedRate;
    let finalPriceGTQ = priceGTQ + commissionValue + insuranceValue + importDutyValue + valueAddedValue
                        + this.transportCostPerProduct + this.storageCostPerProduct + this.deliveryCostPerProduct;

    console.log('---------------------------------------------');
    console.log(`Producto: ${productData.product_title}`);
    console.log(`Precio original (MXN): ${priceMXN} `);
    console.log(`Tipo de cambio MXN/USD: ${rateData.mxn_usd_adjusted.toFixed(6)} GTQ por MXN `);
    console.log(`Precio convertido (USD): ${priceUSD.toFixed(4)} `);

    console.log(`Tipo de cambio USD/GTQ: ${rateData.usd_gtq_adjusted.toFixed(6)} `);
    
    console.log(`Gasto de gestión de cambio extranjero (GTQ): ${rateData.foreignExchangeManagementExpense.toFixed(5)} `);
    console.log(`Gatos por gestiónd de tipo de cambio (GTQ): ${foreignExchangeExpenseValue.toFixed(4)} `);

    console.log(`Precio convertido a GTQ: ${priceGTQ.toFixed(4)} `);

    console.log(`Costo de transporte (GTQ): ${this.transportCostPerProduct.toFixed(2)} `);
    console.log(`Valor de seguro de transporte internacional para CIF (GTQ): ${internationalTransportInsuranceValue.toFixed(5)} `);
    console.log(`Precio CIF (GTQ): ${cifPriceGTQ.toFixed(4)} `);

    console.log(`Tasa de comisión (GTQ): ${rateData.comissionRate} `);
    console.log(`Valor de comisión (GTQ): ${commissionValue.toFixed(4)} `);

    console.log(`Tasa de comisión por seguro (GTQ): ${rateData.insuranceCommission.toFixed(5)} `);
    console.log(`Valor de seguros (GTQ): ${insuranceValue.toFixed(4)} `);

    console.log(`Tasa de derechos de importación (GTQ): ${rateData.importDutyRate.toFixed(5)} `);
    console.log(`Valor de derechos de importación (GTQ): ${importDutyValue.toFixed(4)} `);

    console.log(`Tasa de IVA (GTQ): ${rateData.valueAddedRate.toFixed(5)} `);
    console.log(`Valor de IVA (GTQ): ${valueAddedValue.toFixed(4)} `);

    console.log(`Costo de almacenamiento (GTQ): ${this.storageCostPerProduct.toFixed(2)} `);
    console.log(`Costo de entrega (GTQ): ${this.deliveryCostPerProduct.toFixed(2)} `);

    console.log(`Precio final (GTQ): ${finalPriceGTQ.toFixed(4)} `);


    return {
      ...productData,
      exchange_rate_mxn_usd: rateData.mxn_usd_adjusted,
      price_usd: priceUSD,
      exchange_rate_usd_gtq: rateData.usd_gtq_adjusted,
      foreign_exchange_management_expense: rateData.foreignExchangeManagementExpense,
      foreign_exchange_management_expense_value: foreignExchangeExpenseValue,
      price_gtq: priceGTQ,
      comission_rate: rateData.comissionRate,
      comission_value: commissionValue,
      insurrance_commission: rateData.insuranceCommission,
      insurance_value: insuranceValue,
      import_duty_rate: rateData.importDutyRate,
      import_duty_value: importDutyValue,
      value_added_rate: rateData.valueAddedRate,
      value_added_value: valueAddedValue,
      storage_cost_per_product: this.storageCostPerProduct,
      transport_cost_per_product: this.transportCostPerProduct,
      delivery_cost_per_product: this.deliveryCostPerProduct,
      product_price_gt: finalPriceGTQ
    };
  }
}

// Exportamos una única instancia (Singleton)
module.exports = new AmazonPricingRatesModel();