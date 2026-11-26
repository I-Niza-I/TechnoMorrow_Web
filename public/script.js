import { auth, firebaseConfigurado } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { extraerCodigoTotem, codigoDesdeURL, urlConCodigo, iniciarEscaner } from './totem-utils.js';
import { obtenerRolUsuario, mensajeErrorPerfil } from './roles.js';

import { observarTotem, solicitarReserva, codigoPermitido, ahoraServidor } from './control-totem.js';

const codigoInicial=codigoDesdeURL();
let estadoActual = null, idSolicitud = null, observacion = null, relojReserva = null;
let fueActiva = false, vistaSolicitud = false, solicitudHasta = 0;
const estadoTotem = document.getElementById('estado-totem-rtdb');

function actualizarEstado() {
  if (!estadoActual) { estadoTotem.textContent = 'Sin datos de disponibilidad.'; return; }
  const { estado, id, vence } = estadoActual;
  const resta = Math.max(0, Math.ceil((vence - ahoraServidor()) / 1000));
  estadoTotem.textContent = estado === 'libre' ? 'Tótem libre.' :
    estado === 'pendiente' ? 'Tótem ocupado: esperando al controlador.' :
    estado === 'activo' ? `Tótem ocupado: ${resta} s restantes.` : 'Estado desconocido.';
  form.querySelector('button[type="submit"]').disabled = estado !== 'libre';
  if (!idSolicitud) return;
  if (id === idSolicitud && estado === 'pendiente') {
    vistaSolicitud = true;
    mensaje.textContent = resta > 0 ? `Solicitud enviada. Esperando ESP8266 (${resta} s).` : 'El ESP8266 no respondió a tiempo. No se activará una solicitud vencida.';
  } else if (id === idSolicitud && estado === 'activo') {
    fueActiva = true;
    vistaSolicitud = true;
    mensaje.textContent = resta > 0 ? `Activación autorizada por el ESP8266. Tiempo restante: ${resta} s.` : 'Tiempo terminado. Esperando liberación del tótem.';
  } else if (vistaSolicitud || Date.now() > solicitudHasta) {
    mensaje.textContent = fueActiva ? 'Reserva terminada.' : 'La solicitud terminó o expiró sin confirmación del ESP8266.';
    idSolicitud = null;
    document.getElementById('temporizador').closest('.cuenta-regresiva').hidden = true;
  }
}

const espera=document.getElementById('verificando-sesion');
const panel=document.getElementById('panel-reserva');
const form=document.getElementById('form-tiempo');
const confirmacion=document.getElementById('identificacion');
const codigoInput=document.getElementById('codigo-enchufe');
const mensaje=document.getElementById('mensaje-reserva');
const tiempoTexto=document.getElementById('temporizador');
const video=document.getElementById('vista-camara');
let segundos=120,intervalo=null,escaner=null,codigoConfirmado=false;
let metodo='codigo';

// Nunca mostrar o aceptar reservas sin sesión verificada.
if(!codigoInicial || !codigoPermitido(codigoInicial)) window.location.replace('./index.html');
else if(!firebaseConfigurado){espera.textContent='Completa firebase-config.js antes de iniciar sesión y reservar.';}
else onAuthStateChanged(auth,async usuario=>{
  if(!usuario) {window.location.replace(urlConCodigo('login.html',codigoInicial));return;}
  try {
    const rol = await obtenerRolUsuario(usuario);
    if(rol === 'admin') {
      window.location.replace('./estadisticas.html');
      return;
    }
    espera.hidden=true;panel.hidden=false;
    document.getElementById('totem-codigo-inicial').textContent=codigoInicial;
    form.querySelector('button[type="submit"]').disabled = true;
    observacion?.();
    observacion = observarTotem(codigoInicial, datos => {
      estadoActual = datos;
      if (!datos) form.querySelector('button[type="submit"]').disabled = true;
      actualizarEstado();
    }, error => {
      estadoActual = null;
      estadoTotem.textContent = 'No se pudo consultar el tótem: ' + error.code;
      form.querySelector('button[type="submit"]').disabled = true;
    });
    clearInterval(relojReserva);
    relojReserva = setInterval(actualizarEstado, 500);
  } catch(error) {
    console.error('No se pudo comprobar el rol para reservar:',error);
    espera.textContent=mensajeErrorPerfil(error);
    panel.hidden=true;
  }
});

document.getElementById('cerrar-sesion').addEventListener('click',async()=>{
  detenerTodo();
  await signOut(auth);
  window.location.replace('./index.html');
});

