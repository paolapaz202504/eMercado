/**
 * Herramienta para gestionar y parsear de forma segura las variables de entorno.
 */
class EnvTool {
  /**
   * Obtiene un valor numérico decimal (float) desde las variables de entorno.
   */
  getFloat(envKey, defaultValue) {
    const envValue = process.env[envKey];
    if (envValue === undefined || envValue === null || envValue === '') return defaultValue;
    const parsed = parseFloat(envValue);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Obtiene un valor numérico entero (int) desde las variables de entorno.
   */
  getInt(envKey, defaultValue) {
    const envValue = process.env[envKey];
    if (envValue === undefined || envValue === null || envValue === '') return defaultValue;
    const parsed = parseInt(envValue, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Obtiene una cadena de texto (string) desde las variables de entorno.
   */
  getString(envKey, defaultValue = '') {
    const envValue = process.env[envKey];
    // Para cadenas, a veces un valor vacío explícito podría ser intencional, 
    // pero en este contexto lo tratamos como faltante para usar el valor por defecto.
    if (envValue === undefined || envValue === null || envValue === '') return defaultValue;
    return envValue;
  }
}

// Exportamos una instancia única (Singleton)
module.exports = new EnvTool();