/** Utilidades para leer códigos o URL de QR. No prueban que el tótem exista en Firestore. */
export function extraerCodigoTotem(valor) {
  if (typeof valor !== 'string') return null;
  let dato = valor.trim();
  if (!dato || dato.length > 2048) return null;
  // QR de enlace: https://.../index.html?enchufe=TOT-001
  try {
    if (/^https?:\/\//i.test(dato)) {
      const url = new URL(dato);
      dato = url.searchParams.get('enchufe') || url.searchParams.get('totem') || url.searchParams.get('codigo') || '';
    } else if (/^\??(enchufe|totem|codigo)=/i.test(dato)) {
      const params = new URLSearchParams(dato.replace(/^\?/, ''));
      dato = params.get('enchufe') || params.get('totem') || params.get('codigo') || '';
    }
  } catch { return null; }
  dato = dato.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(dato) ? dato : null;
}
export function codigoDesdeURL() {
  const params = new URLSearchParams(window.location.search);
  return extraerCodigoTotem(params.get('enchufe') || params.get('totem') || params.get('codigo') || '');
}
export function urlConCodigo(pagina, codigo) {
  return `./${pagina}?enchufe=${encodeURIComponent(codigo)}`;
}

/** Escáner de QR con BarcodeDetector. Devuelve objeto con stop() y error amigable. */
export async function iniciarEscaner(video, alDetectar) {
  if (!('BarcodeDetector' in window)) throw new Error('Este navegador no admite lectura de QR. Ingresa el código manualmente.');
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('La cámara requiere HTTPS o localhost y permisos del navegador.');
  const detector = new BarcodeDetector({ formats: ['qr_code'] });
  const stream = await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'}}});
  let activo=true, cuadro=null;
  const stop=()=>{activo=false;if(cuadro!==null)cancelAnimationFrame(cuadro);stream.getTracks().forEach(t=>t.stop());video.pause();video.srcObject=null;video.hidden=true;};
  try {video.srcObject=stream;video.hidden=false;await video.play();} catch(e){stop();throw e;}
  async function loop(){
    if(!activo)return;
    try {
      const encontrados=await detector.detect(video);
      if(encontrados.length){stop();alDetectar(encontrados[0].rawValue);return;}
    } catch(e) { /* Un fotograma borroso no interrumpe la lectura. */ }
    if(activo) cuadro=requestAnimationFrame(loop);
  }
  cuadro=requestAnimationFrame(loop);
  return {stop};
}
