// Humour uniquement. Aucune utilisation clinique.
export const answers = Object.freeze([
  "Probablement une variante de la norme.",
  "Dans le doute, demande une IRM.",
  "Félicitations, tu as découvert un nouveau syndrome.",
  "Ça dépend de la courbe que tu choisis.",
  "Normal selon ISUOG, pathologique selon ton chef.",
  "Le fœtus refuse toute collaboration.",
  "Encore une amniocentèse et on rentre.",
  "La littérature ? Trois cas au Japon.",
  "Même le généticien ne sait pas.",
  "C'est sûrement un artefact. Enfin, espérons.",
  "Demande un avis jusqu'à obtenir celui que tu veux.",
  "Niveau de preuve : intuition du chef.",
  "On verra mieux après la naissance.",
  "Une petite échographie de deux heures.",
  "Astraia a encore choisi de planter.",
  "Le reviewer 2 a encore frappé.",
  "Évidemment, la guideline ne couvre pas ce cas.",
  "C'était normal jusqu'à ce que tu zoomes.",
  "Le fœtus n'a pas lu les guidelines.",
  "Plus tu cherches, plus tu trouves.",
  "Un VUS. Bonne chance pour le counseling.",
  "Ce n'est pas rare, c'est publiable.",
  "Colloque à 17 h. Annule ton dîner.",
  "Remesure, le percentile va peut-être remonter.",
  "C'est classique. Personne ne l'a jamais vu.",
  "Ton café est froid depuis trois heures.",
  "Demande un exome, pour simplifier les choses.",
  "La réponse est dans un article payant.",
  "Tu aurais dû faire dermatologie.",
  "Tu es spécialiste maintenant. Débrouille-toi !",
  "Même l'IA demande un deuxième avis.",
  "Diagnostic différentiel : tout le chapitre 12.",
  "Une échographie rapide ? Il est 16 h 55.",
  "Le cœur est à gauche. Bon début.",
  "Le consensus, c'est l'absence de consensus.",
  "Tu as obtenu ton titre, pas les réponses.",
  "Un café avant d'annoncer le pronostic.",
  "Le chef est en vacances. Bonne chance.",
  "Le Doppler était mieux hier.",
  "Encore une réunion pour décider d'une réunion."
]);

export const rareAnswers = Object.freeze([
  "Tous les experts sont d'accord. Appelez le NEJM !",
  "Reviewer 2 : accepté sans révision !",
  "Le fœtus coopère ET Astraia fonctionne !",
  "Il est 17 h. Tu peux rentrer chez toi !",
  "Le colloque finit à l'heure. Miracle !"
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
export function createShakeDetector({ threshold = 6, releaseThreshold = 4.5, minPeakGap = 60,
  maxPeakGap = 1200, cooldown = 1600 } = {}) {
  let firstPeak = null;
  let aboveThreshold = false;
  let peakVector = null;
  let lastShake = -Infinity;

  return {
    reset() {
      firstPeak = null;
      aboveThreshold = false;
      peakVector = null;
    },
    push(event, now) {
      if (!Number.isFinite(now)) return false;
      let amount;
      let vector = null;
      if (completeVector(event.acceleration)) {
        const { x, y, z } = event.acceleration;
        amount = Math.hypot(x, y, z);
        vector = event.acceleration;
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
      // A direction reversal is a second peak even if a lower-rate sensor
      // misses the zero crossing. Only use gravity-free vectors for this.
      const reversed = vector && peakVector &&
        (vector.x * peakVector.x + vector.y * peakVector.y + vector.z * peakVector.z) <
        -0.25 * amount * Math.hypot(peakVector.x, peakVector.y, peakVector.z);
      if (amount < threshold || (aboveThreshold && !reversed)) return false;
      peakVector = vector;
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
