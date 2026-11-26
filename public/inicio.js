// NUEVO: index.html consulta la sesión y el perfil antes de habilitar reservas.
import { auth, firebaseConfigurado } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { obtenerRolUsuario, mensajeErrorPerfil } from './roles.js';
// CONSERVADO: utilidades de normalización, navegación y escaneo QR.
import { extraerCodigoTotem, codigoDesdeURL, urlConCodigo, iniciarEscaner } from './totem-utils.js';

const campo = document.getElementById('codigo-inicial');
const mensaje = document.getElementById('inicio-mensaje');
const video = document.getElementById('camara-inicio');
const btn = document.getElementById('escanear-inicio');
const continuar = document.getElementById('continuar-inicio');
const login = document.getElementById('acceso-login');
const salir = document.getElementById('salir-inicio');
const estadisticas = document.getElementById('acceso-estadisticas');
const cuenta = document.getElementById('cuenta-inicio');
const estadoSesion = document.getElementById('estado-sesion-inicio');
const contexto = document.getElementById('contexto-totem');
const contextoCodigo = document.getElementById('contexto-codigo');

let escaner = null;
let abriendoCamara = false;
let uidVerificado = null;
let revisionSesion = 0;
let revisionCamara = 0;
let cerrandoSesion = false;

// NUEVO: el permiso depende del perfil comprobado y de la sesión actual de Firebase.
// No sustituye las reglas de seguridad de la base de datos.
function puedeReservar() {
  return !cerrandoSesion && !!uidVerificado && auth?.currentUser?.uid === uidVerificado;
}

function actualizarBotones() {
  continuar.disabled = !puedeReservar();
  btn.disabled = !puedeReservar() || abriendoCamara;
}

function mostrarEstado(texto, activo = false) {
  estadoSesion.textContent = texto;
  estadoSesion.classList.toggle('sesion-activa', activo);
}

// NUEVO: conservar cualquier código válido en el enlace al login.
// Si se modifica el campo, el enlace refleja el valor nuevo (también al abrirlo en otra pestaña).
function actualizarEnlaceLogin() {
  const codigo = extraerCodigoTotem(campo.value);
  login.href = codigo ? urlConCodigo('login.html', codigo) : './login.html';
}

// MODIFICADO: recibir el QR solo rellena el campo, sin redirecciones automáticas.
// El texto dice "recibido", pues aún no comprobamos la existencia real del tótem.
function cargarCodigo(codigo) {
  campo.value = codigo;
  contextoCodigo.textContent = codigo;
  contexto.hidden = false;
  actualizarEnlaceLogin();
}
const codigoQR = codigoDesdeURL();
if (codigoQR) cargarCodigo(codigoQR);
actualizarEnlaceLogin();

campo.addEventListener('input', () => {
  // NUEVO: ocultar el aviso anterior si el usuario cambia el código recibido.
  contexto.hidden = extraerCodigoTotem(campo.value) !== contextoCodigo.textContent;
  mensaje.textContent = '';
  actualizarEnlaceLogin();
});

function detenerCamara() {
  // NUEVO: invalidar aperturas pendientes si se cierra sesión o se navega.
  ++revisionCamara;
  escaner?.stop();
  escaner = null;
  abriendoCamara = false;
  btn.textContent = '▦  Escanear código QR';
  actualizarBotones();
}

