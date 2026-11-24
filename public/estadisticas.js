/* TechnoMorrow — Panel de estadísticas.
   Sin dependencias ni servicios externos. Fuente de datos: estadisticas-datos.js
   NOTA: Las predicciones son una media móvil demostrativa; no son un modelo entrenado. */
(() => {
  'use strict';
  const $ = (q) => document.querySelector(q);
  const $$ = (q) => Array.from(document.querySelectorAll(q));
  const statics = {
    reservas:['id_reserva','id_usuario','id_totem','fecha','hora_inicio','hora_fin','duracion','estado'],
    totems:['id_totem','id_laboratorio','codigo','estado_operativo'],
    laboratorio_informatica:['id_laboratorio','numero','ubicacion'],
    satisfaccion:['id_satisfaccion','calificacion','comentario'],
    eventos_hardware:['id_evento','id_totem','id_reserva','tipo_evento','detalle','duracion','estado','fecha','hora'],
    usuario:['id_usuario','identificador','correo','rol','estado','fecha_registro']
  };
  const titles = {
    resumen:['Resumen general','Visión general del uso, la disponibilidad y la actividad de los puntos de carga.'],
    demanda:['Demanda y horarios','Identifica las horas y los días con mayor cantidad de solicitudes de reserva.'],
    utilizacion:['Utilización de tótems','Compara la demanda programada por punto de carga y su estado operativo.'],
    satisfaccion:['Satisfacción','Evalúa las calificaciones y comentarios registrados por los usuarios.'],
    prediccion:['Predicción de demanda','Explora una proyección estadística ilustrativa a partir del historial disponible.'],
    datos:['Datos y registros','Consulta los registros y descarga archivos CSV para su posterior análisis.']
  };
  const LABELS = {reservas:'Reservas',totems:'Tótems',laboratorio_informatica:'Laboratorios',satisfaccion:'Satisfacción',eventos_hardware:'Eventos de hardware',usuario:'Usuarios'};
  const DAYNAMES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const HOURS = [8,10,12,14,16,18];
  const COLORS = {green:'#76e682',lime:'#b3f28b',yellow:'#ebc56f',rose:'#e38d84',teal:'#469e83',violet:'#9ab5cc'};
  const STATUS_COLORS = {finalizada:COLORS.green,activa:COLORS.lime,pendiente:COLORS.yellow,cancelada:COLORS.rose};
  let source = window.TOTEMS_EMPTY_DATA();
  let page = 'resumen', tableType = 'reservas', tablePage = 1, searchQuery = '';
  let defaultMin = '', defaultMax = '';
  const number = (n) => Number.isFinite(n) ? n.toLocaleString('es-CL') : '—';
  const text = (v) => v === undefined || v === null || v === '' ? '—' : String(v);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const array = (name) => Array.isArray(source[name]) ? source[name] : [];
  const byId = (name, key) => new Map(array(name).map((row) => [String(row[key]),row]));
  const parseDay = (date) => new Date(`${date}T12:00:00Z`);
  const dayString = (date) => date.toISOString().slice(0,10);
  const shiftedDay = (iso, days) => { const date=parseDay(iso); date.setUTCDate(date.getUTCDate()+days); return dayString(date); };
  const dateLabel = (iso, short=false) => { if (!iso) return '—'; const d=parseDay(iso); if (Number.isNaN(d.getTime())) return String(iso); return d.toLocaleDateString('es-CL',{day:'2-digit',month:short?'short':'long',timeZone:'UTC'}); };
  const weekday = (iso) => DAYNAMES[parseDay(iso).getUTCDay()];
  const hourOf = (r) => Number(String(r.hora_inicio || '00:00').split(':')[0]);
  const minuteSum = (records) => records.filter(r=>r.estado!=='cancelada').reduce((sum,r)=>sum+(Number(r.duracion)||0),0);
  const timeText = (total) => { const h=Math.floor(total/60), m=total%60; return h ? `${number(h)} h${m ? ` ${m} min` : ''}` : `${number(m)} min`; };
  const empty = (message='No hay registros para los filtros seleccionados.') => `<div class="empty-state"><div class="empty-icon"><svg class="ic"><use href="#ic-activity"></use></svg></div><strong>Sin datos para mostrar</strong><p>${esc(message)}</p></div>`;
  const setHTML = (id,html) => { const el=$(id); if(el) el.innerHTML=html; };
  const setText = (id,v) => {const el=$(id);if(el)el.textContent=v;};

  function selectedTotems() {
    const lab=$('#filter-lab').value, totem=$('#filter-totem').value;
    return array('totems').filter(t=>(!lab||t.id_laboratorio===lab)&&(!totem||t.id_totem===totem));
  }
  function selectedRecords() {
    const from=$('#filter-from').value, to=$('#filter-to').value;
    const h0=$('#filter-hour-from').value||'00:00',h1=$('#filter-hour-to').value||'23:59';
    if (from && to && from>to) return [];
    if (h0>h1) return [];
    const allowed = new Set(selectedTotems().map(r=>String(r.id_totem)));
    return array('reservas').filter(r=>allowed.has(String(r.id_totem)) && (!from||r.fecha>=from)&&(!to||r.fecha<=to)&&String(r.hora_inicio)>=h0 && String(r.hora_inicio)<=h1);
  }
  function applyValidationMessage() {
    const from=$('#filter-from').value,to=$('#filter-to').value;
    const hf=$('#filter-hour-from').value,ht=$('#filter-hour-to').value;
    const problem=(from&&to&&from>to) ? 'La fecha inicial no puede ser posterior a la fecha final.' : (hf&&ht&&hf>ht) ? 'La hora inicial no puede ser posterior a la hora final.' : '';
    $('#filter-message').hidden=!problem;
    $('#filter-message').textContent=problem;
  }
  function populateFilters() {
    const labSelect=$('#filter-lab');
    const selectedLab=labSelect.value;
    labSelect.innerHTML='<option value="">Todos los laboratorios</option>'+array('laboratorio_informatica').map(l=>`<option value="${esc(l.id_laboratorio)}">${esc(l.numero)}</option>`).join('');
    if (array('laboratorio_informatica').some(l=>l.id_laboratorio===selectedLab)) labSelect.value=selectedLab;
    populateTotems();
  }
  function populateTotems() {
    const el=$('#filter-totem'),previous=el.value,lab=$('#filter-lab').value;
    el.innerHTML='<option value="">Todos los tótems</option>'+array('totems').filter(t=>!lab||t.id_laboratorio===lab).map(t=>`<option value="${esc(t.id_totem)}">${esc(t.codigo)}</option>`).join('');
    if (array('totems').some(t=>t.id_totem===previous&&(!lab||t.id_laboratorio===lab))) el.value=previous;
  }
  function initialDates(){
    const dates=array('reservas').map(r=>r.fecha).filter(Boolean).sort();
    defaultMin=dates[0]||'';
    defaultMax=dates.at(-1)||'';
    $('#filter-from').value=defaultMin;
    $('#filter-to').value=defaultMax;
  }
  function choosePeriod(days){
    const anchor=window.TOTEMS_DEMO_ACTIVE&&defaultMax ? defaultMax : dayString(new Date());
    $('#filter-to').value=anchor;
    $('#filter-from').value=days==='all'?(defaultMin||''):shiftedDay(anchor,1-Number(days));
    $$('.quick-filters button').forEach(b=>b.classList.toggle('selected',b.dataset.days===String(days)));
    render();
  }
  function clearQuickSelected(){ $$('.quick-filters button').forEach(b=>b.classList.remove('selected')); }

  function lineGraph(labels,values,options={}){
    if (!values.length || values.every(v=>!Number.isFinite(Number(v)))) return empty();
    const mobile=window.innerWidth<=700;
    const w=mobile?360:760,h=mobile?238:260,l=mobile?36:44,r=mobile?12:17,t=24,b=mobile?39:44,pw=w-l-r,ph=h-t-b;
    const mx=Math.max(1,...values.map(v=>Number(v)||0));
    const ymax=Math.max(2,Math.ceil(mx*1.15));
    const x=i=>l+(labels.length===1?pw/2:i*pw/(labels.length-1));
    const y=v=>t+ph-(Number(v)||0)*ph/ymax;
    const coords=values.map((v,i)=>`${x(i).toFixed(2)},${y(v).toFixed(2)}`);
    let grids='';for(let i=0;i<=4;i++){const q=t+ph-i*ph/4,val=Math.round(ymax*i/4);grids+=`<line x1="${l}" y1="${q}" x2="${w-r}" y2="${q}" stroke="#31584b" stroke-dasharray="3 5" stroke-opacity=".7"/><text x="${l-13}" y="${q+4}" fill="#91b4a2" text-anchor="end" font-size="11">${val}</text>`;}
    const labelsSvg=labels.map((label,i)=>{const step=Math.max(1,Math.ceil(labels.length/(mobile?5:8)));return i%step===0||i===labels.length-1?`<text x="${x(i)}" y="${h-14}" text-anchor="middle" font-size="10" fill="#8fae9f">${esc(label)}</text>`:'';}).join('');
    let lines='';
    const split=options.splitAt;
    if(typeof split==='number'&&split>=0){
      const real=coords.slice(0,split+1),pred=coords.slice(split);
      lines+=`<polyline points="${real.join(' ')}" fill="none" stroke="${COLORS.green}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
      lines+=`<polyline points="${pred.join(' ')}" fill="none" stroke="${COLORS.yellow}" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="7 7" stroke-linejoin="round"/>`;
    } else {
      lines+=`<polygon points="${l},${t+ph} ${coords.join(' ')} ${x(coords.length-1)},${t+ph}" fill="url(#line-fill)"/>`;
      lines+=`<polyline points="${coords.join(' ')}" fill="none" stroke="${COLORS.green}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    const dots=values.map((value,i)=>`<circle cx="${x(i)}" cy="${y(value)}" r="3.8" fill="${typeof split==='number'&&i>split?COLORS.yellow:COLORS.green}" stroke="#103a32" stroke-width="2"><title>${esc(labels[i])}: ${Number(value).toFixed(value%1?1:0)} reservas</title></circle>`).join('');
    return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Gráfico de líneas: ${esc(options.aria||'reservas por fecha')}"><defs><linearGradient id="line-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6ee488" stop-opacity=".22"/><stop offset="100%" stop-color="#6ee488" stop-opacity="0"/></linearGradient></defs>${grids}${lines}${dots}${labelsSvg}</svg>`;
  }
  function barGraph(labels,values,options={}){
    if (!values.length||values.every(v=>v===null))return empty();
    const mobile=window.innerWidth<=700;
    const w=mobile?360:660,h=mobile?230:234,l=mobile?35:41,r=mobile?10:15,t=20,b=mobile?38:43,pw=w-l-r,ph=h-t-b;
    const max=Math.max(2,...values)*1.18;
    let svg='';for(let i=0;i<=3;i++){const pos=t+ph-i*ph/3;svg+=`<line x1="${l}" y1="${pos}" x2="${w-r}" y2="${pos}" stroke="#31584b" stroke-dasharray="3 5"/><text x="${l-12}" y="${pos+3}" font-size="10" fill="#8ba89c" text-anchor="end">${Math.round(max*i/3)}</text>`;}
    const count=Math.max(1,labels.length),cell=pw/count,bw=Math.min(58,cell*.55);
    labels.forEach((label,i)=>{
      const bh=Math.max(values[i]>0?3:0,values[i]/max*ph),x=l+cell*i+(cell-bw)/2,y=t+ph-bh;
      svg+=`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="${options.color||COLORS.green}"><title>${esc(label)}: ${values[i]} reservas</title></rect>`;
      if(values[i]>0)svg+=`<text x="${x+bw/2}" y="${y-7}" fill="#d9f3db" font-size="10" text-anchor="middle">${values[i]}</text>`;
      svg+=`<text x="${l+cell*(i+.5)}" y="${h-15}" fill="#91b5a1" text-anchor="middle" font-size="${labels.length>7?10:11}">${esc(label)}</text>`;
    });
    return `<svg class="chart-svg" role="img" aria-label="${esc(options.aria||'Gráfico de barras')}" viewBox="0 0 ${w} ${h}">${svg}</svg>`;
  }
  function donutGraph(records){
    if(!records.length)return empty();
    const entries=Object.entries(records.reduce((agg,r)=>{const key=(r.estado||'sin_estado').toLowerCase();agg[key]=(agg[key]||0)+1;return agg;},{}));
    const sum=records.length,rad=64,circ=2*Math.PI*rad;let offset=0;
    const circles=entries.map(([name,n])=>{const length=circ*n/sum,old=offset;offset+=length;return `<circle cx="100" cy="100" r="${rad}" stroke="${STATUS_COLORS[name]||COLORS.teal}" fill="none" stroke-width="22" stroke-dasharray="${length} ${circ-length}" stroke-dashoffset="${-old}" transform="rotate(-90 100 100)"/>`;}).join('');
    const legend=entries.map(([name,n])=>`<div class="legend-item"><span class="bullet" style="background:${STATUS_COLORS[name]||COLORS.teal}"></span><span>${esc(name[0].toUpperCase()+name.slice(1))}</span><strong>${number(n)}</strong></div>`).join('');
    return `<svg viewBox="0 0 200 200" role="img" aria-label="Distribución de estados de ${sum} reservas"><circle cx="100" cy="100" r="${rad}" fill="none" stroke="#264e41" stroke-width="22"/>${circles}<text x="100" y="96" fill="#f3fff3" text-anchor="middle" font-size="31" font-weight="800">${number(sum)}</text><text x="100" y="116" fill="#9fbfae" text-anchor="middle" font-size="11">reservas</text></svg><div class="donut-legend">${legend}</div>`;
  }
  function daysFromRecords(records){
    if(!records.length)return {labels:[],values:[],dates:[]};
    const date0=$('#filter-from').value||records.map(r=>r.fecha).sort()[0];
    const date1=$('#filter-to').value||records.map(r=>r.fecha).sort().at(-1);
    const diff=Math.round((parseDay(date1)-parseDay(date0))/86400000);
    if(diff<0)return {labels:[],values:[],dates:[]};
    // Intervalos muy grandes: sin insertar miles de días vacíos.
    const dates=diff>59 ? [...new Set(records.map(r=>r.fecha))].sort() : Array.from({length:diff+1},(_,i)=>shiftedDay(date0,i));
    const counts=new Map();records.forEach(r=>counts.set(r.fecha,(counts.get(r.fecha)||0)+1));
    return {dates,labels:dates.map(d=>dateLabel(d,true)),values:dates.map(d=>counts.get(d)||0)};
  }
  function hourlyDistribution(records){
    return HOURS.map(hour=>records.filter(r=>hourOf(r)>=hour&&hourOf(r)<hour+2).length);
  }
  function labDistribution(records){
    const tm=byId('totems','id_totem');
    const labs=$('#filter-lab').value?array('laboratorio_informatica').filter(l=>l.id_laboratorio===$('#filter-lab').value):array('laboratorio_informatica');
    return {labels:labs.map(l=>l.numero),values:labs.map(l=>records.filter(r=>tm.get(String(r.id_totem))?.id_laboratorio===l.id_laboratorio).length)};
  }
  function renderOverview(records){
    const devices=selectedTotems(),good=devices.filter(t=>['operativo','disponible'].includes(String(t.estado_operativo).toLowerCase())).length;
    const ratings=array('satisfaccion').map(r=>Number(r.calificacion)).filter(r=>Number.isFinite(r)&&r>=1&&r<=5);
    const sat=ratings.length?(ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1).replace('.',',')+'/5':'—';
    setText('#kpi-reservas',number(records.length));setText('#kpi-tiempo',timeText(minuteSum(records)));
    setText('#kpi-totems',`${good}/${devices.length}`);setText('#kpi-satisfaccion',sat);
    const ds=daysFromRecords(records);setHTML('#chart-trend',records.length?lineGraph(ds.labels,ds.values):empty());
    setHTML('#chart-status',donutGraph(records));
    const hlabels=HOURS.map(h=>`${String(h).padStart(2,'0')}–${h+2}`);
    setHTML('#chart-hour-summary',records.length?barGraph(hlabels,hourlyDistribution(records),{aria:'Demanda por franjas horarias'}):empty());
    const labs=labDistribution(records);setHTML('#chart-lab-summary',records.length?barGraph(labs.labels,labs.values,{color:COLORS.teal,aria:'Reservas por laboratorio'}):empty());
  }
  function renderDemand(records){
    setText('#dem-total',number(records.length));
    const hours=hourlyDistribution(records),h=hours.indexOf(Math.max(...hours));
    const counts=Array(7).fill(0);records.forEach(r=>counts[parseDay(r.fecha).getUTCDay()]++);
    const maxday=Math.max(...counts),topDay=counts.indexOf(maxday);
    setText('#dem-top-hour',records.length?`${String(HOURS[h]).padStart(2,'0')}:00–${String(HOURS[h]+2).padStart(2,'0')}:00`:'—');
    setText('#dem-top-day',records.length?DAYNAMES[topDay]:'—');
    const hlabels=HOURS.map(h=>`${String(h).padStart(2,'0')}–${h+2}`);
    setHTML('#chart-hour-detail',records.length?barGraph(hlabels,hours,{aria:'Reservas por franja horaria'}):empty());
    const order=[1,2,3,4,5,6,0];
    setHTML('#chart-weekday',records.length?barGraph(['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],order.map(i=>counts[i]),{color:COLORS.teal,aria:'Distribución por día de la semana'}):empty());
    setHTML('#hour-breakdown',records.length?HOURS.map((h,i)=>{const relevant=records.filter(r=>hourOf(r)>=h&&hourOf(r)<h+2);return `<div class="hour-block"><small>${String(h).padStart(2,'0')}:00 a ${String(h+2).padStart(2,'0')}:00</small><strong>${number(relevant.length)}</strong><span>Reservas · ${esc(timeText(minuteSum(relevant)))}</span></div>`;}).join(''):empty());
  }
  function renderUtilization(records){
    const totems=selectedTotems();
    const unavailable=totems.filter(t=>!['operativo','disponible'].includes(String(t.estado_operativo).toLowerCase()));
    setText('#use-all',number(totems.length));setText('#use-unavailable',number(unavailable.length));setText('#use-minutes',timeText(minuteSum(records)));
    const usage=totems.map(t=>({t,minutes:minuteSum(records.filter(r=>r.id_totem===t.id_totem)),count:records.filter(r=>r.id_totem===t.id_totem&&r.estado!=='cancelada').length}));
    const maximum=Math.max(1,...usage.map(x=>x.minutes));
    setHTML('#chart-use-totems',usage.length?usage.sort((a,b)=>b.minutes-a.minutes).map(o=>`<div class="usage-item"><div class="usage-meta"><strong>${esc(o.t.codigo)}</strong><small>${number(o.minutes)} min · ${number(o.count)} reservas</small></div><div class="usage-track"><div class="usage-fill" style="width:${Math.min(100,o.minutes/maximum*100)}%"></div></div></div>`).join(''):empty());
    const labs=byId('laboratorio_informatica','id_laboratorio');
    setHTML('#chart-device-status',totems.length?totems.map(t=>{const st=String(t.estado_operativo||'sin dato').toLowerCase(),cls=['operativo','disponible'].includes(st)?'':st==='mantenimiento'?'warn':'error';return `<div class="device-item"><div class="device-id"><svg class="ic"><use href="#ic-plug"></use></svg><span><strong>${esc(t.codigo)}</strong><small>${esc(labs.get(String(t.id_laboratorio))?.numero||t.id_laboratorio)}</small></span></div><span class="state-pill ${cls}">${esc(t.estado_operativo)}</span></div>`;}).join(''):empty());
  }
  function renderSatisfaction(){
    const ratings=array('satisfaccion').map(o=>Number(o.calificacion)).filter(r=>Number.isInteger(r)&&r>=1&&r<=5);
    if(!ratings.length){setText('#sat-score','—');setText('#sat-total','0 evaluaciones');setText('#sat-stars','');setHTML('#chart-ratings',empty('No hay evaluaciones registradas.'));setHTML('#sat-comments',empty());return;}
    const avg=ratings.reduce((a,b)=>a+b,0)/ratings.length;
    setText('#sat-score',avg.toFixed(1).replace('.',',')+'/5');setText('#sat-total',`${ratings.length} evaluaciones en total`);
    setText('#sat-stars','★'.repeat(Math.round(avg))+'☆'.repeat(5-Math.round(avg)));
    const hist=[5,4,3,2,1].map(star=>({star,total:ratings.filter(r=>r===star).length}));
    setHTML('#chart-ratings',hist.map(r=>`<div class="rating-row"><span class="star-label">${r.star} ★</span><div class="rating-track"><div class="rating-fill" style="width:${100*r.total/ratings.length}%"></div></div><strong>${r.total}</strong></div>`).join(''));
    const comments=array('satisfaccion').filter(r=>String(r.comentario||'').trim()).slice(0,6);
    setHTML('#sat-comments',comments.length?comments.map(r=>`<article class="comment"><span class="comment-rating">${'★'.repeat(Math.min(5,Math.max(0,Number(r.calificacion)||0)))}</span><p>“${esc(r.comentario)}”</p></article>`).join(''):empty('No hay comentarios registrados.'));
  }
  function renderPrediction(records){
    if(!records.length){setHTML('#chart-prediction',empty('Sin historial no es posible mostrar una proyección.'));setHTML('#prediction-rows',empty());return;}
    const daily=daysFromRecords(records),v=daily.values;
    if(!v.length){setHTML('#chart-prediction',empty());setHTML('#prediction-rows',empty());return;}
    const history=Math.min(7,v.length),base=v.slice(-history);
    let moving=v.slice(-3),future=[];
    for(let i=0;i<5;i++){const pred=Math.max(0,Number((moving.reduce((a,b)=>a+b,0)/moving.length).toFixed(1)));future.push(pred);moving=[...moving.slice(1),pred];}
    const anchor=daily.dates.at(-1),nextDays=Array.from({length:5},(_,i)=>shiftedDay(anchor,i+1));
    const labelDates=[...daily.dates.slice(-history),...nextDays];
    const all=[...base,...future];
    setHTML('#chart-prediction',lineGraph(labelDates.map(d=>dateLabel(d,true)),all,{splitAt:base.length-1,aria:'Histórico de reservas y proyección por media móvil'}));
    setHTML('#prediction-rows',nextDays.map((date,i)=>`<div class="pred-item"><small>${esc(weekday(date))} · ${esc(dateLabel(date,true))}</small><strong>≈ ${number(Math.round(future[i]))}</strong><span>reservas estimadas</span></div>`).join(''));
  }
  function resolveDataRows(type){
    const lab=$('#filter-lab').value,totem=$('#filter-totem').value;
    const allowed=new Set(selectedTotems().map(t=>String(t.id_totem)));
    if(type==='reservas')return selectedRecords();
    if(type==='totems')return selectedTotems();
    if(type==='laboratorio_informatica')return array(type).filter(l=>!lab||l.id_laboratorio===lab);
    if(type==='eventos_hardware'){
      const from=$('#filter-from').value,to=$('#filter-to').value,h0=$('#filter-hour-from').value,h1=$('#filter-hour-to').value;
      return array(type).filter(e=>allowed.has(String(e.id_totem))&&(!e.fecha||((!from||e.fecha>=from)&&(!to||e.fecha<=to)))&&(!e.hora||((!h0||e.hora>=h0)&&(!h1||e.hora<=h1))));
    }
    // satisfaccion no tiene relación con reserva/fecha y usuarios son globales.
    return array(type);
  }
  function searchedRows(type){
    const entries=resolveDataRows(type),q=searchQuery.trim().toLocaleLowerCase('es');
    return q?entries.filter(r=>Object.values(r).some(v=>String(v??'').toLocaleLowerCase('es').includes(q))):entries;
  }
  function renderData(){
    const rows=searchedRows(tableType),cols=statics[tableType],pageSize=9,pages=Math.max(1,Math.ceil(rows.length/pageSize));
    tablePage=Math.max(1,Math.min(pages,tablePage));
    const first=(tablePage-1)*pageSize,display=rows.slice(first,first+pageSize);
    setText('#table-title',LABELS[tableType]);
    const note=['satisfaccion','usuario'].includes(tableType)?' · datos globales, sin filtro temporal':(tableType==='totems'?' · estado actual':'');
    setText('#table-subtitle',`${number(rows.length)} registros${note}`);
    const head=cols.map(c=>`<th scope="col">${esc(c)}</th>`).join('');
    $('#data-table thead').innerHTML=`<tr>${head}</tr>`;
    $('#data-table tbody').innerHTML=display.length?display.map(row=>`<tr>${cols.map(c=>`<td title="${esc(text(row[c]))}">${esc(text(row[c]))}</td>`).join('')}</tr>`).join(''):`<tr><td class="no-content-row" colspan="${cols.length}">No hay registros para mostrar.</td></tr>`;
    setText('#table-counter',rows.length?`Mostrando ${first+1}–${Math.min(rows.length,first+pageSize)} de ${rows.length}`:'0 registros');
    setText('#current-page',`Página ${tablePage} de ${pages}`);
    $('#prev-page').disabled=tablePage<=1;$('#next-page').disabled=tablePage>=pages;
  }
  function render(){
    applyValidationMessage();
    const records=selectedRecords();
    setText('#filter-count',`${number(records.length)} reservas seleccionadas`);
    renderOverview(records);renderDemand(records);renderUtilization(records);renderSatisfaction();renderPrediction(records);renderData();
  }
  function showPage(next){
    page=next;
    const title=titles[next]||titles.resumen;
    setText('#page-title',title[0]);setText('#page-description',title[1]);setText('#breadcrumb-page',title[0]);
    $$('.page-section').forEach(section=>{section.hidden=section.dataset.section!==next;});
    $$('.nav-link').forEach(btn=>{const active=btn.dataset.page===next;btn.classList.toggle('is-active',active);if(active)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');});
    if(window.location.hash!==`#${next}`)history.replaceState(null,'',`#${next}`);
    document.body.classList.remove('sidebar-open');$('#mobile-shade').hidden=true;
  }
  function exportCsv(){
    const type=page==='datos'?tableType:page==='satisfaccion'?'satisfaccion':page==='utilizacion'?'totems':'reservas';
    const rows=page==='datos'?searchedRows(type):resolveDataRows(type);
    if(!rows.length){window.alert('No hay registros para exportar con la selección actual.');return;}
    const columns=statics[type];
    const value=(v)=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return `"${s.replaceAll('"','""')}"`;};
    const content='\uFEFF'+[columns.map(value).join(';'),...rows.map(row=>columns.map(k=>value(row[k])).join(';'))].join('\r\n');
    const blob=new Blob([content],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`technomorrow_${type}_${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);
  }
  function initEvents(){
    $$('.nav-link').forEach(btn=>btn.addEventListener('click',()=>showPage(btn.dataset.page)));
    $('#open-sidebar').addEventListener('click',()=>{document.body.classList.add('sidebar-open');$('#mobile-shade').hidden=false;});
    const close=()=>{document.body.classList.remove('sidebar-open');$('#mobile-shade').hidden=true;};
    $('#close-sidebar').addEventListener('click',close);$('#mobile-shade').addEventListener('click',close);
    $('#dismiss-banner').addEventListener('click',()=>$('#demo-banner').hidden=true);
    ['#filter-from','#filter-to','#filter-hour-from','#filter-hour-to','#filter-totem'].forEach(id=>$(id).addEventListener('change',()=>{clearQuickSelected();tablePage=1;render();}));
    $('#filter-lab').addEventListener('change',()=>{populateTotems();tablePage=1;render();});
    $$('.quick-filters button').forEach(btn=>btn.addEventListener('click',()=>{tablePage=1;choosePeriod(btn.dataset.days);}));
    $('#reset-filters').addEventListener('click',()=>{
      $('#filter-lab').value='';populateTotems();$('#filter-totem').value='';
      $('#filter-hour-from').value='08:00';$('#filter-hour-to').value='20:00';tablePage=1;searchQuery='';$('#table-search').value='';choosePeriod('all');
    });
    $$('.data-tab').forEach(btn=>btn.addEventListener('click',()=>{
      tableType=btn.dataset.table;tablePage=1;searchQuery='';$('#table-search').value='';
      $$('.data-tab').forEach(b=>{const active=b===btn;b.classList.toggle('is-active',active);b.setAttribute('aria-selected',String(active));});
      renderData();
    }));
    $('#table-search').addEventListener('input',(e)=>{searchQuery=e.target.value;tablePage=1;renderData();});
    $('#prev-page').addEventListener('click',()=>{tablePage--;renderData();});
    $('#next-page').addEventListener('click',()=>{tablePage++;renderData();});
    $('#download-current').addEventListener('click',exportCsv);$('#download-table').addEventListener('click',exportCsv);
    window.addEventListener('hashchange',()=>{const hash=location.hash.slice(1);if(titles[hash])showPage(hash);});
    let wasMobile=window.innerWidth<=700;
    window.addEventListener('resize',()=>{const current=window.innerWidth<=700;if(current!==wasMobile){wasMobile=current;render();}});
  }
  async function initialize(){
    try{source=await window.obtenerDatosPanel()||window.TOTEMS_EMPTY_DATA();}
    catch(e){console.error('No fue posible obtener datos del panel:',e);source=window.TOTEMS_EMPTY_DATA();}
    const isDemo=Boolean(window.TOTEMS_DEMO_ACTIVE);
    $('#env-pill').hidden=!isDemo;
    $('#demo-banner').hidden=!isDemo;
    setText('#sidebar-source',isDemo?'Origen: datos de ejemplo':'Origen: datos conectados / vacíos');
    setText('#footer-source',isDemo?'Visualizaciones de demostración':'Visualizaciones sin datos simulados');
    initialDates();populateFilters();initEvents();render();
    const initial=location.hash.slice(1);showPage(titles[initial]?initial:'resumen');
  }
  document.addEventListener('DOMContentLoaded',initialize);
})();
