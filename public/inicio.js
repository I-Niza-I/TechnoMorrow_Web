import { extraerCodigoTotem, codigoDesdeURL, urlConCodigo, iniciarEscaner } from './totem-utils.js';
const campo=document.getElementById('codigo-inicial');
const mensaje=document.getElementById('inicio-mensaje');
const video=document.getElementById('camara-inicio');
const btn=document.getElementById('escanear-inicio');
let escaner=null;
function proceder(valor) {
  const codigo=extraerCodigoTotem(valor);
  if(!codigo){mensaje.textContent='Ingresa un código válido (por ejemplo, TOT-001) o escanea el QR.';return;}
  if(escaner)escaner.stop();
  window.location.assign(urlConCodigo('login.html',codigo));
}
// Compatibilidad con QR antiguos que apuntan al inicio con ?enchufe=.
const codigoQR=codigoDesdeURL();
if(codigoQR){window.location.replace(urlConCodigo('login.html',codigoQR));}
document.getElementById('form-identificar').addEventListener('submit',e=>{e.preventDefault();proceder(campo.value);});
btn.addEventListener('click',async()=>{
  if(escaner){escaner.stop();escaner=null;btn.textContent='▦   Escanear código QR';return;}
  mensaje.textContent='Abriendo cámara…';btn.disabled=true;
  try{
    escaner=await iniciarEscaner(video,valor=>proceder(valor));
    btn.textContent='Detener cámara';mensaje.textContent='Coloca el código QR frente a la cámara.';
  }catch(e){mensaje.textContent=e.message||'No se pudo usar la cámara. Ingresa el código manualmente.';}
  finally{btn.disabled=false;}
});
window.addEventListener('pagehide',()=>escaner?.stop());
