import { auth, firebaseConfigurado } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { extraerCodigoTotem, codigoDesdeURL, urlConCodigo, iniciarEscaner } from './totem-utils.js';

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

// Nunca mostrar o aceptar reservas sin sesión verificada.
if(!codigoInicial) window.location.replace('./index.html');
else if(!firebaseConfigurado){espera.textContent='Completa firebase-config.js antes de iniciar sesión y reservar.';}
else onAuthStateChanged(auth,usuario=>{
  if(!usuario) {window.location.replace(urlConCodigo('login.html',codigoInicial));return;}
  espera.hidden=true;panel.hidden=false;
  document.getElementById('totem-codigo-inicial').textContent=codigoInicial;
});

document.getElementById('cerrar-sesion').addEventListener('click',async()=>{
  detenerTodo();
  await signOut(auth);
  window.location.replace('./index.html');
});

form.addEventListener('submit',e=>{
  e.preventDefault();
  if(!auth?.currentUser){window.location.replace(urlConCodigo('login.html',codigoInicial));return;}
  const seleccion=form.querySelector('input[name="tiempo"]:checked');
  if(!seleccion){alert('Selecciona 30, 45 o 60 minutos.');return;}
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
function confirmar(valor){
  if(segundos<=0 || codigoConfirmado)return;
  if(!auth?.currentUser){window.location.replace(urlConCodigo('login.html',codigoInicial));return;}
  const leido=extraerCodigoTotem(valor);
  if(!leido){mensaje.textContent='Ingresa o escanea un código válido.';return;}
  if(leido!==codigoInicial){mensaje.textContent='El código no coincide con el tótem seleccionado. Revisa el QR o vuelve a escribirlo.';return;}
  codigoConfirmado=true;detenerTodo();
  const minutos=Number(form.querySelector('input[name="tiempo"]:checked')?.value);
  mensaje.classList.add('formato-mensaje-estado');
  mensaje.textContent=`Identidad y código del tótem ${leido} comprobados. Duración elegida: ${minutos} min. La reserva NO se ha registrado ni se ha activado el relé: falta conectar el backend seguro con Firestore y ESP8266.`;
  document.getElementById('confirmar-codigo').disabled=true;
  document.getElementById('abrir-camara').disabled=true;
  document.getElementById('cambiar-metodo').disabled=true;
}
window.addEventListener('pagehide',detenerTodo);
