/**
 * DATOS DEL PANEL — TechnoMorrow
 * -------------------------------------------------------------
 * true  -> usa los arreglos pequeños de DEMO_DATA (solo ejemplos).
 * false -> no muestra datos ficticios. Se utiliza obtenerDatosFirebase()
 *          si está definida; de lo contrario se muestra estado vacío.
 *
 * Para borrar TODOS los datos de ejemplo basta con cambiar a false.
 * No hay escritura de datos ni conexión real a Firebase en este archivo.
 */
window.TOTEMS_DEMO_ACTIVE = true;

// Esquema alineado con IdeaScript.txt: laboratorios, totems,
// reservas, usuario, satisfaccion y eventos_hardware.
// Los códigos, fechas, nombres y comentarios son SIMULADOS.
const filasReservasDemo = [
  // id, usuario, totem, fecha, hora inicio, duración (min), estado
  ['R001','U01','T01','2026-11-16','08:30',30,'finalizada'],
  ['R002','U02','T03','2026-11-16','10:00',45,'finalizada'],
  ['R003','U03','T04','2026-11-16','13:00',60,'finalizada'],
  ['R004','U04','T02','2026-11-17','09:00',30,'finalizada'],
  ['R005','U05','T05','2026-11-17','12:30',60,'finalizada'],
  ['R006','U01','T01','2026-11-17','16:00',45,'finalizada'],
  ['R007','U06','T03','2026-11-18','08:30',30,'finalizada'],
  ['R008','U07','T02','2026-11-18','10:00',45,'finalizada'],
  ['R009','U04','T04','2026-11-18','14:00',60,'finalizada'],
  ['R010','U02','T01','2026-11-18','17:00',30,'cancelada'],
  ['R011','U03','T06','2026-11-19','09:30',30,'finalizada'],
  ['R012','U05','T05','2026-11-19','11:00',60,'finalizada'],
  ['R013','U06','T03','2026-11-19','15:00',45,'finalizada'],
  ['R014','U07','T01','2026-11-20','08:00',60,'finalizada'],
  ['R015','U04','T02','2026-11-20','10:30',30,'finalizada'],
  ['R016','U01','T04','2026-11-20','13:30',45,'finalizada'],
  ['R017','U02','T05','2026-11-20','16:30',60,'finalizada'],
  ['R018','U03','T03','2026-11-21','09:00',30,'finalizada'],
  ['R019','U05','T06','2026-11-21','11:30',45,'finalizada'],
  ['R020','U06','T02','2026-11-21','15:30',30,'cancelada'],
  ['R021','U07','T01','2026-11-22','08:30',60,'finalizada'],
  ['R022','U01','T03','2026-11-22','12:00',45,'finalizada'],
  ['R023','U04','T04','2026-11-22','16:00',30,'finalizada'],
  ['R024','U02','T05','2026-11-23','09:30',60,'finalizada'],
  ['R025','U03','T02','2026-11-23','11:00',45,'finalizada'],
  ['R026','U05','T06','2026-11-23','14:30',30,'finalizada'],
  ['R027','U06','T01','2026-11-23','18:00',45,'finalizada'],
  ['R028','U07','T04','2026-11-24','09:00',60,'finalizada'],
  ['R029','U01','T03','2026-11-24','11:30',30,'finalizada'],
  ['R030','U04','T02','2026-11-24','15:00',45,'activa']
];

