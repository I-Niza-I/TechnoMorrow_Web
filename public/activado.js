import { app, auth, firebaseConfigurado } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { getFirestore, doc, getDocFromServer } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';
import { obtenerRolUsuario, mensajeErrorPerfil } from './roles.js';
import { observarTotem, solicitarReserva, codigoPermitido, ahoraServidor, conexionLista } from './control-totem.js';
import { urlConCodigo } from './totem-utils.js';
import { idDesdeURL, leerReserva, guardarReserva, urlReserva, segundosValidos, formatoFin, mismoActivo, segundosRestantes, finHistorial } from './flujo-sesion.js';
const $ = id => document.getElementById(id);
const id=idDesdeURL(); let r=leerReserva(id), control=null, desuscribir=null, timer=null, revision=0, autorizada=false, consultaEnCurso=false, ultimaConsulta=0;
let errorEnvio='', enviado=false, activoUI=false, controlRecibido=false, inicioPreparacion=0, lanzada=false;
const fs=app?getFirestore(app):null;
const pausa=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function guardar(cambios) { Object.assign(r,cambios); guardarReserva(r); }
function vista(nombre) { for(const s of ['esperando','confirmada','fallida']) $(s).hidden=s!==nombre; }
function fallo(texto){ if(autorizada)return; vista('fallida'); $('mensaje-fallo').textContent=texto; }
function confirmarFin(fin){
  if(autorizada || !activoUI || auth.currentUser?.uid!==r.uid) return;
  // El fin se obtiene de RTDB activo o del historial de la misma reserva; nunca del clic.
  try { guardar({fase:'confirmada',fin}); } catch(e){console.warn('No se pudo guardar la navegación:',e); r.fin=fin;}
  autorizada=true;
  const f=formatoFin(fin); $('hora-fin').textContent=f.hora; $('fecha-fin').textContent=f.fecha;
  vista('confirmada');
  actualizarConfirmada();
}
function actualizarConfirmada(){
  const termino=ahoraServidor()>=r.fin;
  $('mensaje-confirmada').textContent=termino?'El plazo autorizado ya terminó.':'El tótem autorizó tu reserva. Ya puedes utilizar el enchufe.';
  $('nota-evaluacion').textContent=termino?'Puedes evaluar el servicio. Se comprobará la finalización en Firestore.':'Podrás evaluar el servicio al finalizar el tiempo reservado.';
  $('evaluar').disabled=!termino;
}
async function consultarHistorial(){
  if(!activoUI || autorizada || consultaEnCurso || !fs || !r || auth.currentUser?.uid!==r.uid) return;
  consultaEnCurso=true; ultimaConsulta=Date.now();
  try {
    const snap=await getDocFromServer(doc(fs,'reservas',r.id));
    if(!activoUI || auth.currentUser?.uid!==r.uid || !snap.exists()) return;
    const datos=snap.data(), fin=finHistorial(datos,r);
    if(fin!==null) confirmarFin(fin);
    else if(['cancelada','indeterminada'].includes(datos.estado)){errorEnvio='No se registró un ciclo de autorización verificable. Consulta la disponibilidad antes de iniciar otra reserva.'; fallo(errorEnvio);}
  } catch(e){ /* Puede no existir aún o no haber conexión. No se inventa una confirmación. */ console.debug('Historial aún no disponible:',e.code||e.message); }
  finally{consultaEnCurso=false;}
}
function actualizar(){
  if(!activoUI || !r) return;
  if(autorizada){actualizarConfirmada();return;}
  if(conexionLista() && mismoActivo(control,r)){confirmarFin(control.vence);return;}
  if(r.fase==='nueva' || (r.fase==='preparando' && lanzada && !r.vence && !errorEnvio)) {
    vista('esperando'); $('mensaje-espera').textContent='Conectando con Firebase y preparando la solicitud…'; return;
  }
  const esperaValida=Number.isSafeInteger(r.vence) && ahoraServidor()<r.vence;
  const pendientePropia=control?.id===r.id && control?.estado==='pendiente';
  if(pendientePropia){enviado=true;}
  if(esperaValida && !errorEnvio){
    vista('esperando'); const resta=segundosRestantes(r.vence,ahoraServidor());
    $('contador').textContent=resta; $('reloj').style.setProperty('--progreso',`${resta/30*100}%`);
    $('mensaje-espera').textContent=conexionLista()?(enviado?'Esperando que el ESP8266 autorice la reserva.':'Enviando la solicitud a Firebase…'):'Conexión interrumpida. Verificando cuando vuelva la red…';
    if(enviado) {$('paso-envio').innerHTML='<span class="ok">✓</span> Solicitud registrada en Firebase';}
  } else {
    fallo(errorEnvio || (r.vence?'Se agotaron los 30 segundos sin recibir una autorización verificable. El tótem no se considera libre hasta que Firebase lo indique.':'La solicitud se interrumpió antes de confirmar el envío. No se reenviará automáticamente.'));
  }
  // Recuperación de una autorización que pudo ocurrir durante una recarga o desconexión.
  // No se solicita otra reserva ni se cambia el control del hardware.
  if((!esperaValida || !conexionLista() || (enviado && controlRecibido && !pendientePropia)) && r.fase!=='nueva' && Date.now()-ultimaConsulta>=3000 && Number.isSafeInteger(r.vence) && ahoraServidor()<=r.vence+90000) consultarHistorial();
}
async function iniciarSolicitud(){
  if(lanzada || r.fase!=='nueva') return;
  lanzada=true; inicioPreparacion=Date.now();
  try {
    guardar({fase:'preparando'}); // Si se recarga, nunca se reejecuta automáticamente.
    while(activoUI && (!conexionLista() || !controlRecibido) && Date.now()-inicioPreparacion<8000) await pausa(100);
    if(!activoUI || auth.currentUser?.uid!==r.uid) return;
    if(!conexionLista() || !controlRecibido) throw new Error('No se pudo conectar con Realtime Database. Consulta disponibilidad y vuelve a intentarlo.');
    if(control?.estado!=='libre') throw new Error('El tótem ya está ocupado o no está disponible.');
    await solicitarReserva(r.codigo,r.segundos,{
      id:r.id,
      alPreparar:meta=>{ if(meta.uid!==r.uid) throw new Error('La sesión cambió.'); guardar({fase:'enviando',vence:meta.vence}); actualizar(); }
    });
    enviado=true;
    if(!autorizada) guardar({fase:'enviada'});
  }catch(e){
    console.error('Solicitud:',e);
    if(!autorizada){errorEnvio=e.code==='PERMISSION_DENIED'||e.code==='permission-denied'?'No se pudo registrar la solicitud: tótem ocupado, permisos insuficientes o plazo vencido.':(e.message||'No se pudo confirmar el envío.');
      try { guardar({fase:'fallida',motivo:errorEnvio}); }catch{};
    }
  } finally{actualizar();}
}
function detener(){activoUI=false;desuscribir?.();desuscribir=null;clearInterval(timer);timer=null;}
$('evaluar').addEventListener('click',()=>{if(autorizada && ahoraServidor()>=r.fin && auth?.currentUser?.uid===r.uid) location.assign(urlReserva('satisfaccion.html',r.id));});
$('comprobar').addEventListener('click',()=>{actualizar();consultarHistorial();});
if(!firebaseConfigurado || !auth || !r || !codigoPermitido(r.codigo) || !segundosValidos(r.segundos)) $('verificando').textContent='No se encontró una solicitud válida en esta pestaña. Regresa al inicio para reservar.';
else onAuthStateChanged(auth,async usuario=>{
  const actual=++revision; detener(); $('estado-reserva').hidden=true; $('verificando').hidden=false;
  if(!usuario || usuario.uid!==r.uid){$('verificando').textContent='Inicia sesión con la cuenta que realizó la reserva. Regresa al inicio.';return;}
  try{
    const rol=await obtenerRolUsuario(usuario);
    if(actual!==revision || auth.currentUser?.uid!==usuario.uid) return;
    if(rol==='admin'){location.replace('./estadisticas.html');return;}
    activoUI=true; $('verificando').hidden=true; $('estado-reserva').hidden=false;
    $('codigo-totem').textContent=r.codigo; $('duracion-reserva').textContent=`${r.segundos} segundos`;
    $('volver-reserva').href=urlConCodigo('reserva.html',r.codigo);
    if(r.motivo) errorEnvio=r.motivo;
    enviado=['enviada','confirmada'].includes(r.fase);
    // Restaurar una confirmación ya vista en esta misma pestaña.
    if(r.fase==='confirmada' && Number.isSafeInteger(r.fin) && r.fin>0){if(!autorizada) confirmarFin(r.fin);else {vista('confirmada');actualizarConfirmada();}}
    else {
      control=null;controlRecibido=false;
      desuscribir=observarTotem(r.codigo,datos=>{control=datos;controlRecibido=true;actualizar();},e=>{console.error(e); control=null; controlRecibido=false;});
      if(r.fase==='nueva') iniciarSolicitud();
      else if(r.fase==='preparando' && !lanzada) fallo('La preparación anterior se interrumpió. No se enviará otra solicitud automáticamente.');
    }
    timer=setInterval(actualizar,250);actualizar();
  }catch(e){$('verificando').textContent=mensajeErrorPerfil(e);console.error(e);}
},e=>{$('verificando').textContent='No fue posible verificar la sesión.';console.error(e);});
window.addEventListener('pagehide',detener);
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
