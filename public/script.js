import { auth, firebaseConfigurado } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { extraerCodigoTotem, codigoDesdeURL, urlConCodigo, iniciarEscaner } from './totem-utils.js';
import { obtenerRolUsuario, mensajeErrorPerfil } from './roles.js';

const codigoInicial=codigoDesdeURL();
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
// NUEVO: sesión válida para cualquiera de los dos roles; nunca basta con tener un UID.
let uidVerificado = null;
let revisionSesion = 0;
let revisionCamara = 0;
let abriendoCamara = false;
const destinoInicio = codigoInicial ? urlConCodigo('index.html', codigoInicial) : './index.html';
function puedeReservar() {
  return !!uidVerificado && auth?.currentUser?.uid === uidVerificado;
}
// NUEVO: volver al inicio sin cerrar sesión ni perder el código actual.
document.getElementById('volver-inicio-reserva').href = destinoInicio;

// MODIFICADO: acceso protegido para usuario Y administrador, sin redirección por rol.
if(!codigoInicial) window.location.replace('./index.html');
else if(!firebaseConfigurado || !auth){espera.textContent='Completa firebase-config.js antes de iniciar sesión y reservar.';}
else onAuthStateChanged(auth,async usuario=>{
  const revision = ++revisionSesion;
  uidVerificado = null;
  detenerTodo();
  // NUEVO: no reutilizar una confirmación anterior al cambiar de sesión.
  form.hidden = false;
  confirmacion.hidden = true;
  codigoConfirmado = false;
  codigoInput.value = '';
  mensaje.textContent = '';
  document.getElementById('confirmar-codigo').disabled = false;
  document.getElementById('abrir-camara').disabled = false;
  document.getElementById('cambiar-metodo').disabled = false;
  panel.hidden = true;
  espera.hidden = false;
  if(!usuario) {window.location.replace(urlConCodigo('login.html',codigoInicial));return;}
  espera.textContent='Verificando perfil…';
  try {
    // roles.js ya rechaza perfiles inexistentes, inactivos y roles desconocidos.
    await obtenerRolUsuario(usuario);
    if (revision !== revisionSesion || auth.currentUser?.uid !== usuario.uid) return;
    uidVerificado = usuario.uid;
    espera.hidden=true;panel.hidden=false;
    document.getElementById('totem-codigo-inicial').textContent=codigoInicial;
  } catch(error) {
    if (revision !== revisionSesion) return;
    console.error('No se pudo comprobar el rol para reservar:',error);
    espera.textContent=mensajeErrorPerfil(error);
    panel.hidden=true;
  }
}, error => {
  ++revisionSesion;
  uidVerificado = null;
  detenerTodo();
  panel.hidden = true;
  espera.hidden = false;
  espera.textContent = 'No se pudo verificar la sesión. Vuelve al inicio.';
  console.error(error);
});

document.getElementById('cerrar-sesion').addEventListener('click',async()=>{
  detenerTodo();
  // MODIFICADO: cierre explícito de sesión; si falla no fingimos que se cerró.
  try {
    await signOut(auth);
    window.location.replace('./index.html');
  } catch (error) {
    mensaje.textContent = 'No fue posible cerrar sesión. Vuelve a intentarlo.';
    console.error(error);
    alert('No fue posible cerrar sesión. Vuelve a intentarlo.');
  }
});

form.addEventListener('submit',e=>{
  e.preventDefault();
  // MODIFICADO: exigir un perfil comprobado también al ejecutar las acciones.
  if(!puedeReservar()){window.location.replace(destinoInicio);return;}
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
document.getElementById('cambiar-metodo').addEventListener('click',()=>{detenerCamara();elegirMetodo(metodo==='codigo'?'qr':'codigo');});

document.getElementById('confirmar-codigo').addEventListener('click',()=>confirmar(codigoInput.value));
codigoInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();confirmar(codigoInput.value);}});

document.getElementById('abrir-camara').addEventListener('click',async()=>{
  // NUEVO: impedir aperturas paralelas y descartar la cámara si cambia la sesión.
  if(!puedeReservar() || segundos<=0 || codigoConfirmado || abriendoCamara) return;
  detenerCamara();
  const revision = revisionCamara;
  abriendoCamara = true;
  document.getElementById('mensaje-camara').textContent='Abriendo cámara…';
  try {
    const nuevo = await iniciarEscaner(video, valor => {
      if(revision !== revisionCamara || !puedeReservar()) return;
      detenerCamara();
      confirmar(valor);
    });
    if(revision !== revisionCamara || !puedeReservar() || segundos<=0 || codigoConfirmado) {
      nuevo.stop();
      return;
    }
    escaner = nuevo;
    document.getElementById('mensaje-camara').textContent='Coloca el QR frente a la cámara.';
  } catch(e) {
    if(revision === revisionCamara) document.getElementById('mensaje-camara').textContent=e.message||'No fue posible abrir la cámara.';
  } finally {
    if(revision === revisionCamara) abriendoCamara = false;
  }
});
// NUEVO: invalidar también una apertura pendiente de cámara al salir o caducar.
function detenerCamara(){++revisionCamara;abriendoCamara=false;escaner?.stop();escaner=null;}
function detenerTodo(){clearInterval(intervalo);intervalo=null;detenerCamara();}
// CONSERVADO: segunda lectura obligatoria y temporizador de confirmación de 120 segundos.
function confirmar(valor){
  if(segundos<=0 || codigoConfirmado)return;
  // MODIFICADO: exigir un perfil comprobado también al ejecutar las acciones.
  if(!puedeReservar()){window.location.replace(destinoInicio);return;}
  const leido=extraerCodigoTotem(valor);
  if(!leido){mensaje.textContent='Ingresa o escanea un código válido.';return;}
  if(leido!==codigoInicial){mensaje.textContent='El código no coincide con el tótem seleccionado. Revisa el QR o vuelve a escribirlo.';return;}
  codigoConfirmado=true;detenerTodo();
  // MODIFICADO: se muestra la unidad del prototipo; no hay activación física todavía.
  const duracion=Number(form.querySelector('input[name="tiempo"]:checked')?.value);
  mensaje.classList.add('formato-mensaje-estado');
  mensaje.textContent=`Identidad y código del tótem ${leido} comprobados. Duración elegida: ${duracion} segundos. Confirmación de prueba: no se ha creado una reserva real ni se ha activado el relé. La integración con Realtime Database y ESP8266 sigue pendiente.`;
  document.getElementById('confirmar-codigo').disabled=true;
  document.getElementById('abrir-camara').disabled=true;
  document.getElementById('cambiar-metodo').disabled=true;
}
window.addEventListener('pagehide',detenerTodo);
