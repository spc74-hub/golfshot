import type { Player, HoleData, StablefordResult } from "@/types";

/**
 * Calculate playing handicap from handicap index and slope
 */
export function calculatePlayingHandicap(
  handicapIndex: number,
  slope: number,
  percentage: number = 100
): number {
  const playingHcp = (handicapIndex * slope) / 113;
  return Math.round((playingHcp * percentage) / 100);
}

/**
 * Calculate strokes received on a specific hole based on playing handicap
 */
export function calculateStrokesReceived(
  playingHandicap: number,
  holeHandicap: number
): number {
  if (playingHandicap <= 0) return 0;

  const baseStrokes = Math.floor(playingHandicap / 18);
  const remainder = playingHandicap % 18;

  return holeHandicap <= remainder ? baseStrokes + 1 : baseStrokes;
}

/**
 * Calculate net score for a hole
 */
export function calculateNetScore(
  grossStrokes: number,
  playingHandicap: number,
  holeHandicap: number
): number {
  const strokesReceived = calculateStrokesReceived(playingHandicap, holeHandicap);
  return grossStrokes - strokesReceived;
}

/**
 * Calculate Stableford points for a hole
 */
export function calculateStablefordPoints(
  grossStrokes: number,
  par: number,
  playingHandicap: number,
  holeHandicap: number
): number {
  const netScore = calculateNetScore(grossStrokes, playingHandicap, holeHandicap);
  const diff = netScore - par;

  if (diff <= -3) return 5; // Albatross or better
  if (diff === -2) return 4; // Eagle
  if (diff === -1) return 3; // Birdie
  if (diff === 0) return 2; // Par
  if (diff === 1) return 1; // Bogey
  return 0; // Double bogey or worse
}

/**
 * Get result name based on score vs par (relative to par, not handicap)
 */
export function getScoreResultVsPar(
  grossStrokes: number,
  par: number
): StablefordResult {
  const diff = grossStrokes - par;

  if (diff <= -3) return "albatross";
  if (diff === -2) return "eagle";
  if (diff === -1) return "birdie";
  if (diff === 0) return "par";
  if (diff === 1) return "bogey";
  if (diff === 2) return "doubleBogey";
  return "triplePlus";
}

/**
 * Get result name based on net score vs par (with handicap)
 */
export function getScoreResult(
  grossStrokes: number,
  par: number,
  playingHandicap: number = 0,
  holeHandicap: number = 1,
  useHandicap: boolean = false
): StablefordResult {
  const score = useHandicap
    ? calculateNetScore(grossStrokes, playingHandicap, holeHandicap)
    : grossStrokes;
  const diff = score - par;

  if (diff <= -3) return "albatross";
  if (diff === -2) return "eagle";
  if (diff === -1) return "birdie";
  if (diff === 0) return "par";
  if (diff === 1) return "bogey";
  if (diff === 2) return "doubleBogey";
  return "triplePlus";
}

/**
 * Calculate Sindicato points for a hole
 */
export function calculateSindicatoPoints(
  players: Player[],
  holeNumber: number,
  holesData: HoleData[],
  pointsConfig: number[] = [4, 2, 1, 0]
): Map<string, number> {
  const holeData = holesData.find((h) => h.number === holeNumber);
  if (!holeData) return new Map();

  // Calculate net scores for all players
  const playerScores = players
    .filter((p) => p.scores[holeNumber])
    .map((player) => ({
      id: player.id,
      netScore: calculateNetScore(
        player.scores[holeNumber].strokes,
        player.playingHandicap,
        holeData.handicap
      ),
    }))
    .sort((a, b) => a.netScore - b.netScore);

  const points = new Map<string, number>();

  // Group by net score for ties
  let currentRank = 0;
  let i = 0;
  while (i < playerScores.length) {
    const currentScore = playerScores[i].netScore;
    const tiedPlayers: string[] = [];

    // Find all players with same score
    while (i < playerScores.length && playerScores[i].netScore === currentScore) {
      tiedPlayers.push(playerScores[i].id);
      i++;
    }

    // Calculate points for tied players
    let totalPoints = 0;
    for (let j = 0; j < tiedPlayers.length; j++) {
      const rankIndex = currentRank + j;
      if (rankIndex < pointsConfig.length) {
        totalPoints += pointsConfig[rankIndex];
      }
    }

    const pointsPerPlayer = totalPoints / tiedPlayers.length;
    tiedPlayers.forEach((id) => points.set(id, pointsPerPlayer));

    currentRank += tiedPlayers.length;
  }

  return points;
}

/**
 * Calculate Team (Best Ball) points for a hole
 */
