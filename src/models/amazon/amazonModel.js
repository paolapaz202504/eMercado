const AmazonSearchProductModel = require('./amazonSearchProductModel');
const AmazonProductDetailModel = require('./amazonProductDetailModel');

/**
 * Modelo para interactuar con la información de Amazon México.
 * Implementa el patrón Singleton exportando una instancia de la clase.
 * Actúa como orquestador (Facade) y centraliza la lógica común.
 */
class AmazonModel {
  constructor() {
    // Instanciar submódulos sin necesidad de inyectar variables globales
    this.searchProductModel = new AmazonSearchProductModel();
    this.productDetailModel = new AmazonProductDetailModel();
  }

  async searchProducts(searchQuery) {
    return await this.searchProductModel.searchProducts(searchQuery);
  }

  async getProductDetails(asin) {
    return await this.productDetailModel.getProductDetails(asin);
  }
}

// Exportamos una única instancia (Singleton)
module.exports = new AmazonModel();