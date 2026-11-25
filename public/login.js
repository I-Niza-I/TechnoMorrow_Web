
import { auth, firebaseConfigurado } from './firebase-config.js';

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence
} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';

import { codigoDesdeURL, urlConCodigo } from './totem-utils.js';

import { obtenerRolUsuario, mensajeErrorPerfil } from './roles.js';

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

// Mostrar mensajes de error
function mostrarError(mensaje) {
  errorBox.textContent = mensaje;
  errorBox.hidden = !mensaje;
}

// Activar o desactivar el botón de inicio de sesión
function bloquear(bloqueado, texto = 'Iniciar sesión') {
  boton.disabled = bloqueado || !firebaseConfigurado;
  textoBoton.textContent = texto;
}

// El administrador puede iniciar sesión sin seleccionar un tótem
if (!codigo) {
  etiquetaCodigo.textContent =
    'Sin tótem seleccionado · acceso administrativo';

  cajaCodigo.querySelector('.verified').hidden = true;
} else {
  etiquetaCodigo.textContent = codigo;
}

// Comprobar configuración de Firebase
if (!firebaseConfigurado) {
  mostrarError(
    'Completa los datos de firebase-config.js con los de tu aplicación web.'
  );

  bloquear(true);
}

// Consultar rol y redirigir al usuario
async function irSegunRol(usuario) {
  const rol = await obtenerRolUsuario(usuario);

  // ADMINISTRADOR
  if (rol === 'admin') {
    window.location.replace('./estadisticas.html');
    return true;
  }

  // USUARIO NORMAL
  if (rol === 'usuario') {

    // Para reservar se necesita un tótem previamente identificado
    if (!codigo) {
      mostrarError(
        'Sesión iniciada, pero necesitas identificar un tótem para reservar. ' +
        'Vuelve al inicio e ingresa o escanea su código.'
      );

      return false;
    }

    window.location.replace(
      urlConCodigo('reserva.html', codigo)
    );

    return true;
  }

  return false;
}

// Si ya existe una sesión, consultar el rol
if (auth) {
  onAuthStateChanged(
    auth,

    async usuario => {
      if (!usuario || enviando) return;

      bloquear(true, 'Comprobando permisos…');
      mostrarError('');

      try {
        await irSegunRol(usuario);

      } catch (error) {
        console.error(
          'Error consultando perfil de Firestore:',
          error
        );

        mostrarError(mensajeErrorPerfil(error));

      } finally {
        bloquear(false);
      }
    },

    error => {
      console.error('Error de sesión:', error);

      mostrarError(
        'No se pudo comprobar tu sesión de Firebase.'
      );
    }
  );
}

// Mostrar u ocultar contraseña
toggle.addEventListener('click', () => {
  const visible = clave.type === 'text';

  clave.type = visible ? 'password' : 'text';

  toggle.setAttribute(
    'aria-pressed',
    String(!visible)
  );

  toggle.setAttribute(
    'aria-label',
    visible ? 'Mostrar contraseña' : 'Ocultar contraseña'
  );
});

// Procesar formulario de inicio de sesión
form.addEventListener('submit', async evento => {
  evento.preventDefault();

  if (!auth || enviando) return;

  // Validar campos
  if (!email.value.trim() || !clave.value) {
    mostrarError('Completa el correo y la contraseña.');
    return;
  }

  enviando = true;

  bloquear(true, 'Verificando credenciales…');
  mostrarError('');

  try {
    // Persistencia de la sesión
    await setPersistence(
      auth,
      browserSessionPersistence
    );

    // Autenticación con Firebase
    const credencial = await signInWithEmailAndPassword(
      auth,
      email.value.trim(),
      clave.value
    );

    bloquear(true, 'Consultando perfil…');

    // Consultar rol en Firestore y redirigir
    await irSegunRol(credencial.user);

  } catch (error) {
    console.error('Error de inicio de sesión:', error);

    if (error?.code === 'auth/too-many-requests') {
      mostrarError(
        'Demasiados intentos de acceso. Vuelve a intentarlo más tarde.'
      );

    } else if (error?.code === 'auth/network-request-failed') {
      mostrarError(
        'No se pudo conectar con Firebase. Comprueba tu conexión.'
      );

    } else if (
      String(error?.code || '').startsWith('auth/')
    ) {
      mostrarError(
        'Correo o contraseña incorrectos. Comprueba tus credenciales.'
      );

    } else {
      mostrarError(mensajeErrorPerfil(error));
    }

  } finally {
    enviando = false;
    bloquear(false);
  }
});
