import { app } from './firebase-config.js';

import {
  getDatabase,
  ref,
  onValue,
  runTransaction
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


export async function solicitarReserva(codigo, segundos) {

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

  const id = crypto.randomUUID();

  // 30 segundos para que el ESP8266 responda.
  const vence = ahoraServidor() + 30000;

  const resultado = await runTransaction(

    ref(db, `control/${codigo}`),

    actual => {

      if (
        !conectado ||
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