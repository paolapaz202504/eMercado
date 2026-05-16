/**
 * Herramienta para obtener la fecha y hora actual en la zona horaria de Guatemala.
 */
function getGuatemalaTime() {
  // Convertimos la hora actual a la hora local de Guatemala
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Guatemala" }));
  const pad = (n) => n.toString().padStart(2, '0');
  const datePart = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const timePart = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const fileDate = `${pad(d.getDate())}_${pad(d.getMonth() + 1)}_${d.getFullYear()}`;
  return { full: `${datePart} ${timePart}`, dateOnly: datePart, fileDate };
}

exports.getGuatemalaTime = getGuatemalaTime;