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
  $('ball').setAttribute('aria-busy', 'true');
  $('consultHint').textContent = '…';
  $('answer').textContent = '';
  $('answerKind').textContent = '';
  document.body.classList.remove('is-rare');
  document.body.classList.add('is-consulting');
  const result = pickAnswer(previous);
  try {
    await ball.reveal(result.text);
    previous = result.text;
    $('answer').textContent = result.text;
    $('answerKind').textContent = result.rare ? 'RÉPONSE LÉGENDAIRE' : 'LE VERDICT';
    $('ball').setAttribute('aria-label', `Verdict : ${result.text}`);
    document.body.classList.add('has-answer');
    document.body.classList.toggle('is-rare', result.rare);
    $('consultHint').textContent = 'Secoue pour un autre verdict.';
    if (!reducedMotion.matches && typeof navigator.vibrate === 'function') navigator.vibrate(30);
  } catch (error) {
    // Text remains available if a graphics context is interrupted.
    previous = result.text;
    $('answer').textContent = result.text;
    $('answerKind').textContent = result.rare ? 'RÉPONSE LÉGENDAIRE' : 'LE VERDICT';
    document.body.classList.toggle('is-rare', result.rare);
    $('consultHint').textContent = 'Secoue pour un autre verdict.';
    console.warn('Le rendu de l’oracle a été interrompu.', error);
  } finally {
    document.body.classList.remove('is-consulting');
    $('ball').setAttribute('aria-busy', 'false');
    busy = false;
    shake.reset();
  }
}



function hasSensorData(event) {
  return [event.acceleration, event.accelerationIncludingGravity].some(value =>
    value && ['x', 'y', 'z'].every(axis => typeof value[axis] === 'number' && Number.isFinite(value[axis])));
}

function onMotion(event) {
  if (!motionEnabled || document.hidden) return;
  if (!sensorSeen && hasSensorData(event)) {
    sensorSeen = true;
    clearTimeout(sensorTimer);
    $('motionStatus').textContent = '';
  }
  if (busy) {
    shake.reset();
    return;
  }
  if (shake.push(event, performance.now())) consult();
}

function stopMotion(message = 'Autorise les mouvements pour jouer en secouant.') {
  motionEnabled = false;
  sensorSeen = false;
  clearTimeout(sensorTimer);
  window.removeEventListener('devicemotion', onMotion);
  shake.reset();
  $('motion').hidden = false;
  $('motion').setAttribute('aria-pressed', 'false');
  ($('motion').querySelector('span') || $('motion')).textContent = 'Autoriser les mouvements';
  $('motionStatus').textContent = message;
}

async function enableMotion() {
  if (motionEnabled) return;
  if (permissionPending) return;
  if (!window.isSecureContext || !window.DeviceMotionEvent) {
    $('motionStatus').textContent = 'Cette version se joue uniquement en secouant. Ouvre l’app dans Safari sur un iPhone compatible.';
    return;
  }
  permissionPending = true;
  $('motion').disabled = true;
  try {
    // Keep this call in the click gesture, before any unrelated async work.
    const permission = typeof window.DeviceMotionEvent.requestPermission === 'function'
      ? await window.DeviceMotionEvent.requestPermission() : 'granted';
    if (permission !== 'granted') {
      stopMotion('Accès aux mouvements refusé. Autorise-les dans Safari, puis réessaie pour jouer en secouant.');
      return;
    }
    motionEnabled = true;
    sensorSeen = false;
    shake.reset();
    window.addEventListener('devicemotion', onMotion, { passive: true });
    $('motion').hidden = true;
    $('motion').setAttribute('aria-pressed', 'true');
    ($('motion').querySelector('span') || $('motion')).textContent = 'Mouvements autorisés';
    $('motionStatus').textContent = '';
    sensorTimer = window.setTimeout(() => {
      if (motionEnabled) $('motionStatus').textContent = 'Aucun mouvement reçu. Vérifie les autorisations de Safari et utilise un téléphone avec capteur de mouvement.';
    }, 7000);
  } catch {
    stopMotion('Les mouvements sont indisponibles. Vérifie les autorisations de Safari, puis réessaie.');
  } finally {
    permissionPending = false;
    $('motion').disabled = false;
  }
}
$('motion').addEventListener('click', enableMotion);
if (window.isSecureContext && window.DeviceMotionEvent &&
    typeof window.DeviceMotionEvent.requestPermission !== 'function') enableMotion();
if (!window.isSecureContext || !window.DeviceMotionEvent) {
  $('motion').hidden = true;
  $('motionStatus').textContent = 'Ouvre cette app dans Safari sur ton iPhone pour jouer en secouant.';
}

document.addEventListener('visibilitychange', () => shake.reset());

// iOS home-screen launches expose navigator.standalone; other PWAs
// expose display-mode. Recheck on resume and when the display mode changes.
const standaloneMode = window.matchMedia('(display-mode: standalone)');
let installedThisSession = false;
function updateInstallVisibility() {
  const installed = navigator.standalone === true || standaloneMode.matches || installedThisSession;
  $('install').hidden = installed;
  document.querySelector('.masthead').hidden = installed;
  if (installed) {
    installPrompt = null;
    if ($('installDialog').open) $('installDialog').close();
  }
}
updateInstallVisibility();
if (standaloneMode.addEventListener) standaloneMode.addEventListener('change', updateInstallVisibility);
else standaloneMode.addListener(updateInstallVisibility);
window.addEventListener('pageshow', updateInstallVisibility);
document.addEventListener('visibilitychange', updateInstallVisibility);
window.addEventListener('appinstalled', () => {
  installedThisSession = true;
  updateInstallVisibility();
});

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  if (!$('install').hidden) installPrompt = event;
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
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && navigator.onLine) registration.update().catch(() => {});
      });
    })
    .catch(() => { $('offlineStatus').textContent = 'Mode hors ligne indisponible dans ce navigateur'; });
} else {
  $('offlineStatus').textContent = 'Mode hors ligne disponible via HTTPS';
}
