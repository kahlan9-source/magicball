import { OracleBall } from './ball.js';
import { pickAnswer, createShakeDetector } from './oracle-core.js';

const $ = id => document.getElementById(id);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const ball = new OracleBall($('ballCanvas'), { reducedMotion: reducedMotion.matches });
const shake = createShakeDetector();
let busy = false;
let previous = '';
let motionEnabled = false;
let permissionPending = false;
let sensorTimer;
let sensorSeen = false;
let offlineReady = false;
let installPrompt;

const onMotionPreference = event => ball.setReducedMotion(event.matches);
if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', onMotionPreference);
else reducedMotion.addListener(onMotionPreference);

async function consult() {
  if (busy || document.hidden) return;
  busy = true;
  shake.reset();
  $('consult').disabled = true;
  $('ball').disabled = true;
  $('ball').setAttribute('aria-busy', 'true');
  $('consultLabel').textContent = 'L’oracle délibère…';
  $('consultHint').textContent = 'Consultation du niveau de preuve Z…';
  $('answer').textContent = '';
  $('answerKind').textContent = '';
  document.body.classList.add('is-consulting');
  const result = pickAnswer(previous);
  try {
    await ball.reveal(result.text);
    previous = result.text;
    $('answer').textContent = result.text;
    $('answerKind').textContent = result.rare ? 'MIRACLE STATISTIQUE' : 'LE VERDICT';
    $('ball').setAttribute('aria-label', `L’oracle a parlé : ${result.text}. Consulter à nouveau.`);
    document.body.classList.add('has-answer');
    document.body.classList.toggle('is-rare', result.rare);
    $('consultHint').textContent = result.rare ? 'Un événement à publier dans la littérature.' : 'L’oracle a parlé. Le café reste une option.';
    if (!reducedMotion.matches && typeof navigator.vibrate === 'function') navigator.vibrate(30);
  } catch (error) {
    // Text remains available if a graphics context is interrupted.
    previous = result.text;
    $('answer').textContent = result.text;
    $('answerKind').textContent = 'LE VERDICT';
    $('consultHint').textContent = result.text;
    console.warn('Le rendu de l’oracle a été interrompu.', error);
  } finally {
    document.body.classList.remove('is-consulting');
    $('consultLabel').textContent = 'Consulter l’oracle';
    $('consult').disabled = false;
    $('ball').disabled = false;
    $('ball').setAttribute('aria-busy', 'false');
    busy = false;
    shake.reset();
  }
}

$('consult').addEventListener('click', consult);
$('ball').addEventListener('click', consult);

function hasSensorData(event) {
  return [event.acceleration, event.accelerationIncludingGravity].some(value =>
    value && ['x', 'y', 'z'].every(axis => typeof value[axis] === 'number' && Number.isFinite(value[axis])));
}

function onMotion(event) {
  if (!motionEnabled || document.hidden) return;
  if (!sensorSeen && hasSensorData(event)) {
    sensorSeen = true;
    clearTimeout(sensorTimer);
    $('motionStatus').textContent = 'Secoue doucement ton iPhone deux fois pour consulter l’oracle.';
  }
  if (busy) {
    shake.reset();
    return;
  }
  if (shake.push(event, performance.now())) consult();
}

function stopMotion(message = 'Mode secousse désactivé. Le bouton reste disponible.') {
  motionEnabled = false;
  sensorSeen = false;
  clearTimeout(sensorTimer);
  window.removeEventListener('devicemotion', onMotion);
  shake.reset();
  $('motion').setAttribute('aria-pressed', 'false');
  ($('motion').querySelector('span') || $('motion')).textContent = 'Activer le mode secousse';
  $('motionStatus').textContent = message;
}

$('motion').addEventListener('click', async () => {
  if (motionEnabled) {
    stopMotion();
    return;
  }
  if (permissionPending) return;
  if (!window.isSecureContext || !window.DeviceMotionEvent) {
    $('motionStatus').textContent = 'Secousse indisponible ici. Ouvre l’app en HTTPS sur ton iPhone, ou utilise le bouton.';
    return;
  }
  permissionPending = true;
  $('motion').disabled = true;
  try {
    // Keep this call in the click gesture, before any unrelated async work.
    const permission = typeof window.DeviceMotionEvent.requestPermission === 'function'
      ? await window.DeviceMotionEvent.requestPermission() : 'granted';
    if (permission !== 'granted') {
      stopMotion('Accès aux mouvements refusé. Tu peux toujours consulter avec le bouton.');
      return;
    }
    motionEnabled = true;
    sensorSeen = false;
    shake.reset();
    window.addEventListener('devicemotion', onMotion, { passive: true });
    $('motion').setAttribute('aria-pressed', 'true');
    ($('motion').querySelector('span') || $('motion')).textContent = 'Désactiver le mode secousse';
    $('motionStatus').textContent = 'Mode secousse activé. Secoue doucement ton iPhone deux fois.';
    sensorTimer = window.setTimeout(() => {
      if (motionEnabled) $('motionStatus').textContent = 'Aucun mouvement reçu. Vérifie les autorisations de Safari, ou utilise le bouton.';
    }, 7000);
  } catch {
    stopMotion('Mode secousse indisponible. Le bouton fonctionne sans autorisation.');
  } finally {
    permissionPending = false;
    $('motion').disabled = false;
  }
});

document.addEventListener('visibilitychange', () => shake.reset());

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
});

$('install').addEventListener('click', async () => {
  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = null;
    await prompt.prompt();
    await prompt.userChoice;
  } else {
    $('installDialog').showModal();
  }
});
$('closeInstall').addEventListener('click', () => $('installDialog').close());
$('installDialog').addEventListener('click', event => {
  if (event.target !== $('installDialog')) return;
  const bounds = $('installDialog').getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right ||
    event.clientY < bounds.top || event.clientY > bounds.bottom) $('installDialog').close();
});

function renderOfflineStatus() {
  $('offlineStatus').textContent = offlineReady
    ? navigator.onLine ? 'Prêt hors ligne' : 'Hors ligne · l’oracle reste disponible'
    : navigator.onLine ? 'Préparation du mode hors ligne…' : 'Hors ligne · ouvre une fois l’app en ligne';
  $('offlineStatus').dataset.ready = String(offlineReady);
}

window.addEventListener('online', renderOfflineStatus);
window.addEventListener('offline', renderOfflineStatus);
renderOfflineStatus();

async function verifyOfflineCache(registration) {
  if (!registration.active) return;
  const channel = new MessageChannel();
  const ready = await new Promise(resolve => {
    const timeout = setTimeout(() => { channel.port1.close(); resolve(false); }, 4000);
    channel.port1.onmessage = event => {
      clearTimeout(timeout);
      channel.port1.close();
      resolve(event.data?.type === 'OFFLINE_STATUS' && event.data.ready === true);
    };
    registration.active.postMessage({ type: 'CHECK_OFFLINE_READY' }, [channel.port2]);
  });
  offlineReady = ready;
  renderOfflineStatus();
  if (!ready && navigator.onLine) $('offlineStatus').textContent = 'Mode hors ligne à préparer · recharge l’app en ligne';
}

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
    .then(async () => {
      const registration = await navigator.serviceWorker.ready;
      await verifyOfflineCache(registration);
      navigator.serviceWorker.addEventListener('controllerchange', () => verifyOfflineCache(registration));
    })
    .catch(() => { $('offlineStatus').textContent = 'Mode hors ligne indisponible dans ce navigateur'; });
} else {
  $('offlineStatus').textContent = 'Mode hors ligne disponible via HTTPS';
}
