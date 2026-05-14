const fs = require('fs');
const path = require('path');
const { getGuatemalaTime } = require('./exchangeModel');

class SacModel {
    constructor() {
        // Estado en memoria
        this.memoryCachedSacCategories = null;
        this.cacheDatePart = null;
        // Ruta absoluta al archivo
        this.sacFilePath = path.join(__dirname, '../../cache/gt/sac.json');
    }

    /**
     * Carga las categorías SAC desde el disco a la memoria.
     * Solo realiza lectura de disco la primera vez del día.
     * @returns {Array|null}
     */
    async loadSacCategories() {
        const gtNow = getGuatemalaTime();
        
        // 1. Retornar desde RAM si es el mismo día y ya está cargado
        if (this.cacheDatePart === gtNow.dateOnly && this.memoryCachedSacCategories !== null) {
            console.log('🧠 Retornando categorías SAC desde memoria RAM...');
            return this.memoryCachedSacCategories;
        }

        // 2. Leer desde el disco si no está en memoria o si es un nuevo día
        if (fs.existsSync(this.sacFilePath)) {
            try {
                const fileData = fs.readFileSync(this.sacFilePath, 'utf8');
                const parsedData = JSON.parse(fileData);
                
                if (parsedData && parsedData.categories) {
                    console.log('📦 Leyendo categorías SAC desde archivo local y actualizando memoria...');
                    this.memoryCachedSacCategories = parsedData.categories;
                    this.cacheDatePart = gtNow.dateOnly;
                    return this.memoryCachedSacCategories;
                } else {
                    console.warn('⚠️ El archivo SAC no contiene el atributo "categories".');
                }
            } catch (error) {
                console.error('⚠️ Error al leer o parsear el archivo SAC:', error.message);
            }
        } else {
            console.error('⚠️ El archivo SAC no existe en la ruta:', this.sacFilePath);
        }

        return null;
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
}

// Exportamos una instancia única (Singleton) para compartir el estado de memoria en toda la app
module.exports = new SacModel();