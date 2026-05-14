const fs = require('fs');
const path = require('path');
const { getGuatemalaTime } = require('../utils/timeUtils');
const {ratesForCalculatingPrice} = require('./ratesForCalculatingPriceModel');  

/**
 * Modelo para interactuar con la información de Amazon México.
 * Utiliza Real-Time Amazon Data API (RapidAPI) como proveedor de los datos.
 */
async function searchProducts(searchQuery) {
  const cacheDir = path.join(__dirname, '../../cache/aws_mx/search');
  // Limpiamos el texto buscado para que sea un nombre de archivo válido
  const safeQuery = searchQuery.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const cacheFile = path.join(cacheDir, `${safeQuery}.json`);

  // 1. Verificar si el caché de la búsqueda existe y es de hoy
  if (fs.existsSync(cacheFile)) {
    try {
      const cacheData = fs.readFileSync(cacheFile, 'utf8');
      const parsedCache = JSON.parse(cacheData);
      
      if (parsedCache.create_at && parsedCache.result) {
        const cacheDatePart = parsedCache.create_at.split(' ')[0];
        const gtNow = getGuatemalaTime();

        if (cacheDatePart === gtNow.dateOnly) {
          console.log(`📦 Retornando búsqueda '${searchQuery}' desde caché local...`);
          return parsedCache.result;
        }
      }
    } catch (error) {
      console.log('⚠️ Error al leer el caché de búsqueda. Se consultará de nuevo.');
    }
  }

  // 2. Si no hay caché válido, buscar en la API
  console.log(`🌐 Consultando búsqueda '${searchQuery}' en la API de Amazon...`);
  
  // Obtener el la tasa de cambio calculada antes de procesar los detalles
  const rateData = await ratesForCalculatingPrice();
  
  const apiKey = process.env.AMAZON_API_KEY;
  const apiHost = process.env.AMAZON_API_HOST;
  const searchBaseUrl = process.env.AMAZON_API_SEARCH_URL;
  
  const url = `${searchBaseUrl}&query=${encodeURIComponent(searchQuery)}`;

  const options = { method: 'GET', headers: { 'x-rapidapi-host': apiHost, 'x-rapidapi-key': apiKey } };

  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error de la API (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  let productsData = data.data && data.data.products ? data.data.products : data; 

  // Calcular los precios en Quetzales usando el tipo de cambio
  if (Array.isArray(productsData)) {
    productsData = productsData.map(prod => {
      let parsedPrice = 0;
      if (prod.product_price) {
        const match = prod.product_price.toString().match(/[\d,.]+/);
        if (match) parsedPrice = parseFloat(match[0].replace(/,/g, ''));
      }
      let basePriceGTQ = parsedPrice ? parsedPrice * rateData.rate : null;
      let insuranceValue = basePriceGTQ ? basePriceGTQ * rateData.insuranceCommission : null;
      let commissionValue = basePriceGTQ ? basePriceGTQ * rateData.comissionRate : null;
      
      let importDutyValue = basePriceGTQ ? basePriceGTQ * rateData.importDutyRate : null;
      let valueAddedValue = basePriceGTQ ? (basePriceGTQ+importDutyValue) * rateData.valueAddedRate : null;

      let productPrice = basePriceGTQ ? basePriceGTQ + insuranceValue + commissionValue + importDutyValue + valueAddedValue : null; 
      
      console.log('---------------------------------------------');
      console.log(`Producto: ${prod.product_title}`);
      console.log(`Precio en Quetzales (GTQ): ${basePriceGTQ} `);
      console.log(`Valor de seguros (GTQ): ${insuranceValue} `);
      console.log(`Valor de comisión (GTQ): ${commissionValue} `);
      console.log(`Valor de derechos de importación (GTQ): ${importDutyValue} `);
      console.log(`Valor de IVA (GTQ): ${valueAddedValue} `);
      console.log(`Precio total (GTQ): ${productPrice} `);

      return {
        ...prod,
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
    });
  }

  // 3. Guardar el resultado en caché con el formato solicitado
  const gtNow = getGuatemalaTime();
  const cacheContent = {
    create_at: gtNow.full,
    result: productsData
  };

  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(cacheContent, null, 2));

  return productsData;
}


/**
 * Obtiene los detalles específicos de un producto por su ASIN (incluyendo stock y peso).
 */
async function getProductDetails(asin) {
  const cacheDir = path.join(__dirname, '../../cache/aws_mx/details');
  const cacheFile = path.join(cacheDir, `${asin}.json`);

  // 1. Verificamos si existe en caché el detalle de este ASIN para el día de hoy
  if (fs.existsSync(cacheFile)) {
    try {
      const cacheData = fs.readFileSync(cacheFile, 'utf8');
      const parsedCache = JSON.parse(cacheData);
      if (parsedCache.created_at && parsedCache.result) {
        const cacheDatePart = parsedCache.created_at.split(' ')[0];
        const gtNow = getGuatemalaTime();
        if (cacheDatePart === gtNow.dateOnly) {
          return parsedCache.result;
        }
      }
    } catch (error) {
      console.log('⚠️ Error al leer el caché de detalles.');
    }
  }

  // 2. Si no hay caché válido, se consulta a la API
  
  
  const apiKey = process.env.AMAZON_API_KEY;
  const apiHost = process.env.AMAZON_API_HOST;
  const url = `${process.env.AMAZON_API_DETAILS_URL}&asin=${asin}`;

  const options = { method: 'GET', headers: { 'x-rapidapi-host': apiHost, 'x-rapidapi-key': apiKey } };
  const response = await fetch(url, options);
  
  if (!response.ok) throw new Error(`Error de la API (${response.status})`);

  const data = await response.json();
  let productData = data.data || data; 

  // Calcular el precio en Quetzales
  let parsedPrice = 0;
  if (productData.product_price) {
    const match = productData.product_price.toString().match(/[\d,.]+/);
    if (match) parsedPrice = parseFloat(match[0].replace(/,/g, ''));
  }

  
  // Obtener el la tasa de cambio calculada antes de procesar los detalles
  const rateData = await ratesForCalculatingPrice(productData.category.id);

  productData.exchange_rate_mxn_usd = rateData.mxn_usd_adjusted;
  productData.exchange_rate_usd_gtq = rateData.usd_gtq_adjusted;
  productData.foreign_exchange_management_expense = rateData.foreignExchangeManagementExpense;
  productData.comission_rate = rateData.comissionRate;
  productData.insurrance_commission = rateData.insuranceCommission;
  productData.import_duty_rate = rateData.importDutyRate;
  productData.value_added_rate = rateData.valueAddedRate;
  productData.exchange_rate_gt_mx = rateData.rate;

  let basePriceGTQ = parsedPrice ? parsedPrice * rateData.rate : null;
  let insuranceValue = basePriceGTQ ? basePriceGTQ * rateData.insuranceCommission : null;
  let commissionValue = basePriceGTQ ? basePriceGTQ * rateData.comissionRate : null;
  
  let importDutyValue = basePriceGTQ ? basePriceGTQ * rateData.importDutyRate : null;
  let valueAddedValue = basePriceGTQ ? (basePriceGTQ+importDutyValue) * rateData.valueAddedRate : null;

  let productPrice = basePriceGTQ ? basePriceGTQ + insuranceValue + commissionValue + importDutyValue + valueAddedValue : null; 
  
  productData.product_price_gt = productPrice;

  if (productData.product_original_price) {
    const matchOrig = productData.product_original_price.toString().match(/[\d,.]+/);
    if (matchOrig) {
      productData.product_original_price_gt = parseFloat(matchOrig[0].replace(/,/g, '')) * rateData.rate;
    }
  }

  // 3. Guardar en caché
  const gtNow = getGuatemalaTime();
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify({ created_at: gtNow.full, result: productData }, null, 2));

  return productData;
}


module.exports = { searchProducts, getProductDetails };