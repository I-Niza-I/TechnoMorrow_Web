import { auth, firebaseConfigurado } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { codigoDesdeURL, urlConCodigo } from './totem-utils.js';
import { obtenerRolUsuario, mensajeErrorPerfil } from './roles.js';
import { observarTotem, codigoPermitido, ahoraServidor, conexionLista } from './control-totem.js';
import { guardarReserva, urlReserva, segundosValidos } from './flujo-sesion.js';

const codigo = codigoDesdeURL();
const $ = id => document.getElementById(id);
const form = $('form-tiempo'), boton = $('confirmar-tiempo'), espera = $('verificando-sesion'), panel = $('panel-reserva');
const mensaje = $('mensaje-reserva'), estadoTotem = $('estado-totem-rtdb');
let estado = null, uid = null, observacion = null, reloj = null, enviando = false, revision = 0;
function aviso(texto) { mensaje.textContent = texto; mensaje.hidden = !texto; mensaje.dataset.error = 'true'; }
function actualizar() {
  const conectado = conexionLista();
  const disponible = conectado && estado?.estado === 'libre';
  estadoTotem.dataset.estado = disponible ? 'libre' : 'ocupado';
  estadoTotem.textContent = !conectado ? 'Conectando con Firebase…' : !estado ? 'Consultando disponibilidad…' : disponible ? 'Disponible' : estado.estado === 'pendiente' ? 'Ocupado · solicitud pendiente' : estado.estado === 'activo' ? `Ocupado · ${Math.max(0,Math.ceil((estado.vence-ahoraServidor())/1000))} s restantes` : 'No disponible';
  const seleccion = Number(form.querySelector('input[name="tiempo"]:checked')?.value);
  boton.textContent = segundosValidos(seleccion) ? `Confirmar reserva de ${seleccion} segundos` : 'Confirmar reserva';
  boton.disabled = !uid || auth?.currentUser?.uid !== uid || enviando || !disponible || !segundosValidos(seleccion);
}
function detener() { observacion?.(); observacion=null; clearInterval(reloj); reloj=null; }
if (!codigo || !codigoPermitido(codigo)) location.replace('./index.html');
else if (!firebaseConfigurado || !auth) espera.textContent='No se pudo configurar Firebase.';
else onAuthStateChanged(auth, async usuario => {
  const actual=++revision; uid=null; estado=null; detener(); panel.hidden=true; espera.hidden=false;
  if (!usuario) { location.replace(urlConCodigo('login.html',codigo)); return; }
  try {
    const rol=await obtenerRolUsuario(usuario);
    if (actual!==revision || auth.currentUser?.uid!==usuario.uid) return;
    // Se conserva el comportamiento actual de la página de reserva para administradores.
    if (rol==='admin') { location.replace('./estadisticas.html'); return; }
    uid=usuario.uid; $('totem-codigo-inicial').textContent=codigo; espera.hidden=true; panel.hidden=false;
    observacion=observarTotem(codigo, datos=>{estado=datos; actualizar();}, e=>{estado=null; aviso('No se pudo consultar el tótem. Revisa tu conexión o permisos.'); actualizar(); console.error(e);});
    reloj=setInterval(actualizar,500); actualizar();
  } catch(e) { if(actual===revision){espera.textContent=mensajeErrorPerfil(e); console.error(e);} }
}, e=>{espera.textContent='No se pudo verificar la sesión.'; console.error(e);});
form.addEventListener('change',actualizar);
form.addEventListener('submit',e=>{
  e.preventDefault();
  if(enviando || !uid || auth?.currentUser?.uid!==uid || !conexionLista() || estado?.estado!=='libre') return;
  const segundos=Number(form.querySelector('input[name="tiempo"]:checked')?.value);
  if(!segundosValidos(segundos)) return;
  enviando=true; actualizar(); aviso('');
  try {
    // La siguiente página inicia exactamente una solicitud para este ID.
    const r={id:crypto.randomUUID(),uid,codigo,segundos,fase:'nueva'};
    guardarReserva(r);
    location.assign(urlReserva('activado.html',r.id));
  } catch(e) { enviando=false; aviso('No se pudo preparar la reserva. Comprueba el almacenamiento de sesión del navegador.'); actualizar(); console.error(e); }
});
$('cerrar-sesion').addEventListener('click',async()=>{try { await signOut(auth); location.replace('./index.html'); }catch(e){aviso('No se pudo cerrar la sesión.'); console.error(e);}});
window.addEventListener('pagehide',detener);
window.addEventListener('pageshow',e=>{if(e.persisted) location.reload();});
