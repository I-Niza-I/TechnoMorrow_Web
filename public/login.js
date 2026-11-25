import { auth, firebaseConfigurado } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, setPersistence, browserSessionPersistence } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { codigoDesdeURL, urlConCodigo } from './totem-utils.js';

const codigo = codigoDesdeURL();
const cajaCodigo = document.getElementById('code-context');
const etiquetaCodigo = document.getElementById('codigo-seleccionado');
const errorBox = document.getElementById('login-error');
const form = document.getElementById('login-form');
const boton = document.getElementById('login-submit');
const textoBoton = document.getElementById('login-submit-text');
const email = document.getElementById('login-email');
const clave = document.getElementById('login-password');
const toggle = document.getElementById('toggle-pass');
let enviando = false;

function error(mensaje) { errorBox.textContent=mensaje; errorBox.hidden=!mensaje; }
function bloquear(bloq, texto='Iniciar sesión y continuar'){boton.disabled=bloq||!codigo||!firebaseConfigurado;textoBoton.textContent=texto;}
if (!codigo) {
  cajaCodigo.classList.add('invalid'); etiquetaCodigo.textContent='No se identificó ningún tótem';
  error('Primero escanea el QR del tótem o ingresa su código en la página de inicio.');
  bloquear(true);
} else etiquetaCodigo.textContent=codigo;
if (!firebaseConfigurado) {
  error('Falta configurar Firebase. Completa los valores de firebase-config.js con los de tu aplicación web.');
  bloquear(true);
}

// Si ya existe sesión del usuario, conserva el código y salta el formulario.
if (auth && codigo) {
  onAuthStateChanged(auth, usuario=>{
    if(usuario && !enviando) window.location.replace(urlConCodigo('reserva.html',codigo));
  });
}

toggle.addEventListener('click',()=>{
  const visible=clave.type==='text'; clave.type=visible?'password':'text';
  toggle.setAttribute('aria-pressed',String(!visible));toggle.setAttribute('aria-label',visible?'Mostrar contraseña':'Ocultar contraseña');
});

form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!codigo||!auth)return;
  if(!email.value.trim()||!clave.value){error('Completa el correo y la contraseña.');return;}
  enviando=true;bloquear(true,'Verificando credenciales…');error('');
  try {
    // Sesión de esta pestaña (útil en equipos compartidos del laboratorio).
    await setPersistence(auth,browserSessionPersistence);
    await signInWithEmailAndPassword(auth,email.value.trim(),clave.value);
    window.location.replace(urlConCodigo('reserva.html',codigo));
  }catch(e){
    console.warn('Error Firebase Authentication:',e.code||e);
    if(e.code==='auth/too-many-requests') error('Demasiados intentos. Prueba nuevamente más tarde.');
    else if(e.code==='auth/network-request-failed') error('No se pudo conectar con Firebase. Comprueba tu conexión.');
    else error('No fue posible iniciar sesión. Comprueba las credenciales e inténtalo otra vez.');
    enviando=false;bloquear(false);
  }
});
