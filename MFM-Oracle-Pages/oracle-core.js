// This is a joke collection, not clinical advice or a decision support tool.
export const answers = Object.freeze([
  'À discuter au colloque', 'Contrôle dans 2 semaines', 'Demander une IRM',
  'Variante de la norme', 'Appeler le chef', 'Revoir les guidelines',
  'Aucun consensus', 'Prendre un café', 'Refaire la mesure', 'Un deuxième avis',
  'Encore un case report', 'Ça dépend du percentile',
  'Attendre que le fœtus se retourne', 'PubMed est ton ami', 'Astraia a encore planté',
  'Le reviewer 2 refuse', 'La littérature est pauvre', 'Demander au généticien',
  'Le colloque durera 3 heures', 'Un petit contrôle de 90 minutes',
  'Le Doppler était mieux hier', 'Tout est normal !', 'Une réunion pour en discuter',
  'Niveau de preuve Z', 'Le fœtus a décidé autrement', 'Une nouvelle guideline demain',
  'Demander une troisième mesure', 'Le chef est en vacances', 'Un café puis on verra',
  'Félicitations, spécialiste !',
]);

export const rareAnswers = Object.freeze([
  'Le colloque finit à l’heure !',
  'Reviewer 2 : accepté sans révision.',
  'Le fœtus coopère du premier coup !',
]);

export function pickAnswer(previous = '', random = Math.random) {
  const rare = random() < 0.05;
  const candidates = (rare ? rareAnswers : answers).filter(answer => answer !== previous);
  const index = Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)));
  return { text: candidates[index], rare };
}

function completeVector(value) {
  return value && ['x', 'y', 'z'].every(axis => typeof value[axis] === 'number' && Number.isFinite(value[axis]));
}

// A deliberate back-and-forth movement produces at least two distinct peaks.
// A single bump, sustained acceleration, or rotating gravity must not reveal.
export function createShakeDetector({ threshold = 10, releaseThreshold = 4, minPeakGap = 90,
  maxPeakGap = 900, cooldown = 1800 } = {}) {
  let firstPeak = null;
  let aboveThreshold = false;
  let lastShake = -Infinity;

  return {
    reset() {
      firstPeak = null;
      aboveThreshold = false;
    },
    push(event, now) {
      if (!Number.isFinite(now)) return false;
      let amount;
      if (completeVector(event.acceleration)) {
        const { x, y, z } = event.acceleration;
        amount = Math.hypot(x, y, z);
      } else if (completeVector(event.accelerationIncludingGravity)) {
        const { x, y, z } = event.accelerationIncludingGravity;
        amount = Math.abs(Math.hypot(x, y, z) - 9.81);
      } else {
        return false;
      }

      if (firstPeak !== null && now - firstPeak > maxPeakGap) firstPeak = null;
      if (amount < releaseThreshold) {
        aboveThreshold = false;
        return false;
      }
      if (amount < threshold || aboveThreshold) return false;
      aboveThreshold = true;
      if (now - lastShake < cooldown) {
        firstPeak = null;
        return false;
      }
      if (firstPeak === null || now - firstPeak < minPeakGap) {
        firstPeak = now;
        return false;
      }
      firstPeak = null;
      lastShake = now;
      return true;
    },
  };
}