function agregarMinutos(hora, minutos) {
  const [h, m] = hora.split(':').map(Number);
  const total = h * 60 + m + minutos;
  return `${String(Math.floor(total / 60) % 24).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
}

window.TOTEMS_DEMO_DATA = {
  laboratorio_informatica: [
    { id_laboratorio:'LAB1', numero:'LAB 1', ubicacion:'Laboratorio de informática · Sector A' },
    { id_laboratorio:'LAB2', numero:'LAB 2', ubicacion:'Laboratorio de informática · Sector B' },
    { id_laboratorio:'LAB3', numero:'LAB 3', ubicacion:'Laboratorio de informática · Sector C' }
  ],
  totems: [
    { id_totem:'T01', id_laboratorio:'LAB1', codigo:'TOT-001', estado_operativo:'operativo' },
    { id_totem:'T02', id_laboratorio:'LAB1', codigo:'TOT-002', estado_operativo:'operativo' },
    { id_totem:'T03', id_laboratorio:'LAB2', codigo:'TOT-003', estado_operativo:'operativo' },
    { id_totem:'T04', id_laboratorio:'LAB2', codigo:'TOT-004', estado_operativo:'operativo' },
    { id_totem:'T05', id_laboratorio:'LAB3', codigo:'TOT-005', estado_operativo:'operativo' },
    { id_totem:'T06', id_laboratorio:'LAB3', codigo:'TOT-006', estado_operativo:'mantenimiento' }
  ],
  usuario: [
    { id_usuario:'U01', identificador:'DEMO-001', correo:'demo001@example.invalid', rol:'estudiante', estado:'activo', fecha_registro:'2026-11-01' },
    { id_usuario:'U02', identificador:'DEMO-002', correo:'demo002@example.invalid', rol:'estudiante', estado:'activo', fecha_registro:'2026-11-02' },
    { id_usuario:'U03', identificador:'DEMO-003', correo:'demo003@example.invalid', rol:'docente', estado:'activo', fecha_registro:'2026-11-03' },
    { id_usuario:'U04', identificador:'DEMO-004', correo:'demo004@example.invalid', rol:'estudiante', estado:'activo', fecha_registro:'2026-11-04' },
    { id_usuario:'U05', identificador:'DEMO-005', correo:'demo005@example.invalid', rol:'estudiante', estado:'activo', fecha_registro:'2026-11-05' },
    { id_usuario:'U06', identificador:'DEMO-006', correo:'demo006@example.invalid', rol:'estudiante', estado:'activo', fecha_registro:'2026-11-06' },
    { id_usuario:'U07', identificador:'DEMO-007', correo:'demo007@example.invalid', rol:'estudiante', estado:'activo', fecha_registro:'2026-11-07' }
  ],
  reservas: filasReservasDemo.map(([id_reserva,id_usuario,id_totem,fecha,hora_inicio,duracion,estado]) => ({
    id_reserva,id_usuario,id_totem,fecha,hora_inicio,hora_fin:agregarMinutos(hora_inicio,duracion),duracion,estado
  })),
  // IdeaScript NO vincula satisfaccion a una reserva ni incluye fecha.
  // Por ello sus métricas se presentan siempre como globales, sin filtro temporal.
  satisfaccion: [
    { id_satisfaccion:'S01', calificacion:5, comentario:'El proceso fue rápido y claro.' },
    { id_satisfaccion:'S02', calificacion:4, comentario:'Fácil identificar el tótem.' },
    { id_satisfaccion:'S03', calificacion:5, comentario:'Buena experiencia de uso.' },
    { id_satisfaccion:'S04', calificacion:3, comentario:'Me gustaría ver más puntos de carga.' },
    { id_satisfaccion:'S05', calificacion:4, comentario:'La reserva es sencilla.' },
    { id_satisfaccion:'S06', calificacion:5, comentario:'La interfaz es fácil de entender.' },
    { id_satisfaccion:'S07', calificacion:4, comentario:'El tiempo de carga fue suficiente.' },
    { id_satisfaccion:'S08', calificacion:4, comentario:'Útil dentro del laboratorio.' }
  ],
  // Fechas/horas son OPCIONALES: la versión compartida de IdeaScript
  // aún no las incluye para eventos_hardware (sí se discutieron en el informe).
  eventos_hardware: [
    { id_evento:'E01', id_totem:'T01', id_reserva:'R001', tipo_evento:'activacion', detalle:'Activación completada', duracion:0, estado:'correcto', fecha:'2026-11-16', hora:'08:30' },
    { id_evento:'E02', id_totem:'T03', id_reserva:'R007', tipo_evento:'activacion', detalle:'Activación completada', duracion:0, estado:'correcto', fecha:'2026-11-18', hora:'08:30' },
    { id_evento:'E03', id_totem:'T06', id_reserva:null, tipo_evento:'desconexion', detalle:'No se recibió comunicación', duracion:180, estado:'advertencia', fecha:'2026-11-19', hora:'14:00' },
    { id_evento:'E04', id_totem:'T06', id_reserva:null, tipo_evento:'reinicio', detalle:'Restablecimiento del controlador', duracion:0, estado:'correcto', fecha:'2026-11-19', hora:'14:03' },
    { id_evento:'E05', id_totem:'T05', id_reserva:'R024', tipo_evento:'activacion', detalle:'Activación completada', duracion:0, estado:'correcto', fecha:'2026-11-23', hora:'09:30' },
    { id_evento:'E06', id_totem:'T02', id_reserva:'R030', tipo_evento:'activacion', detalle:'Activación completada', duracion:0, estado:'correcto', fecha:'2026-11-24', hora:'15:00' }
  ]
};

window.TOTEMS_EMPTY_DATA = () => ({
  laboratorio_informatica: [], totems: [], usuario: [], reservas: [],
  satisfaccion: [], eventos_hardware: []
});

// Punto único de integración con Firebase / Firestore.
window.obtenerDatosPanel = async function () {
  if (window.TOTEMS_DEMO_ACTIVE) return window.TOTEMS_DEMO_DATA;
  if (typeof window.obtenerDatosFirebase === 'function') {
    return await window.obtenerDatosFirebase();
  }
  return window.TOTEMS_EMPTY_DATA();
};
