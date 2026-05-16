/**
 * Herramienta genérica con Responsabilidad Única:
 * Centralizar y ejecutar peticiones seguras a la API de Amazon (RapidAPI).
 */
class AmazonApiTool {
  constructor() {
    this.apiKey = process.env.AMAZON_API_KEY;
    this.apiHost = process.env.AMAZON_API_HOST;
  }

  async fetch(url) {
    const options = {
      method: 'GET',
      headers: { 'x-rapidapi-host': this.apiHost, 'x-rapidapi-key': this.apiKey }
    };
    
    const response = await global.fetch(url, options); // Fetch global de Node.js
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error de la API de Amazon (${response.status}): ${errorText}`);
    }
    return await response.json();
  }
}

module.exports = new AmazonApiTool();