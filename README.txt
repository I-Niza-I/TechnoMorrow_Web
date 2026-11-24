TechnoMorrow — Panel de estadísticas (prototipo web estático)
===============================================================

ARCHIVOS NUEVOS
  estadisticas.html        Panel completo: menú lateral y 6 secciones.
  estadisticas.css         Estilo responsive, paleta verde oscura original.
  estadisticas.js          Filtros, indicadores, gráficos SVG, tablas, CSV.
  estadisticas-datos.js    Datos simulados y selector de fuente de datos.

ARCHIVOS EXISTENTES
  index.html, reserva.html, activado.html, script.js, styles.css
  Se incluyen copias de los archivos adjuntos para que puedas probar
  todo junto. Se añadió un enlace discreto al panel en index.html.
  NO se modificó el flujo de reservas ni la lógica del relé.

CÓMO PROBARLO
  1. Extrae la carpeta completa en tu proyecto.
  2. Abre estadisticas.html en un navegador o sirve la carpeta localmente:
       python -m http.server 8000
     y entra en http://localhost:8000/estadisticas.html
  3. Usa el menú lateral para seleccionar las categorías.
  4. Filtra fechas, horas, laboratorio o tótem.
  5. Abre Datos y registros y exporta una tabla a CSV.

DATOS DEMO: DESACTIVAR EN UNA LÍNEA
  En estadisticas-datos.js:
       window.TOTEMS_DEMO_ACTIVE = false;
  Con esto todos los arreglos ficticios quedan SIN USAR.
  La interfaz muestra estados vacíos hasta que se conecte Firebase.

CÓMO CONECTAR FIRESTORE DESPUÉS
  Define una función asíncrona en otro script cargado ANTES de
  estadisticas.js:

       window.obtenerDatosFirebase = async function () {
           return {
             laboratorio_informatica: [],
             totems: [],
             usuario: [],
             reservas: [],
             satisfaccion: [],
             eventos_hardware: []
           };
       };

  Devuelve arreglos de objetos con los campos de IdeaScript.txt.
  Puedes llamar a Firestore con el SDK oficial dentro de la función.
  Debes convertir los Timestamp/Date a cadenas para los filtros:
       fecha: 'YYYY-MM-DD', hora_inicio: 'HH:MM'
  Los filtros de horario utilizan la hora de inicio, NO la hora real
  de suministro eléctrico ni el consumo de energía.

ALCANCE DE LAS MÉTRICAS
  - Reservas: fecha, hora, laboratorio y tótem según relaciones.
  - Uso: minutos RESERVADOS, no consumo eléctrico medido.
  - Satisfacción: GLOBAL. IdeaScript.txt no incluye fecha ni FK
    hacia reservas; por eso NO se filtra por fecha, hora o tótem.
  - Eventos: sus fechas y horas son OPCIONALES en los datos de demo;
    la versión del IdeaScript adjunto aún no las incluye.
  - Predicción: simple media móvil ilustrativa, NO un modelo ML.
  - Usuarios: la exportación contiene datos personales cuando se
    conecten datos reales: proteger el panel con autenticación,
    roles y reglas de seguridad de Firestore.

CSV
  - Se exporta UTF-8 con BOM, separador de punto y coma (;),
    compatible con Excel (configuración chilena) y con pandas:
        pandas.read_csv('archivo.csv',sep=';',encoding='utf-8-sig')
  - La sección Datos y registros exporta la tabla visible tras
    aplicar búsqueda y filtros compatibles con la entidad.

SEGURIDAD E INTEGRACIÓN
  - Este panel NO tiene autenticación, permisos ni conexión Firebase
    incorporados. NO publicarlo con datos personales reales.
  - Las consultas deben estar autorizadas por rol administrador
    mediante Firebase Auth y reglas de seguridad de Firestore.
  - No agregar credenciales de servicio privadas en archivos JS.
  - Las dos funciones confirmarEnchufe() en el script.js original:
    la última sobrescribe la primera y hace redirección sin activar
    hardware. No alteramos eso para preservar tus archivos originales.
