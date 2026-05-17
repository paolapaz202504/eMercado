const path = require('path');
const { getGuatemalaTime } = require('./timeTool');
const localCacheTool = require('./localCacheTool');
const envTool = require('./envTool');

/**
 * Herramienta con responsabilidad única: Obtener y gestionar el tipo de cambio.
 */
class ExchangeTool {
  constructor() {
    // Configuraciones de APIs externas
    this.urlMxn = envTool.getString('EXCHANGE_RATE_GT_MX', 'https://open.er-api.com/v6/latest/MXN');
    this.urlUsd = envTool.getString('EXCHANGE_RATE_USD_BASE', 'https://open.er-api.com/v6/latest/USD');
    this.bankName = envTool.getString('EXCHANGE_RATE_BANK', 'API de Referencia');
    
    // Directorio de caché
    this.cacheDir = path.join(__dirname, '../../../cache/exchange_rate/gt_mx');
  }

  /**
   * Obtiene el tipo de cambio del día utilizando caché basado en archivo.
   */
  async getExchangeRate() {
    const gtTime = getGuatemalaTime();
    const cacheFile = path.join(this.cacheDir, `${gtTime.fileDate}.json`);

    // 1. Revisar caché en disco
    const cachedResult = localCacheTool.read(cacheFile, null, 'exchange_data', true);
    if (cachedResult) {
      console.log(`📦 Retornando tipo de cambio desde caché local (${gtTime.fileDate}.json)...`);
      return cachedResult;
    }

    // 2. Si no hay caché, consultar las APIs de tipo de cambio
    const exchangeData = await this._fetchExchangeRates();

    // 3. Formatear el resultado
    const result = {
      exchange_rate_mxn_usd: exchangeData.mxnToUsd,
      exchange_rate_usd_gtq: exchangeData.usdToGtq,
      bank: this.bankName
    };

    // 4. Guardar en caché y retornar
    localCacheTool.write(this.cacheDir, cacheFile, result, 'exchange_data');
    return {
      created_at: gtTime.full,
      ...result
    };
  }

  // =========================================================
  // MÉTODOS PRIVADOS (Auxiliares)
  // =========================================================

  async _fetchExchangeRates() {
    console.log('🌐 Consultando tipo de cambio a la institución bancaria...');
    try {
      const dataMxn = await this._fetchWithRetry(this.urlMxn);
      const mxnToUsd = dataMxn.rates && dataMxn.rates.USD;
      
      const dataUsd = await this._fetchWithRetry(this.urlUsd);
      const usdToGtq = dataUsd.rates && dataUsd.rates.GTQ;
      
      if (!mxnToUsd || !usdToGtq) throw new Error('Respuesta de la API de tipo de cambio inválida.');
      return { mxnToUsd, usdToGtq };
    } catch (error) {
      throw new Error('No se pudo obtener el tipo de cambio. Por favor, intente de nuevo más tarde.');
    }
  }

  async _fetchWithRetry(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url);
        if (response.ok) return await response.json();
        console.log(`⚠️ Error al consultar ${url} (Status: ${response.status}). Intento ${i + 1} de ${retries}...`);
      } catch (error) {
        console.log(`⚠️ Error de red al consultar ${url}. Intento ${i + 1} de ${retries}...`);
      }
      if (i < retries - 1) await new Promise(res => setTimeout(res, 1000));
    }
    throw new Error(`No se pudo conectar a la API después de ${retries} intentos.`);
  }
}

// Exportamos una instancia única (Singleton)
module.exports = new ExchangeTool();