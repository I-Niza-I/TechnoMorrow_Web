import { app, auth, firebaseConfigurado } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { getFirestore, doc, getDocFromServer, setDoc } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';
import { obtenerRolUsuario, mensajeErrorPerfil } from './roles.js';
import { idDesdeURL, uuidValido, calificacionValida } from './flujo-sesion.js';
const $=id=>document.getElementById(id);
const id=idDesdeURL(), fs=app?getFirestore(app):null, form=$('form-satisfaccion');
const estado=$('estado-encuesta'), enviar=$('enviar-evaluacion'), comentario=$('comentario');
let uid=null, revision=0, nota=null, habilitada=false, enviando=false, comprobando=false, completa=false, noEvaluable=false, reloj=null, limite=0;
const formato=n=>n.toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1});
function mensaje(texto,error=false){estado.textContent=texto;estado.hidden=!texto;estado.dataset.error=String(error);}
function actualizarBoton(){enviar.disabled=!habilitada||enviando||!calificacionValida(nota)||auth?.currentUser?.uid!==uid;}
function mostrarGracias(){completa=true;habilitada=false;clearInterval(reloj);form.hidden=true;$('revisar-encuesta').hidden=true;mensaje('');$('gracias').hidden=false;}
// Dos controles nativos de radio por estrella: clic en la mitad izquierda o derecha.
for(let i=1;i<=5;i++){
  const star=document.createElement('div');star.className='estrella';
  star.innerHTML=`<span class="estrella-base" aria-hidden="true">★</span><span class="estrella-llena" aria-hidden="true">★</span><input type="radio" name="calificacion" id="rating-${i*2-1}" value="${i-0.5}" aria-label="${formato(i-0.5)} de 5 estrellas" required><label class="mitad" for="rating-${i*2-1}" title="${formato(i-0.5)} estrellas"></label><input type="radio" name="calificacion" id="rating-${i*2}" value="${i}" aria-label="${formato(i)} de 5 estrellas"><label class="entera" for="rating-${i*2}" title="${formato(i)} estrellas"></label>`;
  $('estrellas').append(star);
}
$('estrellas').addEventListener('change',e=>{
  if(e.target.name!=='calificacion')return;
  nota=Number(e.target.value);if(!calificacionValida(nota))return;
  Array.from($('estrellas').children).forEach((el,i)=>el.style.setProperty('--fill',`${Math.max(0,Math.min(100,(nota-i)*100))}%`));
  $('puntaje').textContent=`${formato(nota)} / 5`;
  $('descripcion-puntaje').textContent=nota<=1?'Muy insatisfecho':nota<=2?'Insatisfecho':nota<=3?'Neutral':nota<=4?'Satisfecho':'Muy satisfecho';actualizarBoton();
});
comentario.addEventListener('input',()=>{$('cantidad').textContent=String(comentario.value.length);});
async function comprobar(){
  if(!uid || auth.currentUser?.uid!==uid || comprobando || enviando || completa || noEvaluable) return;
  comprobando=true;const actual=revision;const propietario=uid;
  try {
    const reserva=await getDocFromServer(doc(fs,'reservas',id));
    if(actual!==revision||auth.currentUser?.uid!==propietario)return;
    const datos=reserva.data();
    if(!reserva.exists() || datos.id_usuario!==propietario){mensaje('No se encontró una reserva propia verificable.',true);return;}
    if(['cancelada','indeterminada'].includes(datos.estado)){noEvaluable=true;clearInterval(reloj);mensaje('No existe una finalización verificable para esta reserva. No se puede evaluarla.',true);$('revisar-encuesta').hidden=true;return;}
    if(datos.estado!=='finalizada' || !datos.fecha_hora_fin?.toMillis){mensaje('Esperando que el backend registre la finalización de la reserva. No se ha guardado ninguna evaluación.');return;}
    const encuesta=await getDocFromServer(doc(fs,'satisfaccion',id));
    if(actual!==revision||auth.currentUser?.uid!==propietario)return;
    if(encuesta.exists()){mostrarGracias();return;}
    habilitada=true;clearInterval(reloj);form.hidden=false;$('revisar-encuesta').hidden=true;mensaje('');actualizarBoton();
  }catch(e){if(actual===revision){mensaje('No se pudo verificar la reserva en Firestore. Comprueba tu conexión y que el backend local esté ejecutándose.',true);console.debug(e.code||e.message);}}
  finally{comprobando=false; if(actual===revision&&!habilitada&&!completa&&!noEvaluable&&Date.now()>=limite){clearInterval(reloj);$('revisar-encuesta').hidden=false;}}
}
function comenzarComprobacion(){clearInterval(reloj);limite=Date.now()+60000;$('revisar-encuesta').hidden=true;comprobar();reloj=setInterval(()=>{if(Date.now()>=limite){clearInterval(reloj);if(!habilitada&&!completa&&!noEvaluable)$('revisar-encuesta').hidden=false;}else comprobar();},3000);}
$('revisar-encuesta').addEventListener('click',comenzarComprobacion);
form.addEventListener('submit',async e=>{
  e.preventDefault();if(enviando||!habilitada||!calificacionValida(nota)||auth.currentUser?.uid!==uid)return;
  const texto=comentario.value.trim();if(texto.length>500){mensaje('El comentario no puede superar los 500 caracteres.',true);return;}
  enviando=true;actualizarBoton();mensaje('Guardando evaluación en Firestore…');const actual=revision;
  try{
    // El ID es la reserva. Las reglas permiten crear una sola vez y solo a su propietario.
    await setDoc(doc(fs,'satisfaccion',id),{calificacion:nota,comentario:texto});
    if(actual===revision)mostrarGracias();
  }catch(e){
    if(actual!==revision)return;
    // Si otra pestaña ya escribió el documento, reconocer el éxito sin sobrescribir.
    try{const previo=await getDocFromServer(doc(fs,'satisfaccion',id));if(actual===revision&&previo.exists()){mostrarGracias();return;}}catch{}
    if(actual===revision){mensaje('No se pudo guardar la evaluación. Revisa la conexión y vuelve a intentarlo. No se ha confirmado el guardado.',true);console.error(e);}
  }finally{enviando=false;actualizarBoton();}
});
if(!firebaseConfigurado||!auth||!fs||!uuidValido(id)) mensaje('Enlace de evaluación inválido. Realiza una reserva desde el inicio.',true);
else onAuthStateChanged(auth,async usuario=>{
  const actual=++revision;uid=null;habilitada=false;completa=false;noEvaluable=false;clearInterval(reloj);form.hidden=true;$('gracias').hidden=true;$('revisar-encuesta').hidden=true;actualizarBoton();
  if(!usuario){mensaje('Inicia sesión con la cuenta que realizó la reserva.',true);return;}
  try{
    const rol=await obtenerRolUsuario(usuario);if(actual!==revision||auth.currentUser?.uid!==usuario.uid)return;
    if(rol==='admin'){location.replace('./estadisticas.html');return;}
    uid=usuario.uid;mensaje('Verificando la reserva en Firestore…');comenzarComprobacion();
  }catch(e){if(actual===revision)mensaje(mensajeErrorPerfil(e),true);}
},e=>mensaje('No se pudo comprobar la sesión.',true));
window.addEventListener('pagehide',()=>clearInterval(reloj));
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
