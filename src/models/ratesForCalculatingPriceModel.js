const fs = require('fs');
const path = require('path');

const { getExchangeRate } = require('./exchangeModel');
const sacModel = require('./sacModel');

/**
 * Obtener valores predefinidos para el cálculo de precio de productos
 */
const defaultValues = {
    insuranceCommission: parseFloat(process.env.INSURANCE_COMMISSION) || 0.10, // 10% de comisión por seguro.
    comissionRate: parseFloat(process.env.COMMISSION_PERCENTAGE) || 0.10, // 10% de comisión por venta.
    importDutyRate: parseFloat(process.env.IMPORT_DUTY_RATE) || 0.15, // 15% de derechos de importación DAI.
    valueAddedRate: parseFloat(process.env.VALUE_ADDED_RATE) || 0.12, // 12% del impuesto del valor agregado IVA.
    exchangeRateAdjustmentUsdGTQ: parseFloat(process.env.EXCHANGE_RATE_ADJUSTMENT_USD_GTQ) || 0.02, // Ajuste del 2% para el tipo de cambio USD a GTQ.
    exchangeRateAdjustmentMxnUsd: parseFloat(process.env.EXCHANGE_RATE_ADJUSTMENT_MXN_USD) || 0.002, // Ajuste del 0.2% para el tipo de cambio MXN a USD.
    foreignExchangeManagementExpense: parseFloat(process.env.FOREIGN_EXCHANGE_MANAGEMENT_EXPENSE) || 0.04 // 4% Gasto de gestión de cambio extranjero.
};

 
/**
 * Tasas para calcular el precio del producto
 * @param {string} productCategoryId
 */
async function ratesForCalculatingPrice(productCategoryId) {
    // Obtener el tipo de cambio antes de procesar los detalles
    const exchangeData = await getExchangeRate();
  
    // Obtener los tipos de cambio base desde el resultado de getExchangeRate()
    const mxn_usd = exchangeData.exchange_rate_mxn_usd;
    const usd_gtq = exchangeData.exchange_rate_usd_gtq;

    // Calcular el tipo de cambio ajustado
    const mxn_usd_adjusted = mxn_usd ? (mxn_usd - defaultValues.exchangeRateAdjustmentMxnUsd) : null;
    const usd_gtq_adjusted = usd_gtq ? (usd_gtq * (1 + defaultValues.exchangeRateAdjustmentUsdGTQ)) : null;

    const rate = (mxn_usd_adjusted && usd_gtq_adjusted && defaultValues.foreignExchangeManagementExpense) 
                ? ( mxn_usd_adjusted * usd_gtq_adjusted * (1 + defaultValues.foreignExchangeManagementExpense))
                : 0.60;

    console.log(`Tipo de cambio ajustado calculado: ${rate.toFixed(4)} GTQ por MXN`); 
    
    let categoryRates = null;
    if (productCategoryId) {
        categoryRates = await sacModel.findCategoryById(productCategoryId);
    }
    

    let result = {
        rate, 
        mxn_usd_adjusted, 
        usd_gtq_adjusted,
        foreignExchangeManagementExpense: defaultValues.foreignExchangeManagementExpense,
        comissionRate: defaultValues.comissionRate,
        insuranceCommission: defaultValues.insuranceCommission,
        importDutyRate: categoryRates !== null ? categoryRates.dai_rate : defaultValues.importDutyRate,
        valueAddedRate: categoryRates !== null ? categoryRates.iva_rate : defaultValues.valueAddedRate
    };
    return result;
}

module.exports = { ratesForCalculatingPrice };