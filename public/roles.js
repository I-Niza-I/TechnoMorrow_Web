/**
 * Perfiles de TechnoMorrow.
 * El ID de cada documento en "usuario" debe ser el UID de Authentication.
 * Estas comprobaciones mejoran la navegación; los permisos efectivos son
 * responsabilidad de las reglas de Firestore y, más adelante, del backend.
 */
import { app } from './firebase-config.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';

const db = app ? getFirestore(app) : null;

export async function obtenerRolUsuario(usuarioAutenticado) {
  if (!usuarioAutenticado?.uid || !db) {
    throw new Error('perfil/sesion-no-disponible');
  }

  const referencia = doc(db, 'usuario', usuarioAutenticado.uid);
  const resultado = await getDoc(referencia);
  if (!resultado.exists()) {
    throw new Error('perfil/no-existe');
  }

  const datos = resultado.data();
  const estado = String(datos.estado ?? 'activo').trim().toLowerCase();
  if (estado !== 'activo') {
    throw new Error('perfil/inactivo');
  }

  const rol = String(datos.rol ?? '').trim().toLowerCase();
  if (rol === 'admin' || rol === 'administrador') return 'admin';
  if (rol === 'usuario' || rol === 'estudiante' || rol === 'docente') return 'usuario';
  throw new Error('perfil/rol-desconocido');
}

export function mensajeErrorPerfil(error) {
  const codigo = error?.code || error?.message || '';
  if (codigo === 'permission-denied' || codigo === 'firestore/permission-denied') {
    return 'Firestore no permite leer tu perfil. Revisa las reglas de seguridad de la colección usuario.';
  }
  if (codigo === 'perfil/no-existe') {
    return 'Tu cuenta no tiene un perfil en Firestore. Crea el documento usuario/UID con el UID exacto de Authentication.';
  }
  if (codigo === 'perfil/inactivo') {
    return 'Tu perfil está inactivo. Comunícate con el administrador.';
  }
  if (codigo === 'perfil/rol-desconocido') {
    return 'Tu perfil no tiene un rol válido. Usa admin o usuario en el campo rol.';
  }
  if (codigo === 'unavailable' || codigo === 'firestore/unavailable') {
    return 'No se pudo consultar Firestore. Comprueba tu conexión e inténtalo nuevamente.';
  }
  return 'No fue posible verificar tu perfil en Firestore. Comprueba la conexión y las reglas de seguridad.';
}
