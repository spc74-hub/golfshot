import type { Player, HoleData, StablefordResult } from "@/types";

/**
 * Calculate playing handicap from handicap index and slope
 * Always calculates at 100% - the percentage parameter is kept for backwards compatibility
 * but should NOT be used for 75% calculations (use calculate75PercentDifferenceHDJ instead)
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
 * Calculate the 75% difference handicap for match play
 *
 * In 75% handicap mode:
 * - The player with the lowest HDJ is the "base" and plays at 0 golpes de ventaja
 * - Other players receive 75% of their HDJ difference from the base
 *
 * @param players - Array of players with their full HDJ (100%)
 * @returns Map of playerId/tempId to their match play golpes de ventaja
 */
export function calculate75PercentDifferenceHDJ(
  players: { id?: string; tempId?: string; playingHandicap: number }[]
): Map<string, number> {
  const result = new Map<string, number>();

  if (players.length === 0) return result;

  // Find the minimum HDJ (the "base" player)
  const minHDJ = Math.min(...players.map(p => p.playingHandicap));

  // Calculate golpes de ventaja for each player
  for (const player of players) {
    const key = player.id || player.tempId || '';
    const difference = player.playingHandicap - minHDJ;
    const golpesVentaja = Math.round(difference * 0.75);
    result.set(key, golpesVentaja);
  }

  return result;
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

/**
 * Match Play result for a single hole
 * Returns: 1 = player1 wins, -1 = player2 wins, 0 = halved (tie)
 *
 * In Match Play, strokes are given based on the DIFFERENCE between handicaps.
 * The lower handicap player plays at scratch (0 strokes), and the higher
 * handicap player receives strokes equal to the difference.
 *
 * For 9-hole rounds, the handicap difference is halved (rounded).
 */
export function calculateMatchPlayHoleResult(
  player1: Player,
  player2: Player,
  holeNumber: number,
  holesData: HoleData[],
  is9Holes: boolean = false
): number {
  const holeData = holesData.find((h) => h.number === holeNumber);
  if (!holeData) return 0;

  const score1 = player1.scores[holeNumber];
  const score2 = player2.scores[holeNumber];

  if (!score1 || !score2) return 0;

  // Calculate handicap difference - only the higher handicap player receives strokes
  // For 9-hole rounds, halve the difference (rounded)
  let hcpDiff = player2.playingHandicap - player1.playingHandicap;
  if (is9Holes) {
    hcpDiff = Math.round(hcpDiff / 2);
  }

  let net1: number;
  let net2: number;

  if (hcpDiff >= 0) {
    // Player 2 has higher handicap (or equal), player 1 plays scratch
    net1 = score1.strokes;
    net2 = calculateNetScore(score2.strokes, hcpDiff, holeData.handicap);
  } else {
    // Player 1 has higher handicap, player 2 plays scratch
    net1 = calculateNetScore(score1.strokes, -hcpDiff, holeData.handicap);
    net2 = score2.strokes;
  }

  if (net1 < net2) return 1; // Player 1 wins
  if (net2 < net1) return -1; // Player 2 wins
  return 0; // Halved
}

/**
 * Calculate Match Play cumulative score through completed holes
 * Returns: positive = player1 leads, negative = player2 leads, 0 = all square
 */
export function calculateMatchPlayScore(
  player1: Player,
  player2: Player,
  completedHoles: number[],
  holesData: HoleData[],
  is9Holes: boolean = false
): number {
  return completedHoles.reduce((score, holeNum) => {
    return score + calculateMatchPlayHoleResult(player1, player2, holeNum, holesData, is9Holes);
  }, 0);
}

/**
 * Format Match Play score for display
 * e.g., "2 UP", "1 DN", "AS" (All Square)
 */
export function formatMatchPlayScore(
  score: number,
  playerIndex: 0 | 1 = 0
): string {
  // If playerIndex is 1, invert the score (from player 2's perspective)
  const adjustedScore = playerIndex === 0 ? score : -score;

  if (adjustedScore === 0) return "AS"; // All Square
  if (adjustedScore > 0) return `${adjustedScore} UP`;
  return `${Math.abs(adjustedScore)} DN`;
}

/**
 * Get Match Play holes remaining
 */
export function getMatchPlayHolesRemaining(
  courseLength: "18" | "front9" | "back9",
  completedHoles: number[]
): number {
  const totalHoles = courseLength === "18" ? 18 : 9;
  return totalHoles - completedHoles.length;
}

/**
 * Check if Match Play is decided (dormie or won)
 * Returns: { decided: boolean, winner: 0 | 1 | null }
 */
export function isMatchPlayDecided(
  score: number,
  holesRemaining: number
): { decided: boolean; winner: 0 | 1 | null } {
  const absScore = Math.abs(score);

  if (absScore > holesRemaining) {
    // Match is won - lead is greater than holes remaining
    return {
      decided: true,
      winner: score > 0 ? 0 : 1,
    };
  }

  return { decided: false, winner: null };
}

/**
 * Format final Match Play result
 * e.g., "3&2", "2&1", "1 UP", "AS" (for tie)
 */
export function formatMatchPlayFinalResult(
  score: number,
  holesRemaining: number,
  playerIndex: 0 | 1 = 0
): string {
  const adjustedScore = playerIndex === 0 ? score : -score;
  const absScore = Math.abs(adjustedScore);

  if (adjustedScore === 0) return "AS"; // All Square (tie)

  if (holesRemaining === 0) {
    // Finished on last hole
    return adjustedScore > 0 ? "1 UP" : "1 DN";
  }

  if (absScore > holesRemaining) {
    // Won before finishing
    const margin = absScore;
    const holesLeft = holesRemaining;
    if (adjustedScore > 0) {
      return `${margin}&${holesLeft}`;
    } else {
      return `${margin}&${holesLeft} DN`;
    }
  }

  // Match still in progress or just finished
  return adjustedScore > 0 ? `${absScore} UP` : `${absScore} DN`;
}
