const path = require('path');
const { getGuatemalaTime } = require('./timeTool');
const localCacheTool = require('./localCacheTool');

class SacTool {
    constructor() {
        // Estado en memoria
        this.memoryCache = null;
        this.cacheDate = null;
        // Ruta absoluta al archivo
        this.sacFilePath = path.join(__dirname, '../../../cache/gt/sac.json');
    }

    /**
     * Carga las categorías SAC desde el disco a la memoria.
     * Solo realiza lectura de disco la primera vez del día.
     * @returns {Array|null}
     */
    async loadSacCategories() {
        const gtNow = getGuatemalaTime();
        
        const memoryData = this._getFromMemory(gtNow.dateOnly);
        if (memoryData) return memoryData;

        return this._getFromDisk(gtNow.dateOnly);
    }

    /**
     * Busca una categoría en el archivo SAC por su ID.
     * @param {string} categoryId 
     * @returns {Object|null}
     */
    async findCategoryById(categoryId) {
        if (!categoryId) return null;

        const categories = await this.loadSacCategories();

        if (!categories) return null;

        const searchParam = categoryId.toString().toLowerCase().trim();
        return categories.find(cat => cat.id.toLowerCase() === searchParam) || null;
    }

    // =========================================================
    // MÉTODOS PRIVADOS (Auxiliares)
    // =========================================================

    _getFromMemory(currentDate) {
        if (this.cacheDate === currentDate && this.memoryCache) {
            console.log('🧠 Retornando categorías SAC desde memoria RAM...');
            return this.memoryCache;
        }
        return null;
    }

    _getFromDisk(currentDate) {
        // Utilizamos localCacheTool ignorando la fecha de creación para leer el archivo estático
        const parsedCategories = localCacheTool.read(this.sacFilePath, null, 'categories', false);
        
        if (parsedCategories) {
            console.log('📦 Leyendo categorías SAC desde archivo local y actualizando memoria...');
            this.memoryCache = parsedCategories;
            this.cacheDate = currentDate;
            return this.memoryCache;
        }
        
        console.warn('⚠️ El archivo SAC no contiene el atributo "categories" o no existe en la ruta.');
        return null;
    }
}

// Exportamos una instancia única (Singleton) para compartir el estado de memoria en toda la app
module.exports = new SacTool();