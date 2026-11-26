/**
 * TechnoMorrow: lecturas de Firestore para el panel administrativo.
 * No escribe documentos ni modifica reservas, relés o usuarios.
 * Reutiliza la misma aplicación de firebase-config.js y la validación de roles.
 */
import { app, auth } from './firebase-config.js';
import { obtenerRolUsuario } from './roles.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  getDocs
} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';

const COLECCIONES = [
  'laboratorio_informatica',
  'totems',
  'usuario',
  'reservas',
  'satisfaccion',
  'eventos_hardware'
];

const ID_POR_COLECCION = {
  laboratorio_informatica: 'id_laboratorio',
  totems: 'id_totem',
  usuario: 'id_usuario',
  reservas: 'id_reserva',
  satisfaccion: 'id_satisfaccion',
  eventos_hardware: 'id_evento'
};

const ZONA_HORARIA = 'America/Santiago';

// Respeta fechas en texto (YYYY-MM-DD) y transforma Timestamp de Firestore.
function obtenerFecha(valor) {
  if (valor && typeof valor.toDate === 'function') return valor.toDate();
  if (valor instanceof Date) return valor;
  if (valor && typeof valor.seconds === 'number') {
    return new Date(valor.seconds * 1000);
  }
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(valor)) {
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }
  return null;
}

function partesChile(fecha) {
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) return null;
  const partes = new Intl.DateTimeFormat('es-CL', {
    timeZone: ZONA_HORARIA,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(fecha);
  const valor = tipo => partes.find(p => p.type === tipo)?.value;
  return {
    fecha: `${valor('year')}-${valor('month')}-${valor('day')}`,
    hora: `${valor('hour')}:${valor('minute')}`
  };
}

function fechaTexto(valor) {
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  return partesChile(obtenerFecha(valor))?.fecha || '';
}

function horaTexto(valor) {
  if (typeof valor === 'string' && /^\d{1,2}:\d{2}/.test(valor)) {
    return valor.slice(0, 5).padStart(5, '0');
  }
  return partesChile(obtenerFecha(valor))?.hora || '';
}

function normalizarDocumento(nombre, documento) {
  const datos = documento.data();
  const idCampo = ID_POR_COLECCION[nombre];
  const fila = { ...datos, [idCampo]: documento.id };

  if (nombre === 'reservas') {
    // Campos de texto del prototipo tienen prioridad. Los Timestamp son respaldo.
    const inicio = datos.fecha_hora_inicio ?? datos.inicio ?? null;
    const fin = datos.fecha_hora_fin ?? datos.fin ?? null;
    fila.fecha = fechaTexto(datos.fecha) || fechaTexto(inicio);
    fila.hora_inicio = horaTexto(datos.hora_inicio) || horaTexto(inicio);
    fila.hora_fin = horaTexto(datos.hora_fin) || horaTexto(fin);
    fila.duracion = Number(datos.duracion) || 0;
    fila.estado = String(datos.estado ?? '').trim().toLowerCase();
  }

  if (nombre === 'eventos_hardware') {
    const instante = datos.fecha_hora ?? datos.fecha_hora_evento ?? null;
    fila.fecha = fechaTexto(datos.fecha) || fechaTexto(instante);
    fila.hora = horaTexto(datos.hora) || horaTexto(instante);
    fila.duracion = Number(datos.duracion) || 0;
  }

  if (nombre === 'satisfaccion') {
    fila.calificacion = Number(datos.calificacion) || 0;
  }

  if (nombre === 'usuario') {
    fila.fecha_registro = fechaTexto(datos.fecha_registro);
  }

  return fila;
}

function esperarAutenticacion() {
  if (!auth) return Promise.reject(new Error('Firebase Authentication no está configurado.'));
  return new Promise((resolve, reject) => {
    const cancelar = onAuthStateChanged(
      auth,
      usuario => { cancelar(); resolve(usuario); },
      error => { cancelar(); reject(error); }
    );
  });
}

async function cargarColeccion(db, nombre) {
  try {
    const resultado = await getDocs(collection(db, nombre));
    return resultado.docs.map(doc => normalizarDocumento(nombre, doc));
  } catch (error) {
    console.error(`Error leyendo la colección ${nombre}:`, error);
    const detalle = new Error(`No se pudo consultar la colección «${nombre}».`);
    detalle.code = error?.code || 'unknown';
    detalle.cause = error;
    throw detalle;
  }
}

// Es la función que estadisticas-datos.js sabe consumir.
window.obtenerDatosFirebase = async function obtenerDatosFirebase() {
  if (!app || !auth) throw new Error('Firebase no está configurado correctamente.');

  const usuario = await esperarAutenticacion();
  if (!usuario) {
    const error = new Error('Debes iniciar sesión como administrador.');
    error.code = 'auth-required';
    throw error;
  }

  // La protección efectiva también la realizan las reglas de Firestore.
  const rol = await obtenerRolUsuario(usuario);
  if (rol !== 'admin') {
    const error = new Error('Esta cuenta no tiene permisos administrativos.');
    error.code = 'permission-denied';
    throw error;
  }

  const db = getFirestore(app);
  const resultados = await Promise.all(COLECCIONES.map(nombre => cargarColeccion(db, nombre)));
  return Object.fromEntries(COLECCIONES.map((nombre, indice) => [nombre, resultados[indice]]));
};