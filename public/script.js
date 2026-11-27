import { auth, firebaseConfigurado } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { codigoDesdeURL, urlConCodigo } from './totem-utils.js';
import { obtenerRolUsuario, mensajeErrorPerfil } from './roles.js';
import { observarTotem, codigoPermitido, ahoraServidor, conexionLista, observarBloqueo, bloqueoVigente } from './control-totem.js';
import { guardarReserva, urlReserva, segundosValidos } from './flujo-sesion.js';

const codigo = codigoDesdeURL();
const $ = id => document.getElementById(id);
const form = $('form-tiempo'), boton = $('confirmar-tiempo'), espera = $('verificando-sesion'), panel = $('panel-reserva');
const mensaje = $('mensaje-reserva'), estadoTotem = $('estado-totem-rtdb');
let estado = null, uid = null, observaciones = [], reloj = null, enviando = false, revision = 0;
let bloqueo = null, bloqueoLeido = false, controles = {};
const avisoBloqueo = $('aviso-bloqueo');
function bloqueado() { return !bloqueoLeido || bloqueoVigente(bloqueo, controles[bloqueo?.codigo], ahoraServidor()); }
function aviso(texto) { mensaje.textContent = texto; mensaje.hidden = !texto; mensaje.dataset.error = 'true'; }
function actualizar() {
  const conectado = conexionLista();
  const disponible = conectado && estado?.estado === 'libre';
  estadoTotem.dataset.estado = disponible ? 'libre' : 'ocupado';
  estadoTotem.textContent = !conectado ? 'Conectando con Firebase…' : !estado ? 'Consultando disponibilidad…' : disponible ? 'Disponible' : estado.estado === 'pendiente' ? 'Ocupado · solicitud pendiente' : estado.estado === 'activo' ? `Ocupado · ${Math.max(0,Math.ceil((estado.vence-ahoraServidor())/1000))} s restantes` : 'No disponible';
  const restringido = bloqueado();
  avisoBloqueo.hidden = conectado && bloqueoLeido && !restringido;
  if (!conectado || !bloqueoLeido) avisoBloqueo.textContent = 'Comprobando el período de espera de tu cuenta…';
  else if (restringido) {
    const anterior = controles[bloqueo?.codigo];
    const enUso = anterior?.id === bloqueo?.id && ['pendiente','activo'].includes(anterior.estado) && anterior.vence > ahoraServidor();
    const queda = Math.max(0, Math.ceil((bloqueo.hasta - ahoraServidor()) / 1000));
    const tiempo = Number.isFinite(queda) ? `${Math.floor(queda/60)}:${String(queda%60).padStart(2,'0')}` : '—';
    avisoBloqueo.textContent = enUso ? `Ya tienes una solicitud o reserva en ${bloqueo.codigo}. Próxima reserva en ${tiempo}${bloqueo.fase==='provisional'?' como máximo':''}.` : `Debes esperar ${tiempo}${bloqueo.fase==='provisional'?' como máximo (verificando autorización)':''} antes de reservar otro tótem.`;
  }
  const seleccion = Number(form.querySelector('input[name="tiempo"]:checked')?.value);
  boton.textContent = segundosValidos(seleccion) ? `Confirmar reserva de ${seleccion} segundos` : 'Confirmar reserva';
  boton.disabled = !uid || auth?.currentUser?.uid !== uid || enviando || !disponible || restringido || !segundosValidos(seleccion);
}
function detener() { observaciones.forEach(stop=>stop()); observaciones=[]; clearInterval(reloj); reloj=null; }
if (!codigo || !codigoPermitido(codigo)) location.replace('./index.html');
else if (!firebaseConfigurado || !auth) espera.textContent='No se pudo configurar Firebase.';
else onAuthStateChanged(auth, async usuario => {
  const actual=++revision; uid=null; estado=null; bloqueo=null; bloqueoLeido=false; controles={}; detener(); panel.hidden=true; espera.hidden=false;
  if (!usuario) { location.replace(urlConCodigo('login.html',codigo)); return; }
  try {
    const rol=await obtenerRolUsuario(usuario);
    if (actual!==revision || auth.currentUser?.uid!==usuario.uid) return;
    // Se conserva el comportamiento actual de la página de reserva para administradores.
    if (rol==='admin') { location.replace('./estadisticas.html'); return; }
    uid=usuario.uid; $('totem-codigo-inicial').textContent=codigo; espera.hidden=true; panel.hidden=false;
    for (const c of ['TOT-001','TOT-002']) {
      observaciones.push(observarTotem(c, datos=>{if(actual!==revision)return; controles[c]=datos; if(c===codigo)estado=datos; actualizar();}, e=>{if(actual!==revision)return; delete controles[c]; if(c===codigo)estado=null; aviso('No se pudo consultar el tótem. Revisa tu conexión o permisos.'); actualizar(); console.error(e);}));
    }
    observaciones.push(observarBloqueo(uid, datos=>{if(actual!==revision)return; bloqueo=datos; bloqueoLeido=true; actualizar();}, e=>{if(actual!==revision)return; bloqueoLeido=false; aviso('No se pudo comprobar el período de espera.'); actualizar(); console.error(e);}));
    reloj=setInterval(actualizar,500); actualizar();
  } catch(e) { if(actual===revision){espera.textContent=mensajeErrorPerfil(e); console.error(e);} }
}, e=>{espera.textContent='No se pudo verificar la sesión.'; console.error(e);});
form.addEventListener('change',actualizar);
form.addEventListener('submit',e=>{
  e.preventDefault();
  if(enviando || !uid || auth?.currentUser?.uid!==uid || !conexionLista() || estado?.estado!=='libre' || bloqueado()) return;
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
