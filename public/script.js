const formularioTiempo = document.querySelector("#form-tiempo");
const panelIdentificacion = document.querySelector("#identificacion");
const panelCodigo = document.querySelector("#panel-codigo");
const panelQr = document.querySelector("#panel-qr");
const instruccionMetodo = document.querySelector("#instruccion-metodo");
const cambiarMetodo = document.querySelector("#cambiar-metodo");
const campoCodigo = document.querySelector("#codigo-enchufe");
const confirmarCodigo = document.querySelector("#confirmar-codigo");
const abrirCamara = document.querySelector("#abrir-camara");
const video = document.querySelector("#vista-camara");
const mensajeCamara = document.querySelector("#mensaje-camara");
const mensajeReserva = document.querySelector("#mensaje-reserva");
const temporizador = document.querySelector("#temporizador");
const parametros = new URLSearchParams(window.location.search);
const idEnchufeQR = parametros.get("enchufe");

const ESP8266_URL = "http://IPACA/activar";

// ENSERIO ALGUIEN POR FAVOR QUE ME MATE POR FAVOR AAAAAAAAAAAAAA
let segundosRestantes = 120;
let intervaloTemporizador;
let flujoCamara;
let cuadroEscaneo;
let detector;
let metodoActual = "codigo";
let reservaFinalizada = false;

if (idEnchufeQR) {
  const campoCodigo = document.querySelector("#codigo-enchufe");

  if (campoCodigo) {
    campoCodigo.value = idEnchufeQR;
  }

  console.log("Enchufe detectado:", idEnchufeQR);
}

formularioTiempo.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const seleccion = formularioTiempo.querySelector(
    'input[name="tiempo"]:checked'
  );

  if (!seleccion) {
    alert("Selecciona un tiempo de carga para continuar.");
    return;
  }
    const celular = window.matchMedia("(max-width: 700px)").matches;
    cambiarVista(celular ? "qr" : "codigo");

    formularioTiempo.classList.add("fade-out");
    await esperarFinDelFade(formularioTiempo);

    formularioTiempo.hidden = true;
    formularioTiempo.classList.remove("fade-out");

    panelIdentificacion.hidden = false;
    panelIdentificacion.classList.add("fade-out");

    // Permite que el navegador aplique primero el estado transparente.
    void panelIdentificacion.offsetWidth;

    requestAnimationFrame(async () => {
        panelIdentificacion.classList.remove("fade-out");
        await esperarFinDelFade(panelIdentificacion);

        panelIdentificacion.scrollIntoView({
        behavior: "smooth",
        block: "center"
        });

        iniciarTemporizador();
    });
});

function cambiarVista(metodo) {
  metodoActual = metodo;

  const mostrarCodigo = metodo === "codigo";
  panelCodigo.hidden = !mostrarCodigo;
  panelQr.hidden = mostrarCodigo;

  instruccionMetodo.textContent = mostrarCodigo
    ? "Escribe el código único impreso en el enchufe."
    : "Usa la cámara de este celular para escanear el QR del enchufe.";

  cambiarMetodo.textContent = mostrarCodigo
    ? "Prefiero escanear un QR"
    : "Prefiero ingresar el código";
}

cambiarMetodo.addEventListener("click", () => {
  cambiarVista(metodoActual === "codigo" ? "qr" : "codigo");
  detenerCamara();
});

confirmarCodigo.addEventListener("click", () => {
  confirmarEnchufe(campoCodigo.value);
});

campoCodigo.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter") {
    evento.preventDefault();
    confirmarEnchufe(campoCodigo.value);
  }
});

function esperarFinDelFade(elemento) {
  return new Promise((resolve) => {
    let terminado = false;

    const finalizar = () => {
      if (terminado) return;
      terminado = true;
      clearTimeout(respaldo);
      elemento.removeEventListener("transitionend", alTerminar);
      resolve();
    };

    const alTerminar = (evento) => {
      if (evento.target === elemento && evento.propertyName === "opacity") {
        finalizar();
      }
    };

    elemento.addEventListener("transitionend", alTerminar);

    // Respaldo por si el navegador no dispara transitionend.
    const respaldo = setTimeout(finalizar, 450);
  });
}

async function iniciarEscaneo() {
  mensajeCamara.textContent = "";

  if (!("BarcodeDetector" in window)) {
    mensajeCamara.textContent =
      "Este navegador no permite escanear QR aqui. Cambia al ingreso manual del codigo.";
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    mensajeCamara.textContent =
      "No se puede acceder a la camara. Revisa que la pagina use HTTPS y permite el acceso a la camara.";
    return;
  }

  try {
    detector = new BarcodeDetector({ formats: ["qr_code"] });

    flujoCamara = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } }
    });

    video.srcObject = flujoCamara;
    video.hidden = false;
    await video.play();

    escanearCuadro();
  } catch (error) {
    mensajeCamara.textContent =
      "No se pudo abrir la camara. Revisa los permisos del navegador o ingresa el código manualmente.";
    detenerCamara();
  }
}

