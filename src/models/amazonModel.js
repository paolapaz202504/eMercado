const fs = require('fs');
const path = require('path');

/**
 * Modelo para interactuar con la información de Amazon México.
 * Utiliza Real-Time Amazon Data API (RapidAPI) como proveedor de los datos.
 */
async function searchProducts(searchQuery) {
  const apiKey = process.env.AMAZON_API_KEY;
  const apiHost = process.env.AMAZON_API_HOST;
  const searchBaseUrl = process.env.AMAZON_API_SEARCH_URL;
  
  // Construimos la URL agregando el parámetro de búsqueda al endpoint configurado
  const url = `${searchBaseUrl}&query=${encodeURIComponent(searchQuery)}`;

  const options = {
    method: 'GET',
    headers: {
      'x-rapidapi-host': apiHost,
      'x-rapidapi-key': apiKey
    }
  };

  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      // Leemos el error como texto en caso de que la API no devuelva un JSON
      const errorText = await response.text();
      throw new Error(`Error de la API (${response.status}): ${errorText}`);
    }

    // Si todo salió bien, convertimos a JSON
    const data = await response.json();
    
    // RapidAPI suele devolver la lista dentro de data.data.products
    return data.data && data.data.products ? data.data.products : data; 
  } catch (error) {
    console.error("Error en amazonModel:", error);
    throw error;
  }
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

module.exports = { searchProducts, getCategories };