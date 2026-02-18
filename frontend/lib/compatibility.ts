import type { Build, CompatibilityResult, User, PlaystyleLabels } from './types';

const PLAYSTYLE_KEYS: (keyof PlaystyleLabels)[] = [
  'shootVsDrive',
  'soloVsSquad',
  'defenseSkill',
  'reactionTiming',
  'offensiveStyle',
  'physicalPlay',
  'pacePreference',
  'consistencyVsHighRisk',
];

const DIMENSION_LABELS: Record<keyof PlaystyleLabels, { low: string; high: string }> = {
  shootVsDrive: { low: 'Drive style', high: 'Shooting style' },
  soloVsSquad: { low: 'Squad play', high: 'Solo play' },
  defenseSkill: { low: 'Offense focus', high: 'Defense focus' },
  reactionTiming: { low: 'Casual pace', high: 'Elite timing' },
  offensiveStyle: { low: 'Set plays', high: 'Freestyle offense' },
  physicalPlay: { low: 'Finesse', high: 'Physical' },
  pacePreference: { low: 'Slow & methodical', high: 'Fast & aggressive' },
  consistencyVsHighRisk: { low: 'Consistent', high: 'High-risk/reward' },
};

export function calcCompatibility(user: User, build: Build): CompatibilityResult {
  const userVec = user.playstyle_vector;
  const buildVec = build.build_vector;

  // Default score if no vectors
  if (!userVec || !buildVec || userVec.length !== 8 || buildVec.length !== 8) {
    return { score: 70, label: 'Good Match', strengths: [], weaknesses: [], predictedWinBoost: 5 };
  }

  // Core match calculation: average of (1 - |u[i] - b[i]| / 9) * 100
  let total = 0;
  const alignedDimensions: string[] = [];
  const misalignedDimensions: string[] = [];

  for (let i = 0; i < 8; i++) {
    const diff = Math.abs(userVec[i] - buildVec[i]);
    const dimScore = (1 - diff / 9) * 100;
    total += dimScore;

    const key = PLAYSTYLE_KEYS[i];
    const label = DIMENSION_LABELS[key];

    if (dimScore >= 75) {
      const val = userVec[i];
      alignedDimensions.push(val >= 5 ? `Fits your ${label.high}` : `Fits your ${label.low}`);
    } else if (dimScore < 45) {
      const val = userVec[i];
      misalignedDimensions.push(val >= 5 ? `Conflicts with your ${label.high}` : `Conflicts with your ${label.low}`);
    }
  }

  const score = Math.round(total / 8);

  let label: string;
  if (score >= 90) label = 'Perfect Match';
  else if (score >= 75) label = 'Great Match';
  else if (score >= 60) label = 'Good Match';
  else if (score >= 45) label = 'Moderate Match';
  else label = 'Poor Match';

  // Predicted win boost: based on score + performance
  const baseBoost = ((score - 50) / 50) * 25; // -25% to +25%
  const perfBoost = ((build.performance?.shooting || 50) - 50) * 0.3;
  const predictedWinBoost = Math.round(Math.max(-15, Math.min(30, baseBoost + perfBoost)));

  return {
    score,
    label,
    strengths: alignedDimensions.slice(0, 3),
    weaknesses: misalignedDimensions.slice(0, 2),
    predictedWinBoost,
  };
}

export function getMatchColor(score: number): string {
  if (score >= 90) return '#10B981';
  if (score >= 75) return '#3B82F6';
  if (score >= 60) return '#F59E0B';
  if (score >= 45) return '#F97316';
  return '#EF4444';
}

export const PLAYSTYLE_DIMENSIONS = PLAYSTYLE_KEYS.map((key, i) => ({
  key,
  index: i,
  ...DIMENSION_LABELS[key],
  question: getQuestion(key),
}));

function getQuestion(key: keyof PlaystyleLabels): string {
  const map: Record<keyof PlaystyleLabels, string> = {
    shootVsDrive: 'Do you prefer shooting from range or driving to the basket?',
    soloVsSquad: 'Do you play more solo (1v1, solo modes) or with a squad?',
    defenseSkill: 'How much do you focus on playing defense?',
    reactionTiming: 'How would you rate your reaction time and timing precision?',
    offensiveStyle: 'Do you run set plays or prefer freestyling on offense?',
    physicalPlay: 'Do you prefer finesse/skill moves or physical/power play?',
    pacePreference: 'Do you prefer a slow, methodical pace or fast, aggressive play?',
    consistencyVsHighRisk: 'Do you go for consistent/safe plays or high-risk/high-reward moves?',
  };
  return map[key];
}
