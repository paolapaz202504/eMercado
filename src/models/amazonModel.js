const fs = require('fs');
const path = require('path');

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
  const productsData = data.data && data.data.products ? data.data.products : data; 

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
  const apiKey = process.env.AMAZON_API_KEY;
  const apiHost = process.env.AMAZON_API_HOST;
  const url = `${process.env.AMAZON_API_DETAILS_URL}&asin=${asin}`;

  const options = { method: 'GET', headers: { 'x-rapidapi-host': apiHost, 'x-rapidapi-key': apiKey } };
  const response = await fetch(url, options);
  
  if (!response.ok) throw new Error(`Error de la API (${response.status})`);

  const data = await response.json();
  const productData = data.data || data; 

  // 3. Guardar en caché
  const gtNow = getGuatemalaTime();
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify({ created_at: gtNow.full, result: productData }, null, 2));

  return productData;
}

module.exports = { searchProducts, getCategories, getProductDetails };