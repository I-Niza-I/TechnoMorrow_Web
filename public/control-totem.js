import { app, auth } from './firebase-config.js';

import {
  getDatabase,
  ref,
  onValue,
  runTransaction,
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


  // Solicitar reserva mediante una transacción.

  const resultado = await runTransaction(

    ref(db, `control/${codigo}`),

    actual => {

      if (
        !conectado || auth?.currentUser?.uid !== uid ||
        actual?.estado !== 'libre' ||
        ahoraServidor() >= vence - 5000
      ) {
        return;
      }

      return {
        estado: 'pendiente',
        id,
        segundos,
        vence
      };

    },

    { applyLocally: false }

  );

  if (!resultado.committed) {

    throw new Error(
      'Tótem ocupado, sin datos o solicitud caducada.'
    );

  }

  return id;

}