form.addEventListener('submit',e=>{
  e.preventDefault();
  if(!auth?.currentUser){window.location.replace(urlConCodigo('login.html',codigoInicial));return;}
  if (estadoActual?.estado !== 'libre') { alert('El tótem no está libre.'); return; }
  const seleccion=form.querySelector('input[name="tiempo"]:checked');
  if(!seleccion){alert('Selecciona 30, 45 o 60 segundos.');return;}
  form.hidden=true;confirmacion.hidden=false;codigoConfirmado=false;
  document.getElementById('instruccion-metodo').textContent='Vuelve a leer el QR o escribir el código impreso en el tótem. Debe coincidir con el seleccionado inicialmente.';
  elegirMetodo(window.matchMedia('(max-width:700px)').matches?'qr':'codigo');
  segundos=120;intervalo=setInterval(()=>{segundos--;mostrarTiempo();if(segundos<=0)caducar();},1000);
  mostrarTiempo();
  confirmacion.scrollIntoView({behavior:'smooth',block:'center'});
});
function mostrarTiempo(){tiempoTexto.textContent=`${String(Math.floor(Math.max(0,segundos)/60)).padStart(2,'0')}:${String(Math.max(0,segundos)%60).padStart(2,'0')}`;}
function caducar(){detenerTodo();mensaje.textContent='Se agotó el tiempo de confirmación. Vuelve al inicio de la reserva.';mensaje.classList.add('formato-mensaje-estado');document.getElementById('confirmar-codigo').disabled=true;document.getElementById('abrir-camara').disabled=true;}
function elegirMetodo(m){metodo=m;document.getElementById('panel-codigo').hidden=m!=='codigo';document.getElementById('panel-qr').hidden=m!=='qr';document.getElementById('cambiar-metodo').textContent=m==='codigo'?'Prefiero escanear el QR':'Prefiero ingresar el código';}
document.getElementById('cambiar-metodo').addEventListener('click',()=>{escaner?.stop();escaner=null;elegirMetodo(metodo==='codigo'?'qr':'codigo');});

document.getElementById('confirmar-codigo').addEventListener('click',()=>confirmar(codigoInput.value));
codigoInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();confirmar(codigoInput.value);}});

document.getElementById('abrir-camara').addEventListener('click',async()=>{
  document.getElementById('mensaje-camara').textContent='Abriendo cámara…';
  try{escaner=await iniciarEscaner(video,confirmar);document.getElementById('mensaje-camara').textContent='Coloca el QR frente a la cámara.';}
  catch(e){document.getElementById('mensaje-camara').textContent=e.message||'No fue posible abrir la cámara.';}
});
function detenerTodo(){clearInterval(intervalo);intervalo=null;escaner?.stop();escaner=null;}
async function confirmar(valor){
  if(segundos<=0 || codigoConfirmado)return;
  if(!auth?.currentUser){window.location.replace(urlConCodigo('login.html',codigoInicial));return;}
  const leido=extraerCodigoTotem(valor);
  if(!leido){mensaje.textContent='Ingresa o escanea un código válido.';return;}
  if(leido!==codigoInicial){mensaje.textContent='El código no coincide con el tótem seleccionado. Revisa el QR o vuelve a escribirlo.';return;}
  codigoConfirmado=true;detenerTodo();
  const duracion=Number(form.querySelector('input[name="tiempo"]:checked')?.value);
  mensaje.classList.add('formato-mensaje-estado');
  mensaje.textContent = 'Enviando solicitud a Realtime Database…';
  tiempoTexto.closest('.cuenta-regresiva').hidden = true;
  document.getElementById('confirmar-codigo').disabled=true;
  document.getElementById('abrir-camara').disabled=true;
  document.getElementById('cambiar-metodo').disabled=true;
  try {
    idSolicitud = await solicitarReserva(leido, duracion);
    fueActiva = false;
    vistaSolicitud = false;
    solicitudHasta = Date.now() + 100000;
    mensaje.textContent = 'Solicitud registrada. Esperando confirmación del ESP8266…';
    actualizarEstado();
  } catch (error) {
    console.error('Reserva rechazada:', error);
    mensaje.textContent = 'No se pudo reservar: ' + (error.code === 'PERMISSION_DENIED' || error.code === 'permission-denied' ? 'permisos insuficientes, tótem ocupado o solicitud vencida.' : error.message);
  }
  const volver = document.createElement('a');
  volver.href = urlConCodigo('reserva.html', codigoInicial);
  volver.className = 'boton-cambiar';
  volver.textContent = 'Volver a seleccionar duración';
  mensaje.after(volver);
}
window.addEventListener('pagehide', () => { detenerTodo(); observacion?.(); clearInterval(relojReserva); });
