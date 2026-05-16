const path = require('path');
const amazonPricingRatesModel = require('./amazonPricingRatesModel');
const localCacheTool = require('../tools/localCacheTool');
const amazonApiTool = require('./amazonApiTool');

/**
 * Clase con responsabilidad única: Buscar productos en Amazon.
 */
class AmazonSearchProductModel {
  constructor() {
    this.searchBaseUrl = process.env.AMAZON_API_SEARCH_URL;
    this.cacheDir = path.join(__dirname, '../../../cache/aws_mx/search');
    this.cacheMinutes = parseInt(process.env.AMAZON_SEARCH_PRODUCT_CACHE_MINUTE_TIME, 10) || 10;
  }

  async searchProducts(searchQuery) {
    const cacheFile = this._getCacheFilePath(searchQuery);

    // 1. Revisar caché
    const cachedResult = localCacheTool.read(cacheFile, this.cacheMinutes, 'result');
    if (cachedResult) {
      console.log(`📦 Retornando búsqueda '${searchQuery}' desde caché local...`);
      return cachedResult;
    }
    
    console.log(`⏱️ El caché de '${searchQuery}' ha expirado o no existe. Se actualizará...`);

    // 2. Obtener y procesar productos de la API
    const productsData = await this._fetchAndProcessProducts(searchQuery);

    // 3. Guardar en caché y retornar
    localCacheTool.write(this.cacheDir, cacheFile, productsData, 'result');
    return productsData;
  }

  _getCacheFilePath(searchQuery) {
    const safeQuery = searchQuery.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return path.join(this.cacheDir, `${safeQuery}.json`);
  }

  async _fetchAndProcessProducts(searchQuery) {
    console.log(`🌐 Consultando búsqueda '${searchQuery}' en la API de Amazon...`);
    const url = `${this.searchBaseUrl}&query=${encodeURIComponent(searchQuery)}`;
    
    const rateData = await amazonPricingRatesModel.getPricingRates();
    const data = await amazonApiTool.fetch(url);
    
    const productsList = this._extractProductsList(data);
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