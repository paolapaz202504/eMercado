const fs = require('fs');
const path = require('path');

/**
 * Función auxiliar para obtener la fecha y hora actual en la zona horaria de Guatemala
 * y devolver diferentes formatos útiles.
 */
function getGuatemalaTime() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Guatemala" }));
  const pad = (n) => n.toString().padStart(2, '0');
  
  const datePart = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const timePart = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const fileDate = `${pad(d.getDate())}_${pad(d.getMonth() + 1)}_${d.getFullYear()}`;
  
  return { full: `${datePart} ${timePart}`, dateOnly: datePart, fileDate };
}

/**
 * Realiza una petición con reintentos y una pausa de 1 segundo entre ellos
 */
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      console.log(`⚠️ Error al consultar ${url} (Status: ${response.status}). Intento ${i + 1} de ${retries}...`);
    } catch (error) {
      console.log(`⚠️ Error de red al consultar ${url}. Intento ${i + 1} de ${retries}...`);
    }
    // Pausa de 1 segundo antes de volver a intentar
    if (i < retries - 1) await new Promise(res => setTimeout(res, 1000));
  }
  throw new Error(`No se pudo conectar a la API después de ${retries} intentos.`);
}

/**
 * Obtiene el tipo de cambio del día, utilizando caché basado en archivo para no saturar la API del banco.
 */
async function getExchangeRate() {
  const gtTime = getGuatemalaTime();
  const cacheDir = path.join(__dirname, '../../cache/exchange_rate/gt_mx');
  const cacheFile = path.join(cacheDir, `${gtTime.fileDate}.json`);

  // 1. Verificamos si el archivo de caché de HOY (dd_mm_yyyy.json) ya existe
  if (fs.existsSync(cacheFile)) {
    try {
      const cacheData = fs.readFileSync(cacheFile, 'utf8');
      console.log(`📦 Retornando tipo de cambio desde caché local (${gtTime.fileDate}.json)...`);
      return JSON.parse(cacheData);
    } catch (error) {
      console.log('⚠️ Error al leer el caché del tipo de cambio. Se consultará la API.');
    }
  }

  // 2. Si no hay caché, consultamos el API del banco configurado
  console.log('🌐 Consultando tipo de cambio a la institución bancaria...');
  const urlMxn = process.env.EXCHANGE_RATE_GT_MX || 'https://open.er-api.com/v6/latest/MXN';
  const urlUsd = process.env.EXCHANGE_RATE_USD_BASE || 'https://open.er-api.com/v6/latest/USD';
  const bankName = process.env.EXCHANGE_RATE_BANK || 'API de Referencia';

  let mxnToUsd;
  let usdToGtq;
  
  try {
    const dataMxn = await fetchWithRetry(urlMxn);
    mxnToUsd = dataMxn.rates && dataMxn.rates.USD;
    
    const dataUsd = await fetchWithRetry(urlUsd);
    usdToGtq = dataUsd.rates && dataUsd.rates.GTQ;
    
    if (!mxnToUsd || !usdToGtq) {
      throw new Error('Respuesta de la API de tipo de cambio inválida.');
    }
  } catch (error) {
    throw new Error('No se pudo obtener el tipo de cambio. Por favor, intente de nuevo más tarde.');
  }

  // 3. Guardamos el resultado en caché con el formato exacto solicitado
  const cacheContent = {
    created_at: gtTime.full,
    exchange_rate_mxn_usd: mxnToUsd,
    exchange_rate_usd_gtq: usdToGtq,
    bank: bankName
  };

  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(cacheContent, null, 2));

  return cacheContent;
}

module.exports = { getExchangeRate, getGuatemalaTime };