export function calculateBestBallPoints(
  players: Player[],
  holeNumber: number,
  holesData: HoleData[],
  bestBallPoints: number = 1
): { teamA: number; teamB: number } {
  const holeData = holesData.find((h) => h.number === holeNumber);
  if (!holeData) return { teamA: 0, teamB: 0 };

  const teamAPlayers = players.filter((p) => p.team === "A" && p.scores[holeNumber]);
  const teamBPlayers = players.filter((p) => p.team === "B" && p.scores[holeNumber]);

  const getBestNetScore = (teamPlayers: Player[]): number | null => {
    if (teamPlayers.length === 0) return null;

    return Math.min(
      ...teamPlayers.map((p) =>
        calculateNetScore(
          p.scores[holeNumber].strokes,
          p.playingHandicap,
          holeData.handicap
        )
      )
    );
  };

  const teamABest = getBestNetScore(teamAPlayers);
  const teamBBest = getBestNetScore(teamBPlayers);

  if (teamABest === null || teamBBest === null) {
    return { teamA: 0, teamB: 0 };
  }

  if (teamABest < teamBBest) {
    return { teamA: bestBallPoints, teamB: 0 };
  } else if (teamBBest < teamABest) {
    return { teamA: 0, teamB: bestBallPoints };
  } else {
    // Tie
    return { teamA: bestBallPoints / 2, teamB: bestBallPoints / 2 };
  }
}

/**
 * Calculate Team (Good/Bad Ball) points for a hole
 */
export function calculateGoodBadBallPoints(
  players: Player[],
  holeNumber: number,
  holesData: HoleData[],
  bestBallPoints: number = 1,
  worstBallPoints: number = 1
): { teamA: number; teamB: number } {
  const holeData = holesData.find((h) => h.number === holeNumber);
  if (!holeData) return { teamA: 0, teamB: 0 };

  const getTeamScores = (team: "A" | "B"): number[] => {
    return players
      .filter((p) => p.team === team && p.scores[holeNumber])
      .map((p) =>
        calculateNetScore(
          p.scores[holeNumber].strokes,
          p.playingHandicap,
          holeData.handicap
        )
      );
  };

  const teamAScores = getTeamScores("A");
  const teamBScores = getTeamScores("B");

  if (teamAScores.length === 0 || teamBScores.length === 0) {
    return { teamA: 0, teamB: 0 };
  }

  let teamAPoints = 0;
  let teamBPoints = 0;

  // Best ball comparison
  const teamABest = Math.min(...teamAScores);
  const teamBBest = Math.min(...teamBScores);

  if (teamABest < teamBBest) {
    teamAPoints += bestBallPoints;
  } else if (teamBBest < teamABest) {
    teamBPoints += bestBallPoints;
  } else {
    teamAPoints += bestBallPoints / 2;
    teamBPoints += bestBallPoints / 2;
  }

  // Worst ball comparison
  const teamAWorst = Math.max(...teamAScores);
  const teamBWorst = Math.max(...teamBScores);

  if (teamAWorst < teamBWorst) {
    teamAPoints += worstBallPoints;
  } else if (teamBWorst < teamAWorst) {
    teamBPoints += worstBallPoints;
  } else {
    teamAPoints += worstBallPoints / 2;
    teamBPoints += worstBallPoints / 2;
  }

  return { teamA: teamAPoints, teamB: teamBPoints };
}

/**
 * Calculate total Stableford points for a player
 */
export function calculateTotalStableford(
  player: Player,
  holesData: HoleData[],
  courseLength: "18" | "front9" | "back9"
): number {
  const holes = getHolesForCourseLength(courseLength);

  return holes.reduce((total, holeNum) => {
    const score = player.scores[holeNum];
    const holeData = holesData.find((h) => h.number === holeNum);

    if (!score || !holeData) return total;

    return (
      total +
      calculateStablefordPoints(
        score.strokes,
        holeData.par,
        player.playingHandicap,
        holeData.handicap
      )
    );
  }, 0);
}

/**
 * Get hole numbers based on course length
 */
export function getHolesForCourseLength(
  courseLength: "18" | "front9" | "back9"
): number[] {
  if (courseLength === "front9") {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9];
  } else if (courseLength === "back9") {
    return [10, 11, 12, 13, 14, 15, 16, 17, 18];
  }
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
}

/**
 * Calculate total strokes for a player
 */
export function calculateTotalStrokes(
  player: Player,
  courseLength: "18" | "front9" | "back9"
): number {
  const holes = getHolesForCourseLength(courseLength);

  return holes.reduce((total, holeNum) => {
    const score = player.scores[holeNum];
    return total + (score?.strokes || 0);
  }, 0);
}

/**
 * Calculate OUT (front 9) total strokes
 */
export function calculateOutStrokes(player: Player): number {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].reduce((total, holeNum) => {
    const score = player.scores[holeNum];
    return total + (score?.strokes || 0);
  }, 0);
}

/**
 * Calculate IN (back 9) total strokes
 */
export function calculateInStrokes(player: Player): number {
  return [10, 11, 12, 13, 14, 15, 16, 17, 18].reduce((total, holeNum) => {
    const score = player.scores[holeNum];
    return total + (score?.strokes || 0);
  }, 0);
}