async function escanearCuadro() {
  if (!flujoCamara || reservaFinalizada) return;

  try {
    const codigos = await detector.detect(video);

    if (codigos.length > 0) {
      confirmarEnchufe(codigos[0].rawValue);
      return;
    }
  } catch (error) {
    mensajeCamara.textContent = "No se pudo leer el QR. Intentalo de nuevo.";
  }

  cuadroEscaneo = requestAnimationFrame(escanearCuadro);
}

abrirCamara.addEventListener("click", iniciarEscaneo);

async function confirmarEnchufe(valor) {
  const identificador = extraerIdentificador(valor);
  const seleccion = formularioTiempo.querySelector(
    'input[name="tiempo"]:checked'
  );
  const minutos = Number(seleccion?.value);

  if (!identificador) {
    mensajeReserva.textContent = "Ingresa o escanea un código válido.";
    return;
  }

  if (![30, 45, 60].includes(minutos)) {
    mensajeReserva.textContent = "Selecciona 30, 45 o 60 minutos.";
    return;
  }

  mensajeReserva.textContent = "Enviando la activación al tótem…";
  detenerCamara();

  try {
    const datos = new URLSearchParams({
      enchufe: identificador,
      minutos: String(minutos)
    });

    const respuesta = await fetch(ESP8266_URL, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: datos,
      targetAddressSpace: "local"
    });

    if (!respuesta.ok) {
      throw new Error("El ESP8266 rechazó la activación.");
    }

    reservaFinalizada = true;
    clearInterval(intervaloTemporizador);

    window.location.replace("./activado.html");
  } catch (error) {
    mensajeReserva.textContent =
      "No se pudo activar el tótem. Revisa la conexión Wi-Fi y vuelve a intentarlo.";
    console.error(error);
  }
}

/*
// Codigo que le pedi al claudio para adaptar la wea de arriba al node
async function confirmarEnchufe(valor) {
  const identificador = extraerIdentificador(valor);

  if (!identificador) {
    mensajeReserva.textContent = "Ingresa o escanea un código válido.";
    return;
  }

  mensajeReserva.textContent = "Conectando con el tótem…";

  try {
    const respuesta = await fetch(ESP8266_URL, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "text/plain"
      },
      body: identificador,

      // Indica a Chrome que la solicitud va a un dispositivo de la red local.
      targetAddressSpace: "local"
    });

    if (!respuesta.ok) {
      throw new Error("El ESP8266 rechazó la activación.");
    }

    reservaFinalizada = true;
    detenerCamara();
    clearInterval(intervaloTemporizador);

    window.location.replace("./activado.html");
  } catch (error) {
    mensajeReserva.textContent =
      "No se pudo activar el totem. comprobar que el node que este prendido y conectado al mismo wifi.";
    console.error(error);
  }
}

*/

function iniciarTemporizador() {
  clearInterval(intervaloTemporizador);
  actualizarTemporizador();

  intervaloTemporizador = setInterval(() => {
    segundosRestantes -= 1;
    actualizarTemporizador();

    if (segundosRestantes <= 0) {
      clearInterval(intervaloTemporizador);
      reservaFinalizada = true;
      detenerCamara();

      mensajeReserva.textContent =
        "Se agotó el tiempo. Vuelve a elegir el tiempo de carga para intentarlo otra vez.";
      confirmarCodigo.disabled = true;
      abrirCamara.disabled = true;
      cambiarMetodo.disabled = true;
    }
  }, 1000);
}

function actualizarTemporizador() {
  const minutos = Math.floor(segundosRestantes / 60);
  const segundos = segundosRestantes % 60;

  temporizador.textContent =
    `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
}

function detenerCamara() {
  if (cuadroEscaneo) {
    cancelAnimationFrame(cuadroEscaneo);
    cuadroEscaneo = null;
  }

  if (flujoCamara) {
    flujoCamara.getTracks().forEach((pista) => pista.stop());
    flujoCamara = null;
  }

  video.srcObject = null;
  video.hidden = true;
}


// Redirecciona a la pagina final
function confirmarEnchufe(valor) {
  const identificador = extraerIdentificador(valor);

  if (!identificador) {
    mensajeReserva.textContent = "Ingresa o escanea un código válido.";
    return;
  }

  reservaFinalizada = true;
  detenerCamara();
  clearInterval(intervaloTemporizador);

  // Reemplaza la pagina actual en el historial del navegador.
  window.location.replace("./activado.html");
}

