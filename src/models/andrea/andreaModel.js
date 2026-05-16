class AndreaModel {
    constructor() {
        // Endpoint de Intelligent Search (el mismo motor que usa el sitio web)
        this.baseUrl =
            'https://mx.andrea.com/api/io/_v/api/intelligent-search/product_search';

        // URL base del sitio para construir enlaces a productos
        this.siteUrl = 'https://mx.andrea.com';
    }

    /**
     * Busca productos en Andrea usando Intelligent Search.
     *
     * @param {string} query - Texto a buscar.
     * @param {number} pageNumber - Página (inicia en 1).
     * @param {number} recordsPerPage - Registros por página.
     * @returns {Promise<Object>}
     */
    async searchProducts(query, pageNumber = 1, recordsPerPage = 10) {
        if (!query || !query.trim()) {
            throw new Error('Se requiere un término de búsqueda.');
        }

        // Validaciones básicas
        pageNumber = Math.max(1, parseInt(pageNumber, 10) || 1);
        recordsPerPage = Math.max(1, parseInt(recordsPerPage, 10) || 10);

        const fromIndex = (pageNumber - 1) * recordsPerPage;
        const toIndex = fromIndex + recordsPerPage - 1;

        try {
            const url = this._buildUrl(query, fromIndex, toIndex);
            const { data, headers } = await this._fetchData(url);

            const productsList = data.products || (Array.isArray(data) ? data : []);

            if (!productsList || productsList.length === 0) {
                return this._emptyResponse(fromIndex, pageNumber, recordsPerPage);
            }

            const totalRecords = this._getTotalRecords(data, headers, productsList.length);
            const productos = productsList.map((p) => this._mapProduct(p));
            const pagination = this._calculatePagination(fromIndex, productos.length, pageNumber, recordsPerPage, totalRecords);

            return { productos, pagination };
        } catch (error) {
            console.error('⚠️ Error al consultar la API de Andrea:', error.message);
            return {
                ...this._emptyResponse(0, pageNumber, recordsPerPage),
                error: error.message
            };
        }
    }

    _buildUrl(query, from, to) {
        return `${this.baseUrl}?query=${encodeURIComponent(query)}&from=${from}&to=${to}`;
    }

    async _fetchData(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error HTTP de Andrea: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return { data, headers: response.headers };
    }

    _getTotalRecords(data, headers, fallbackCount) {
        if (data.recordsFiltered) return data.recordsFiltered;

        const resourcesHeader = headers.get('resources') || headers.get('REST-Content-Range') || headers.get('rest-content-range');
        if (resourcesHeader) {
            const match = resourcesHeader.match(/\/(\d+)$/);
            if (match) return parseInt(match[1], 10);
        }
        return fallbackCount;
    }

    _mapProduct(product) {
        const firstItem = product.items?.[0] || {};
        const firstImage = firstItem.images?.[0] || {};
        const firstSeller = firstItem.sellers?.[0] || {};
        const commercialOffer = firstSeller.commertialOffer || {};

        return {
            productId: product.productId,
            productReference: product.productReference || null,
            productName: product.productName,
            brand: product.brand,
            productCode: this.extractProductCode(product.productName),
            link: product.link || (product.linkText ? `${this.siteUrl}/${product.linkText}/p` : null),
            imageUrl: firstImage.imageUrl || null,
            price: commercialOffer.Price ?? null,
            listPrice: commercialOffer.ListPrice ?? null,
            availableQuantity: commercialOffer.AvailableQuantity ?? 0,
            isAvailable: commercialOffer.IsAvailable ?? false
        };
    }

    _calculatePagination(from, count, currentPage, recordsPerPage, totalRecords) {
        return {
            from,
            to: count > 0 ? from + count - 1 : from - 1,
            currentPage,
            recordsPerPage,
            totalRecords,
            totalPages: Math.ceil(totalRecords / recordsPerPage),
            hasNextPage: currentPage * recordsPerPage < totalRecords,
            hasPreviousPage: currentPage > 1
        };
    }

    _emptyResponse(from, currentPage, recordsPerPage) {
        return {
            productos: [],
            pagination: this._calculatePagination(from, 0, currentPage, recordsPerPage, 0)
        };
    }

    /**
     * Extrae el código numérico al final del nombre del producto.
     * Ejemplo:
     * "SNEAKER NIKE PARA MUJER 95391" => "95391"
     */
    extractProductCode(productName) {
        if (!productName) return null;

        const match = productName.match(/(\d{4,})$/);
        return match ? match[1] : null;
    }
}

module.exports = new AndreaModel();

// -----------------------------------------------------------------------------
// CLI
// node src/models/andreaModel.js "zapatos nike" 1 5
// -----------------------------------------------------------------------------
if (require.main === module) {
    const args = process.argv.slice(2);

    let page = 1;
    let limit = 50;
    let queryArgs = [...args];

    if (
        queryArgs.length >= 3 &&
        !isNaN(queryArgs[queryArgs.length - 1]) &&
        !isNaN(queryArgs[queryArgs.length - 2])
    ) {
        limit = parseInt(queryArgs.pop(), 10);
        page = parseInt(queryArgs.pop(), 10);
    } else if (
        queryArgs.length >= 2 &&
        !isNaN(queryArgs[queryArgs.length - 1])
    ) {
        page = parseInt(queryArgs.pop(), 10);
    }

    const searchQuery = queryArgs.join(' ').trim();

    if (!searchQuery) {
        console.log(
            '❌ Uso:\n' +
            'node src/models/andreaModel.js "zapatos nike" 1 5'
        );
        process.exit(1);
    }

    console.log(
        `🔎 Buscando "${searchQuery}" ` +
        `(Página ${page}, ${limit} registros por página)...\n`
    );

    const model = new AndreaModel();

    model.searchProducts(searchQuery, page, limit)
        .then(({ productos, pagination, error }) => {
            if (error) {
                console.log(`❌ ${error}`);
                return;
            }

            console.log(
                `📊 Página ${pagination.currentPage} de ${pagination.totalPages}`
            );
            console.log(
                `📦 Total encontrados: ${pagination.totalRecords}`
            );
            console.log(
                `📄 Registros mostrados: ${pagination.from + 1} a ${
                    pagination.to + 1
                }\n`
            );

            if (!productos.length) {
                console.log('No se encontraron productos.');
                return;
            }

            productos.forEach((p, i) => {
                console.log(`${i + 1}. ${p.productName}`);
                console.log(`   Código: ${p.productCode}`);
                console.log(`   Marca: ${p.brand}`);
                console.log(`   Precio: ${p.price}`);
                console.log(`   Disponible: ${p.isAvailable ? 'Sí' : 'No'}`);
                console.log(`   Stock: ${p.availableQuantity}`);
                console.log(`   Imagen: ${p.imageUrl}`);
                console.log(`   URL: ${p.link}\n`);
            });
        })
        .catch((err) => {
            console.error('❌ Error inesperado:', err.message);
        });
}