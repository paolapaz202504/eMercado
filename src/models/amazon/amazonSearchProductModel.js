const path = require('path');
const crypto = require('crypto');
const amazonPricingRatesModel = require('./amazonPricingRatesModel');
const localCacheTool = require('../tools/localCacheTool');
const amazonApiTool = require('./amazonApiTool');
const envTool = require('../tools/envTool');

/**
 * Clase con responsabilidad única: Buscar productos en Amazon.
 */
class AmazonSearchProductModel {
  constructor() {
    this.searchBaseUrl = envTool.getString('AMAZON_API_SEARCH_URL');
    this.cacheDir = path.join(__dirname, '../../../cache/aws_mx/search');
    this.cacheMinutes = envTool.getInt('AMAZON_SEARCH_PRODUCT_CACHE_MINUTE_TIME', 10);
  }

  async searchProducts(searchQuery, page = 1, sortBy = 'RELEVANCE') {
    const cacheFile = this._getCacheFilePath(searchQuery, page, sortBy);

    // 1. Revisar caché
    const cachedResult = localCacheTool.read(cacheFile, this.cacheMinutes, 'result');
    if (cachedResult) {
      console.log(`📦 Retornando búsqueda '${searchQuery}' (Página: ${page}, Orden: ${sortBy}) desde caché local...`);
      return cachedResult;
    }
    
    console.log(`⏱️ El caché de '${searchQuery}' ha expirado o no existe. Se actualizará...`);

    // 2. Obtener y procesar productos de la API
    const productsData = await this._fetchAndProcessProducts(searchQuery, page, sortBy);

    // 3. Guardar en caché y retornar
    localCacheTool.write(this.cacheDir, cacheFile, productsData, 'result');
    return productsData;
  }

  _getCacheFilePath(searchQuery, page, sortBy) {
    const urlStr = `${this.searchBaseUrl}&query=${searchQuery}&page=${page}&sort_by=${sortBy}`;
    const hash = crypto.createHash('md5').update(urlStr).digest('hex');
    return path.join(this.cacheDir, `${hash}.json`);
  }

  async _fetchAndProcessProducts(searchQuery, page, sortBy) {
    console.log(`🌐 Consultando búsqueda '${searchQuery}' en la API de Amazon (Página: ${page}, Orden: ${sortBy})...`);
    const url = `${this.searchBaseUrl}&query=${encodeURIComponent(searchQuery)}&page=${page}&sort_by=${sortBy}`;
    
    const rateData = await amazonPricingRatesModel.getPricingRates();
    const data = await amazonApiTool.fetch(url);
    
    let productsList = this._extractProductsList(data);
    
    // Retornamos estrictamente los primeros 25 registros
    if (Array.isArray(productsList)) {
      productsList = productsList.slice(0, 25);
    }

    return this._applyPricingToProducts(productsList, rateData);
  }

  _extractProductsList(apiData) {
    return apiData.data && apiData.data.products ? apiData.data.products : apiData; 
  }

  _applyPricingToProducts(productsData, rateData) {
    if (!Array.isArray(productsData)) return productsData;
    return productsData.map(prod => amazonPricingRatesModel.applyPricingRules(prod, rateData));
  }
}

module.exports = AmazonSearchProductModel;