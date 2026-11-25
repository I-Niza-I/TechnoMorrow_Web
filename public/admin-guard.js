import { auth, firebaseConfigurado } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { obtenerRolUsuario, mensajeErrorPerfil } from './roles.js';

const mensaje = document.getElementById('admin-acceso-mensaje');
function mostrarError(texto) {
  mensaje.textContent = texto;
}

if (!firebaseConfigurado || !auth) {
  mostrarError('No se pudo iniciar Firebase. Revisa firebase-config.js.');
} else {
  onAuthStateChanged(auth, async usuario => {
    if (!usuario) {
      window.location.replace('./login.html');
      return;
    }
    try {
      const rol = await obtenerRolUsuario(usuario);
      if (rol !== 'admin') {
        window.location.replace('./index.html');
        return;
      }
      document.documentElement.classList.add('admin-autorizado');
    } catch (error) {
      console.error('Acceso al panel denegado:', error);
      mostrarError(mensajeErrorPerfil(error));
    }
  }, error => {
    console.error('Error de autenticación:', error);
    mostrarError('No fue posible verificar la sesión. Vuelve a iniciar sesión.');
  });
}

// Permite alternar entre la cuenta administrativa y la de usuario normal.
document.getElementById('cerrar-sesion-admin')?.addEventListener('click', async evento => {
  evento.preventDefault();
  try {
    await signOut(auth);
    window.location.replace('./login.html');
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    mostrarError('No se pudo cerrar sesión. Vuelve a intentarlo.');
  }
});
