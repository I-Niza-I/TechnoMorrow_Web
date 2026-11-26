
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

// MODIFICADO: cualquier usuario puede iniciar sesión sin identificar un tótem.
// Si la URL contiene un código, se conserva para volver al inicio sin perderlo.
const destinoInicio = codigo ? urlConCodigo('index.html', codigo) : './index.html';
document.getElementById('volver-inicio-login').href = destinoInicio;
if (codigo) {
  etiquetaCodigo.textContent = codigo;
  cajaCodigo.hidden = false;
}

// Comprobar configuración de Firebase
if (!firebaseConfigurado) {
  mostrarError(
    'Completa los datos de firebase-config.js con los de tu aplicación web.'
  );

  bloquear(true);
}

// MODIFICADO: el rol se valida, pero ya no determina una redirección diferente.
// Ambos perfiles válidos vuelven al index; allí se habilitan sus permisos.
async function volverAlInicio(usuario) {
  await obtenerRolUsuario(usuario);
  if (auth.currentUser?.uid !== usuario.uid) return;
  window.location.replace(destinoInicio);
}

// Si ya existe una sesión, consultar el rol
if (auth) {
  onAuthStateChanged(
    auth,

    async usuario => {
      // NUEVO: esperar la recuperación de sesión antes de habilitar el formulario.
      if (enviando) return;
      if (!usuario) { bloquear(false); return; }

      bloquear(true, 'Comprobando permisos…');
      mostrarError('');

      try {
        await volverAlInicio(usuario);

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

      mostrarError('No se pudo comprobar tu sesión de Firebase. Recarga la página.');
      bloquear(true);
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

  // NUEVO: impedir el envío mientras se recupera o verifica la sesión.
  if (!auth || enviando || boton.disabled) return;

  // Validar campos
  if (!email.value.trim() || !clave.value) {
    mostrarError('Completa el correo y la contraseña.');
    return;
  }

  enviando = true;

  bloquear(true, 'Verificando credenciales…');
  mostrarError('');

  try {
    // CONSERVADO: la sesión permanece en la pestaña durante la navegación
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

    // MODIFICADO: consultar el perfil y regresar al inicio conservando el código
    await volverAlInicio(credencial.user);

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
