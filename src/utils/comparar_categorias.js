const fs = require('fs');
const path = require('path');

// Asegúrate de que las rutas coincidan con la ubicación real de tus archivos
const categoriesPath = path.join(__dirname, '../../cache/aws_mx/categories.json');
const daiPath = path.join(__dirname, '../../cache/gt/dai.json'); 

try {
    // Leemos los archivos
    const categoriesData = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
    const daiData = JSON.parse(fs.readFileSync(daiPath, 'utf8'));

    // Asumimos que dai.json es un arreglo de objetos que tienen un atributo "id" (igual que categories.json)
    // Si la estructura de tu dai.json es diferente, deberás ajustar la siguiente línea:
    const daiCategoryIds = daiData.categories.map(item => item.id);

    // Filtramos las categorías
    const categoriasConDai = categoriesData.categories.filter(c => daiCategoryIds.includes(c.id));
    const categoriasSinDai = categoriesData.categories.filter(c => !daiCategoryIds.includes(c.id));

    console.log('===================================================');
    console.log(`Total de categorías en Amazon México: ${categoriesData.categories.length}`);
    console.log(`Total de categorías registradas en DAI: ${daiData.categories.length}`);
    console.log('===================================================\n');

    console.log(`✅ CATEGORÍAS QUE SÍ ESTÁN EN DAI (${categoriasConDai.length}):`);
    categoriasConDai.forEach(c => console.log(`   - [${c.id}] ${c.name}`));

    console.log(`\n❌ CATEGORÍAS QUE FALTAN EN DAI (${categoriasSinDai.length}):`);
    categoriasSinDai.forEach(c => console.log(`   - [${c.id}] ${c.name}`));

} catch (error) {
    console.error('Ocurrió un error al intentar leer o comparar los archivos:', error.message);
}
