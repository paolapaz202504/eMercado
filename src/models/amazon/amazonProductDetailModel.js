const path = require('path');
const amazonPricingRatesModel = require('./amazonPricingRatesModel');
const localCacheTool = require('../tools/localCacheTool');
const amazonApiTool = require('./amazonApiTool');
const envTool = require('../tools/envTool');

/**
 * Clase con responsabilidad única: Obtener los detalles de un producto en Amazon.
 */
class AmazonProductDetailModel {
  constructor() {
    this.detailsBaseUrl = envTool.getString('AMAZON_API_DETAILS_URL');
    this.cacheMinutes = envTool.getInt('AMAZON_DETAILS_PRODUCT_CACHE_MINUTE_TIME', 10);
    this.cacheDir = path.join(__dirname, '../../../cache/aws_mx/details');
  }

  async getProductDetails(asin) {
    const cacheFile = this._getCacheFilePath(asin);

    // 1. Revisar caché (detalles verifican solo por día)
    const cachedResult = localCacheTool.read(cacheFile, this.cacheMinutes, 'result');
    if (cachedResult) return cachedResult;

    // 2. Obtener y procesar detalle desde la API
    const productData = await this._fetchAndProcessDetails(asin);

    // 3. Guardar en caché y retornar
    localCacheTool.write(this.cacheDir, cacheFile, productData, 'result');
    return productData;
  }

  _getCacheFilePath(asin) {
    return path.join(this.cacheDir, `${asin}.json`);
  }

  async _fetchAndProcessDetails(asin) {
    const url = `${this.detailsBaseUrl}&asin=${asin}`;
    const apiData = await amazonApiTool.fetch(url);
    
    let productData = apiData.data || apiData;
    
    const categoryId = productData.category ? productData.category.id : null;
    const rateData = await amazonPricingRatesModel.getPricingRates(categoryId);
    
    productData = amazonPricingRatesModel.applyPricingRules(productData, rateData);
    return productData;
  }
}

module.exports = AmazonProductDetailModel;