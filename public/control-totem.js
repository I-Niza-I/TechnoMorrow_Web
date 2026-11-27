import { app, auth } from './firebase-config.js';

import {
  getDatabase,
  ref,
  onValue,
  update,
  get,
  set
} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-database.js';

const db = app ? getDatabase(app) : null;

let conectado = false;
let desfase = null;

const codigos = ['TOT-001', 'TOT-002'];

if (db) {

  onValue(ref(db, '.info/connected'), s => {
    conectado = s.val() === true;
  });

  onValue(ref(db, '.info/serverTimeOffset'), s => {
    desfase = s.val();
  });

}

export const ahoraServidor = () =>
  Date.now() + (desfase ?? 0);

export const conexionLista = () => conectado && typeof desfase === 'number';

export const codigoPermitido = codigo =>
  codigos.includes(codigo);


export function observarTotem(codigo, recibir, error) {

  if (!db || !codigoPermitido(codigo)) {

    throw new Error(
      'Tótem no válido o Firebase sin configurar.'
    );

  }

  return onValue(
    ref(db, `control/${codigo}`),
    s => recibir(s.val()),
    error
  );

}


export async function solicitarReserva(codigo, segundos, opciones = {}) {

  if (
    !db ||
    !codigoPermitido(codigo) ||
    ![30, 45, 60].includes(segundos)
  ) {

    throw new Error('Código o duración inválidos.');

  }

  if (!conectado || typeof desfase !== 'number') {

    throw new Error(
      'No hay conexión con Realtime Database.'
    );

  }

  // Obtener el UID del usuario autenticado.

  const uid = auth?.currentUser?.uid;

  if (!uid) {

    throw new Error('Debes iniciar sesión.');

  }

  const id = opciones.id ?? crypto.randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
    throw new Error('Identificador de solicitud inválido.');
  }

  const vence = ahoraServidor() + 30000;
  // Guardar el plazo real antes de iniciar la escritura, para sobrevivir a una recarga.
  opciones.alPreparar?.({ id, uid, codigo, segundos, vence });


  // NUEVO:
  // Almacenar los datos de la solicitud.

  await set(
    ref(db, `solicitudes/${id}`),
    {
      uid,
      codigo,
      segundos,
      vence
    }
  );


  // Una única escritura atómica: el servidor valida el tótem y el UID.
  // Se reserva el margen máximo hasta que el backend observe la autorización.
  if (!conexionLista() || auth?.currentUser?.uid !== uid || ahoraServidor() >= vence - 5000) {
    throw new Error('La conexión o el plazo de la solicitud cambió. Inténtalo nuevamente.');
  }
  try {
    await update(ref(db), {
      [`control/${codigo}`]: { estado: 'pendiente', id, segundos, vence },
      [`bloqueos/${uid}`]: { id, codigo, fase: 'provisional', hasta: vence + segundos * 1000 + 121000 }
    });
  } catch (e) {
    // Informar conflicto de cuenta, sin revelar bloqueos de otros usuarios.
    if (auth?.currentUser?.uid === uid && conexionLista()) {
      try {
        const b = (await get(ref(db, `bloqueos/${uid}`))).val();
        const anterior = b && codigoPermitido(b.codigo) ? (await get(ref(db, `control/${b.codigo}`))).val() : null;
        if (b?.id !== id && bloqueoVigente(b, anterior, ahoraServidor())) {
          const error = new Error('Tu cuenta tiene una reserva o un período de espera vigente. Vuelve a la página de duración para consultar el tiempo restante.');
          error.code = 'bloqueo-vigente';
          throw error;
        }
      } catch (diagnostico) { if (diagnostico.code === 'bloqueo-vigente') throw diagnostico; }
    }
    throw e;
  }
  return id;
}

// Solo el titular puede consultar su bloqueo. El reloj del servidor es orientativo
// en la interfaz; las reglas de RTDB utilizan now y son la autoridad definitiva.
export function observarBloqueo(uid, recibir, error) {
  if (!db || !uid || auth?.currentUser?.uid !== uid) throw new Error('Sesión inválida.');
  return onValue(ref(db, `bloqueos/${uid}`), s => recibir(s.val()), error);
}
export function bloqueoVigente(b, anterior, ahora) {
  if (!b) return false;
  if (!Number.isSafeInteger(b.hasta)) return true;
  if (b.hasta <= ahora) return false;
  // Si la solicitud sigue pendiente y ya venció, no puede autorizarse.
  return !(b.fase === 'provisional' && anterior?.id === b.id && anterior.estado === 'pendiente' && anterior.vence <= ahora);
}
