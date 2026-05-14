const fs = require('fs');
const path = require('path');
const { getGuatemalaTime } = require('../utils/timeUtils');
// Variable global para almacenar las categorías en memoria RAM
let memoryCachedCategories = null;
let cacheDatePart = null;

/**
 * Obtiene la lista de categorías, utilizando caché para no saturar la API.
 */
async function getCategories() {
  let gtNow = getGuatemalaTime();
  if (cacheDatePart === gtNow.dateOnly && memoryCachedCategories !== null) {
    console.log('🧠 Retornando categorías desde memoria RAM...');
    return memoryCachedCategories;
  }
  

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
        cacheDatePart = parsedCache.created_at.split(' ')[0]; // Extrae solo el "dd/mm/yyyy"
        memoryCachedCategories = parsedCache.categories;
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
  gtNow = getGuatemalaTime();
  const cacheContent = {
    created_at: gtNow.full,
    categories: categoriesData
  };

  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(cacheContent, null, 2));

  memoryCachedCategories = categoriesData;
  cacheDatePart = gtNow.dateOnly;

  return categoriesData;
}


async function findCategoryById(productCategoryId) {
    // Obtenemos todas las categorías (desde memoria RAM o disco)
    const categoriesData = await getCategories();
    
    if (!categoriesData || !categoriesData.categories) {
        console.log('⚠️ No se encontraron categorías para buscar.');
        return null;
    }

    // Buscamos la categoría ya sea por su ID exacto o por su nombre (ignorando mayúsculas/minúsculas)
    const searchParam = productCategoryId.toString().toLowerCase().trim();
    const foundCategory = categoriesData.categories.find(
        cat => cat.id.toLowerCase() === searchParam
    );

    // Retornamos el objeto de la categoría si la encontró, de lo contrario null
    return foundCategory || null;
}

module.exports = { getCategories, findCategoryById }; 