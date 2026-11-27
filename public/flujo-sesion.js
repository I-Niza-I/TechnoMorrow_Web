// El estado de navegación no es una autorización de Firebase. No contiene tokens.
export const uuidValido = id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
const clave = id => `technomorrow.reserva.${id}`;
export function guardarReserva(r) {
  if (!uuidValido(r.id)) throw new Error('ID de reserva inválido.');
  sessionStorage.setItem(clave(r.id), JSON.stringify(r));
}
export function leerReserva(id) {
  if (!uuidValido(id)) return null;
  try { const r = JSON.parse(sessionStorage.getItem(clave(id))); return r?.id === id ? r : null; }
  catch { return null; }
}
export const idDesdeURL = () => new URLSearchParams(location.search).get('reserva');
export const urlReserva = (pagina, id) => `./${pagina}?reserva=${encodeURIComponent(id)}`;
export const segundosValidos = s => [30,45,60].includes(s);
export const calificacionValida = n => Number.isFinite(n) && n >= 0.5 && n <= 5 && Number.isInteger(n*2);
export function formatoFin(ms) {
  const fecha = new Date(ms);
  if (!Number.isFinite(fecha.getTime())) throw new Error('Hora de fin inválida.');
  return {
    hora: new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(fecha),
    fecha: new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',day:'numeric',month:'long',year:'numeric'}).format(fecha)
  };
}
export const mismoActivo = (datos,r) => datos?.estado === 'activo' && datos.id === r.id && datos.segundos === r.segundos && Number.isSafeInteger(datos.vence) && datos.vence > 0;
export const segundosRestantes = (vence, ahora) => Math.max(0, Math.min(30,Math.ceil((vence-ahora)/1000)));
export function finHistorial(datos,r) {
  const idTotem = {'TOT-001':'T01','TOT-002':'T02'}[r.codigo];
  if (!datos || datos.id_usuario !== r.uid || datos.id_totem !== idTotem || datos.duracion_segundos !== r.segundos || !['activa','finalizada'].includes(datos.estado)) return null;
  const ms = datos.fecha_hora_fin?.toMillis?.();
  return Number.isSafeInteger(ms) && ms > 0 ? ms : null;
}
