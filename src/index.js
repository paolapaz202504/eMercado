require('dotenv').config();
const express = require('express');
const path = require('path');

// Importar rutas
const priceRoutes = require('./routes/priceRoutes');
const amazonRoutes = require('./routes/amazonRoutes');

const app = express();

// Definir el puerto (útil para despliegues en la nube)
const PORT = process.env.PORT || 3000;

// Middleware para poder recibir y parsear JSON en el cuerpo de las peticiones
app.use(express.json());

// Configurar la carpeta "public" para servir archivos estáticos (HTML, CSS, JS frontend)
app.use(express.static(path.join(__dirname, '../public')));

// Usar las rutas integradas
app.use('/api', priceRoutes);
app.use('/api/amazon', amazonRoutes);

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});
