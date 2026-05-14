const fs = require('fs');
const path = require('path');
const { getExchangeRate } = require('./exchangeModel');

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
  const rateData = await getRateCalculated();
  
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
      let insuranceValue= basePriceGTQ * rateData.insuranceCommission;
      let commissionValue = basePriceGTQ * rateData.comissionRate;
      
      let importDutyValue = basePriceGTQ * rateData.importDutyRate;
      let valueAddedValue = (basePriceGTQ+importDutyValue) * rateData.valueAddedRate;

      let productPrice = basePriceGTQ + insuranceValue + commissionValue + importDutyValue + valueAddedValue; 
      
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
 * Función auxiliar para obtener la fecha y hora actual en la zona horaria de Guatemala
 */
function getGuatemalaTime() {
  // Convertimos la hora actual a la hora local de Guatemala
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Guatemala" }));
  const pad = (n) => n.toString().padStart(2, '0');
  const datePart = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const timePart = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return { full: `${datePart} ${timePart}`, dateOnly: datePart };
}

/**
 * Obtiene la lista de categorías, utilizando caché para no saturar la API.
 */
async function getCategories() {
  // Definimos las rutas absolutas para nuestra carpeta y archivo de caché
  const cacheDir = path.join(__dirname, '../../cache/aws_mx');
  const cacheFile = path.join(cacheDir, 'categories.json');

  // 1. Verificamos si el caché existe y si es del día de hoy
  if (fs.existsSync(cacheFile)) {
    try {
      const cacheData = fs.readFileSync(cacheFile, 'utf8');
      const parsedCache = JSON.parse(cacheData);
      
      // Verificamos que tenga la nueva estructura
      if (parsedCache.created_at && parsedCache.categories) {
        const cacheDatePart = parsedCache.created_at.split(' ')[0]; // Extrae solo el "dd/mm/yyyy"
        const gtNow = getGuatemalaTime();

        if (cacheDatePart === gtNow.dateOnly) {
          console.log('📦 Retornando categorías desde el caché local...');
          return parsedCache.categories;
        }
      }
    } catch (error) {
      console.log('⚠️ Error al leer el formato del caché. Se actualizará.');
    }
  }

  // 2. Si no hay caché o no es de hoy, consultamos la API
  console.log('🌐 Consultando categorías desde la API de Amazon...');
  const apiKey = process.env.AMAZON_API_KEY;
  const apiHost = process.env.AMAZON_API_HOST;
  const url = process.env.AMAZON_API_CATEGORIES_URL;

  const options = {
    method: 'GET',
    headers: {
      'x-rapidapi-host': apiHost,
      'x-rapidapi-key': apiKey
    }
  };

  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error de la API (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const categoriesData = data.data || data;
  
  // 3. Guardamos el resultado en caché creando las carpetas si no existen
  const gtNow = getGuatemalaTime();
  const cacheContent = {
    created_at: gtNow.full,
    categories: categoriesData
  };

  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(cacheContent, null, 2));

  return categoriesData;
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
  
  // Obtener el la tasa de cambio calculada antes de procesar los detalles
  const rateData = await getRateCalculated();
  
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
  productData.exchange_rate_mxn_usd = rateData.mxn_usd_adjusted;
  productData.exchange_rate_usd_gtq = rateData.usd_gtq_adjusted;
  productData.foreign_exchange_management_expense = rateData.foreignExchangeManagementExpense;
  productData.comission_rate = rateData.comissionRate;
  productData.insurrance_commission = rateData.insuranceCommission;
  productData.import_duty_rate = rateData.importDutyRate;
  productData.value_added_rate = rateData.valueAddedRate;
  productData.exchange_rate_gt_mx = rateData.rate;

  let basePriceGTQ = parsedPrice ? parsedPrice * rateData.rate : null;
  let insuranceValue= basePriceGTQ * rateData.insuranceCommission;
  let commissionValue = basePriceGTQ * rateData.comissionRate;
  
  let importDutyValue = basePriceGTQ * rateData.importDutyRate;
  let valueAddedValue = (basePriceGTQ+importDutyValue) * rateData.valueAddedRate;

  let productPrice = basePriceGTQ + insuranceValue + commissionValue + importDutyValue + valueAddedValue; 
  
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

async function getRateCalculated() {
  // Obtener el tipo de cambio antes de procesar los detalles
  const exchangeData = await getExchangeRate();
  
  // comisión por seguro en el manejo de posibles devoluciones, daños o pérdidas en el proceso de compra internacional (10%)
  const insuranceCommission = parseFloat(process.env.INSURANCE_COMMISSION) || 0.10;

  // Comisión por servicio de compras internacionales
  const comissionRate = parseFloat(process.env.COMMISSION_PERCENTAGE) || 0.10;

  // Arbitraje de divisas: MXN -> USD -> GTQ + Gasto de Gestión (4%)
  const exchangeRateAdjustmentUsdGTQ = parseFloat(process.env.EXCHANGE_RATE_ADJUSTMENT_USD_GTQ) || 0.02;
  const exchangeRateAdjustmentMxnUsd = parseFloat(process.env.EXCHANGE_RATE_ADJUSTMENT_MXN_USD) || 0.002;

  // Obtener los tipos de cambio base desde el resultado de getExchangeRate()
  const mxn_usd = exchangeData.exchange_rate_mxn_usd;
  const usd_gtq = exchangeData.exchange_rate_usd_gtq;
  
  // Calcular el tipo de cambio ajustado
  const mxn_usd_adjusted = mxn_usd ? (mxn_usd - exchangeRateAdjustmentMxnUsd) : null;
  const usd_gtq_adjusted = usd_gtq ? (usd_gtq * (1 + exchangeRateAdjustmentUsdGTQ)) : null;
  
  // Obtenemos el gasto de gestión y la comisión para calcular el tipo de cambio final ajustado
  const foreignExchangeManagementExpense = parseFloat(process.env.FOREIGN_EXCHANGE_MANAGEMENT_EXPENSE) || 0.04;

  // Obtener tasa de DAI e IVA.
  const importDutyRate = parseFloat(process.env.IMPORT_DUTY_RATE) || 0.15; // DAI del 15%
  const valueAddedRate = parseFloat(process.env.VALUE_ADDED_RATE) || 0.138; // IVA del 13.8%
  
  const rate = (mxn_usd_adjusted && usd_gtq_adjusted && foreignExchangeManagementExpense 
                //&& comissionRate && insuranceCommission
                //&& importDutyRate && valueAddedRate
                ) 
                ? 
                ( mxn_usd_adjusted * usd_gtq_adjusted * (1 + foreignExchangeManagementExpense) 
                  //* (1 + comissionRate) * (1 + insuranceCommission) 
                  //* (1 + importDutyRate) * (1 + valueAddedRate) 
                  )
                : 
                0.60;

  console.log(`Tipo de cambio ajustado calculado: ${rate.toFixed(4)} GTQ por MXN`); 

  return {
    rate, 
    mxn_usd_adjusted, 
    usd_gtq_adjusted,
    foreignExchangeManagementExpense,
    comissionRate,
    insuranceCommission,
    importDutyRate,
    valueAddedRate
  };
}

module.exports = { searchProducts, getCategories, getProductDetails };