const path = require('path');
const { getGuatemalaTime } = require('../tools/timeTool');
const localCacheTool = require('../tools/localCacheTool');
const amazonApiTool = require('./amazonApiTool');

/**
 * Clase con responsabilidad única: Obtener y gestionar el caché de las categorías de Amazon.
 */
class AmazonCategoryModel {
  constructor() {
    // Estado en memoria (RAM)
    this.memoryCachedCategories = null;
    this.cacheDatePart = null;

    // Configuración de API
    this.apiUrl = process.env.AMAZON_API_CATEGORIES_URL;

    // Configuraciones de caché
    this.cacheDir = path.join(__dirname, '../../../cache/aws_mx');
    this.cacheFile = path.join(this.cacheDir, 'categories.json');
  }

  async getCategories() {
    const gtNow = getGuatemalaTime();

    // 1. Revisar caché en memoria RAM
    const memoryCache = this._getFromMemoryCache(gtNow);
    if (memoryCache) return memoryCache;

    // 2. Revisar caché en disco
    const diskCache = localCacheTool.read(this.cacheFile, null, 'categories');
    if (diskCache) {
      console.log('📦 Retornando categorías desde el caché local...');
      this.cacheDatePart = gtNow.dateOnly;
      this.memoryCachedCategories = diskCache;
      return diskCache;
    }

    // 3. Consultar a la API
    console.log('🌐 Consultando categorías desde la API de Amazon...');
    const apiData = await amazonApiTool.fetch(this.apiUrl);
    const categoriesData = apiData.data || apiData;

    // 4. Guardar en caché y retornar
    localCacheTool.write(this.cacheDir, this.cacheFile, categoriesData, 'categories');
    this.memoryCachedCategories = categoriesData;
    this.cacheDatePart = gtNow.dateOnly;
    
    return categoriesData;
  }

  async findCategoryById(productCategoryId) {
    if (!productCategoryId) return null;

    const categoriesData = await this.getCategories();
    
    // Prevenir errores validando si la data es un Array directo o viene envuelto
    const categoriesList = Array.isArray(categoriesData) ? categoriesData : (categoriesData?.categories || []);

    if (!categoriesList || categoriesList.length === 0) {
      console.log('⚠️ No se encontraron categorías para buscar.');
      return null;
    }

    const searchParam = productCategoryId.toString().toLowerCase().trim();
    return categoriesList.find(cat => cat.id.toLowerCase() === searchParam) || null;
  }

  // =========================================================
  // MÉTODOS PRIVADOS (Auxiliares)
  // =========================================================

  _getFromMemoryCache(gtNow) {
    if (this.cacheDatePart === gtNow.dateOnly && this.memoryCachedCategories !== null) {
      console.log('🧠 Retornando categorías desde memoria RAM...');
      return this.memoryCachedCategories;
    }
    return null;
  }
}

// Exportamos una instancia única (Singleton)
module.exports = new AmazonCategoryModel();