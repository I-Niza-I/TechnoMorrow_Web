// Conexión a Firebase Authentication (SDK modular, sin npm ni empaquetador).
// Valores tomados de la captura de Firebase que compartiste anteriormente. Verifícalos en Console > Configuración > Tus aplicaciones.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBly0fURq5AASPhsSgUnnT7u_NOfKusc0A',
  authDomain: 'technomorrow-31b10.firebaseapp.com',
  databaseURL: 'https://technomorrow-31b10-default-rtdb.firebaseio.com/',
  projectId: 'technomorrow-31b10',
  storageBucket: 'technomorrow-31b10.firebasestorage.app',
  messagingSenderId: '628192242459',
  appId: '1:628192242459:web:559249a27253daf072c1be'
};

export const firebaseConfigurado =
  !Object.values(firebaseConfig).some(valor => String(valor).startsWith('PEGAR_'));

export const app = firebaseConfigurado ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
