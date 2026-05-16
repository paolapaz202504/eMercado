const fs = require('fs');
const { getGuatemalaTime } = require('./timeTool');

/**
 * Herramienta para gestionar lectura, validación y escritura de caché en archivos JSON.
 */
class LocalCacheTool {
  /**
   * Verifica y lee un archivo de caché.
   * @param {string} cacheFile - Ruta absoluta del archivo.
   * @param {number|null} expirationMinutes - Minutos de validez. Si es null, solo valida que sea de hoy.
   * @param {string} resultKey - Clave donde se almacenó la información ('result', 'categories', 'exchange_data').
   * @param {boolean} checkDate - Indica si se debe validar la fecha de creación del caché (por defecto true).
   * @returns {any|null} Retorna los datos si es válido, de lo contrario null.
   */
  read(cacheFile, expirationMinutes = null, resultKey = 'result', checkDate = true) {
    const parsedCache = this._readAndParseFile(cacheFile);

    if (!parsedCache || parsedCache[resultKey] === undefined) {
      return null;
    }

    if (!checkDate) {
      return parsedCache[resultKey];
    }

    if (!this._hasValidDate(parsedCache)) {
      return null;
    }

    if (this._isExpired(cacheFile, parsedCache, expirationMinutes)) {
      return null;
    }

    return parsedCache[resultKey];
  }

  /**
   * Guarda datos dinámicos en un archivo de caché.
   * @param {string} cacheDir - Directorio del caché.
   * @param {string} cacheFile - Ruta absoluta del archivo.
   * @param {any} data - Los datos a guardar.
   * @param {string} resultKey - Clave JSON ('result', 'categories', 'exchange_data').
   */
  write(cacheDir, cacheFile, data, resultKey = 'result') {
    const currentTime = getGuatemalaTime();
    const cacheContent = {
      create_at: currentTime.full, // Guardado doble por retrocompatibilidad
      created_at: currentTime.full,
      timestamp: Date.now(),
      [resultKey]: data
    };
    
    this._ensureDirectoryExists(cacheDir);
    
    try {
      fs.writeFileSync(cacheFile, JSON.stringify(cacheContent, null, 2));
    } catch (error) {
      console.error(`⚠️ Error al escribir el caché en ${cacheFile}:`, error.message);
    }
  }

  // =========================================================
  // MÉTODOS PRIVADOS (Auxiliares)
  // =========================================================

  _readAndParseFile(filePath) {
    if (!fs.existsSync(filePath)) return null;

    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(fileContent);
    } catch (error) {
      console.warn(`⚠️ Error al leer o parsear el caché local en ${filePath}:`, error.message);
      return null;
    }
  }

  _hasValidDate(parsedCache) {
    const createdAt = parsedCache.create_at || parsedCache.created_at;
    if (!createdAt) return false;

    const cacheDatePart = createdAt.split(' ')[0];
    const currentTime = getGuatemalaTime();

    return cacheDatePart === currentTime.dateOnly;
  }

  _isExpired(filePath, parsedCache, expirationMinutes) {
    if (expirationMinutes === null) return false;

    let cacheTimeMs = parsedCache.timestamp;
    if (!cacheTimeMs) {
      try {
        cacheTimeMs = fs.statSync(filePath).mtimeMs;
      } catch (error) {
        return true; // Si hay error al leer stats, asumimos que expiró por seguridad
      }
    }

    const diffMinutes = (Date.now() - cacheTimeMs) / (1000 * 60);
    return diffMinutes > expirationMinutes;
  }

  _ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      try {
        fs.mkdirSync(dirPath, { recursive: true });
      } catch (error) {
        console.error(`⚠️ Error al crear el directorio de caché ${dirPath}:`, error.message);
      }
    }
  }
}

module.exports = new LocalCacheTool();