// NUEVO: index es accesible para visitantes, pero no permite iniciar una reserva.
// Se muestran las opciones de cuenta después de resolver la sesión y el rol.
if (!firebaseConfigurado || !auth) {
  mostrarEstado('No se pudo iniciar Firebase. Revisa firebase-config.js.');
} else {
  onAuthStateChanged(auth, async usuario => {
    const revision = ++revisionSesion;
    uidVerificado = null;
    detenerCamara();
    estadisticas.hidden = true;
    cuenta.hidden = true;
    login.hidden = !!usuario;
    salir.hidden = !usuario;
    salir.disabled = cerrandoSesion;
    if (!usuario) {
      mostrarEstado(campo.value ? 'Código recibido. Inicia sesión para continuar con la reserva.' : 'Inicia sesión para realizar una reserva.');
      return;
    }

    mostrarEstado('Verificando perfil…');
    try {
      const rol = await obtenerRolUsuario(usuario);
      // NUEVO: ignorar respuestas de perfiles de una sesión anterior.
      if (revision !== revisionSesion || auth.currentUser?.uid !== usuario.uid) return;
      uidVerificado = usuario.uid;
      cuenta.textContent = `${rol === 'admin' ? 'Administrador' : 'Usuario'} · ${usuario.email || 'Cuenta activa'}`;
      cuenta.hidden = false;
      // MODIFICADO: admin hereda el acceso a reservas y dispone de un enlace adicional.
      estadisticas.hidden = rol !== 'admin' || cerrandoSesion;
      mostrarEstado('Sesión iniciada. Identifica o revisa el tótem y presiona Continuar.', true);
      actualizarBotones();
    } catch (error) {
      if (revision !== revisionSesion) return;
      console.error('Error al consultar perfil:', error);
      mostrarEstado(mensajeErrorPerfil(error));
      actualizarBotones();
      // Se conserva Cerrar sesión para poder cambiar de cuenta si el perfil no es válido.
    }
  }, error => {
    ++revisionSesion;
    uidVerificado = null;
    detenerCamara();
    estadisticas.hidden = true;
    cuenta.hidden = true;
    login.hidden = !!auth.currentUser;
    salir.hidden = !auth.currentUser;
    mostrarEstado('No se pudo comprobar la sesión. Recarga la página o vuelve a iniciar sesión.');
    console.error(error);
  });
}

// NUEVO: cierre explícito sin activar ningún relé ni modificar registros.
salir.addEventListener('click', async () => {
  if (!auth || cerrandoSesion) return;
  cerrandoSesion = true;
  salir.disabled = true;
  const mostrarEstadisticas = !estadisticas.hidden;
  estadisticas.hidden = true;
  detenerCamara();
  try {
    await signOut(auth);
    window.location.replace('./index.html');
  } catch (error) {
    cerrandoSesion = false;
    salir.disabled = false;
    actualizarBotones();
    estadisticas.hidden = !(puedeReservar() && mostrarEstadisticas);
    mostrarEstado('No se pudo cerrar sesión. Vuelve a intentarlo.');
    console.error(error);
  }
});

// MODIFICADO: Continuar dirige a reserva.html, nunca al login automáticamente.
// El visitante debe utilizar el enlace del header; se mantiene la validación del código.
document.getElementById('form-identificar').addEventListener('submit', evento => {
  evento.preventDefault();
  if (!puedeReservar()) {
    mensaje.textContent = 'Inicia sesión con un perfil válido para continuar.';
    return;
  }
  const codigo = extraerCodigoTotem(campo.value);
  if (!codigo) {
    mensaje.textContent = 'Ingresa un código válido (por ejemplo, TOT-001) o escanea el QR.';
    return;
  }
  detenerCamara();
  window.location.assign(urlConCodigo('reserva.html', codigo));
});

// MODIFICADO: la cámara requiere sesión válida. Un QR leído rellena el campo
// y el usuario confirma voluntariamente con Continuar, igual que con un QR físico.
btn.addEventListener('click', async () => {
  if (!puedeReservar() || abriendoCamara) return;
  if (escaner) {
    detenerCamara();
    mensaje.textContent = '';
    return;
  }
  const revision = ++revisionCamara;
  abriendoCamara = true;
  actualizarBotones();
  mensaje.textContent = 'Abriendo cámara…';
  try {
    const nuevoEscaner = await iniciarEscaner(video, valor => {
      if (revision !== revisionCamara || !puedeReservar()) return;
      detenerCamara();
      const codigo = extraerCodigoTotem(valor);
      if (!codigo) {
        mensaje.textContent = 'El QR no contiene un código válido de tótem. Vuelve a escanearlo.';
        return;
      }
      cargarCodigo(codigo);
      mensaje.textContent = 'Código recibido. Revísalo y presiona Continuar.';
    });
    if (revision !== revisionCamara || !puedeReservar()) {
      nuevoEscaner.stop();
      return;
    }
    escaner = nuevoEscaner;
    btn.textContent = 'Detener cámara';
    mensaje.textContent = 'Coloca el código QR frente a la cámara.';
  } catch (error) {
    if (revision === revisionCamara) mensaje.textContent = error.message || 'No se pudo usar la cámara. Ingresa el código manualmente.';
  } finally {
    if (revision === revisionCamara) {
      abriendoCamara = false;
      actualizarBotones();
    }
  }
});
window.addEventListener('pagehide', detenerCamara);
