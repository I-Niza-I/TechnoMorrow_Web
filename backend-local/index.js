'use strict';
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const PROJECT = 'technomorrow-31b10';
const URL = 'https://technomorrow-31b10-default-rtdb.firebaseio.com';
const TOTEMS = { 'TOT-001': 'T01', 'TOT-002': 'T02' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT, databaseURL: URL });
const rtdb = getDatabase(app);
const fs = getFirestore(app);
const formato = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const ts = ms => Timestamp.fromMillis(ms);
function partes(ms) {
  const p = Object.fromEntries(formato.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}
function valido(v) {
  if (!v) return false;
  if (v.estado === 'libre') return v.id === 'inicio' && v.segundos === 0 && v.vence === 0;
  return ['pendiente','activo'].includes(v.estado) && typeof v.id === 'string' && UUID.test(v.id) && [30,45,60].includes(v.segundos) && Number.isSafeInteger(v.vence) && v.vence > 0;
}
function igual(a,b) { return a && b && ['estado','id','segundos','vence'].every(k=>a[k]===b[k]); }
function evento(tx,id,idTotem,tipo,momento,detalle) {
  const key = `${id}_${tipo}`;
  const p = partes(momento);
  tx.set(fs.collection('eventos_hardware').doc(key), { id_evento:key, id_reserva:id, id_totem:idTotem, tipo_evento:tipo, fecha:p.fecha, hora:p.hora, fecha_hora:ts(momento), duracion:0, estado:'reportado', detalle }, {merge:true});
}
async function procesar(codigo, actual, observado) {
  if (!valido(actual)) { console.warn(codigo, 'Control no válido; se omite.'); return; }
  const idTotem = TOTEMS[codigo];
  const t = fs.collection('totems').doc(idTotem);
  let meta = null;
  if (actual.estado !== 'libre') {
    meta = (await rtdb.ref(`solicitudes/${actual.id}`).get()).val();
    if (!meta || typeof meta.uid !== 'string' || meta.codigo !== codigo || meta.segundos !== actual.segundos || !Number.isSafeInteger(meta.vence)) {
      console.warn(codigo, 'Solicitud sin metadatos válidos; no se inventará un usuario.',actual.id);
      return;
    }
  }
  // El bloqueo inicial ya se creó atómicamente en RTDB; este ajuste no
  // participa en el control del relé. Nunca se modifica un ID posterior.
  if (actual.estado === 'activo') {
    const hasta = actual.vence + 120000;
    await rtdb.ref(`bloqueos/${meta.uid}`).transaction(b => {
      // Una transacción puede iniciar con caché vacía; devolver null permite
      // que el servidor reintente si realmente existe un registro.
      if (b === null) return null;
      if (!b || b.id !== actual.id || b.codigo !== codigo || b.fase !== 'provisional') return;
      if (!Number.isSafeInteger(b.hasta) || hasta > b.hasta) return;
      return { ...b, fase: 'confirmado', hasta };
    });
  }
  await fs.runTransaction(async tx => {
    const td = await tx.get(t);
    if (!td.exists) throw new Error(`Falta totems/${idTotem} en Firestore`);
    const previo = td.data().historial_control || null;
    if (igual(previo,actual)) return;
    const previoRef = previo && previo.estado !== 'libre' && UUID.test(previo.id || '') ? fs.collection('reservas').doc(previo.id) : null;
    const actualRef = actual.estado !== 'libre' ? fs.collection('reservas').doc(actual.id) : null;
    // Todas las lecturas antes de las escrituras.
    const previoDoc = previoRef ? await tx.get(previoRef) : null;
    const actualDoc = actualRef ? (previoRef?.id === actualRef.id ? previoDoc : await tx.get(actualRef)) : null;
    if (actualDoc?.exists && (actualDoc.data().id_totem !== idTotem || actualDoc.data().id_usuario !== meta.uid)) throw new Error('ID de reserva asociado a otro usuario o tótem');
    if (actualDoc?.exists && ['finalizada','indeterminada','cancelada'].includes(actualDoc.data().estado)) throw new Error('ID de reserva ya cerrado; no reutilizar');
    // Cerrar la reserva anterior cuando se observa su salida del nodo.
    if (previoRef && previoDoc?.exists && (actual.estado === 'libre' || actual.id !== previo.id)) {
      const confirmada = previo.estado === 'activo' && actual.estado === 'libre';
      const estado = confirmada ? 'finalizada' : 'indeterminada';
      tx.update(previoRef, { estado, fecha_hora_liberacion_observada:ts(observado), nota_historial: confirmada ? 'Se observó la liberación de una reserva antes autorizada; no se mide electricidad.' : 'No se observó el ciclo completo; no se puede confirmar si hubo activación o cuándo terminó.' });
      evento(tx,previo.id,idTotem,confirmada?'desactivacion':'ciclo_incompleto',observado,confirmada?'Se observó el nodo libre después de una autorización.':'Faltan transiciones observadas del ciclo.');
    }
    if (actualRef) {
      const solicitud = meta.vence - 30000;
      const inicio = actual.estado === 'activo' ? actual.vence - actual.segundos * 1000 : solicitud;
      const p = partes(inicio);
      const datos = { id_reserva:actual.id,id_usuario:meta.uid,id_totem:idTotem,fecha:p.fecha,hora_inicio:p.hora,hora_fin:actual.estado==='activo'?partes(actual.vence).hora:'',duracion:actual.segundos/60,duracion_segundos:actual.segundos,estado:actual.estado==='activo'?'activa':'pendiente',fecha_hora_solicitud:ts(solicitud) };
      if (actual.estado === 'activo') {
        datos.fecha_hora_inicio=ts(inicio);
        datos.fecha_hora_fin=ts(actual.vence);
        if (!actualDoc?.exists || actualDoc.data().estado !== 'activa') evento(tx,actual.id,idTotem,'activacion',inicio,'ESP8266 autorizó la reserva en RTDB; hora calculada del vencimiento; suministro no medido.');
      }
      tx.set(actualRef,datos,{merge:true});
    }
    tx.update(t,{ historial_control:actual, ultima_observacion_rtdb:ts(observado), estado_deseado:actual.estado==='activo'?'encendido':'apagado', estado_reportado:'no_verificado', id_reserva_activa:actual.estado==='activo'?actual.id:null, autorizado_hasta:actual.estado==='activo'?ts(actual.vence):null });
  });
  console.log(new Date(observado).toISOString(),codigo,actual.estado,actual.id);
}

// Una cola por tótem evita procesar eventos del mismo dispositivo fuera de orden.
// El reintento mantiene el orden, pero la cola solo existe mientras vive el proceso.
const pausa = ms => new Promise(resolve=>setTimeout(resolve,ms));
for (const codigo of Object.keys(TOTEMS)) {
  let cola = Promise.resolve();
  rtdb.ref(`control/${codigo}`).on('value', snap => {
    const actual = snap.val();
    const observado = Date.now();
    cola = cola.then(async () => {
      for (;;) {
        try { await procesar(codigo,actual,observado); return; }
        catch (e) { console.error(codigo,'Error de sincronización; reintento en 5 s:',e.message); await pausa(5000); }
      }
    });
  }, e => console.error(codigo,'Error escuchando RTDB:',e.message));
}
rtdb.ref('.info/connected').on('value', s=>console.log('RTDB:',s.val()?'conectado':'desconectado'));
console.log('TechnoMorrow - backend local. Mantén esta terminal abierta durante las pruebas.');
