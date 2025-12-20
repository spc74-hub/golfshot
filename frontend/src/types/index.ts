// User types
export interface User {
  id: string;
  email: string;
  displayName: string | null;
  role: "user" | "admin";
  status: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
}

// Course types
export interface Tee {
  name: string;
  slope: number;
  rating: number;
}

export interface HoleData {
  number: number;
  par: 3 | 4 | 5;
  handicap: number;
  distance: number;
  distances?: Record<string, number>; // Distance per tee (e.g., {"Blancas": 375, "Amarillas": 347})
}

export interface Course {
  id: string;
  name: string;
  holes: 9 | 18;
  par: number;
  tees: Tee[];
  holesData: HoleData[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

// Score types
export interface Score {
  strokes: number;
  putts: number;
}

// Player types
export interface Player {
  id: string;
  name: string;
  odHandicapIndex: number;
  teeBox: string;
  team?: "A" | "B";
  playingHandicap: number;
  scores: Record<number, Score>;
}

// Round types
export type CourseLength = "18" | "front9" | "back9";
export type GameMode = "stableford" | "stroke" | "sindicato" | "team" | "matchplay";
export type TeamMode = "bestBall" | "goodBadBall";

export interface Round {
  id: string;
  odId: number;
  odUserId: string;
  isFinished: boolean;
  isImported?: boolean;
  courseId: string;
  courseName: string;
  roundDate: string;
  courseLength: CourseLength;
  gameMode: GameMode;
  useHandicap: boolean;
  handicapPercentage: 100 | 75;
  sindicatoPoints?: number[];
  teamMode?: TeamMode;
  bestBallPoints?: number;
  worstBallPoints?: number;
  currentHole: number;
  completedHoles: number[];
  players: Player[];
  createdAt: string;
  updatedAt: string;
}

// Form types for creating/updating
export interface CreateRoundInput {
  courseId: string;
  courseName: string;
  roundDate: string;
  courseLength: CourseLength;
  gameMode: GameMode;
  useHandicap: boolean;
  handicapPercentage: 100 | 75;
  sindicatoPoints?: number[];
  teamMode?: TeamMode;
  bestBallPoints?: number;
  worstBallPoints?: number;
  players: Omit<Player, "id" | "playingHandicap" | "scores">[];
}

export interface UpdateRoundInput {
  currentHole?: number;
  completedHoles?: number[];
  players?: Player[];
  isFinished?: boolean;
}

export interface CreatePlayerInput {
  name: string;
  odHandicapIndex: number;
  teeBox: string;
  team?: "A" | "B";
  playingHandicap?: number; // HDJ - Handicap de Juego
}

export interface CreateCourseInput {
  name: string;
  holes: 9 | 18;
  par: number;
  tees: Tee[];
  holesData: HoleData[];
  is_favorite?: boolean;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  displayName?: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
}

// Stats types
export interface AdminStats {
  totalUsers: number;
  totalRounds: number;
  roundsThisMonth: number;
  totalCourses: number;
}

export interface UserStats {
  totalRounds: number;
  avgStrokesPar3: number | null;
  avgStrokesPar4: number | null;
  avgStrokesPar5: number | null;
  avgPuttsPerRound: number | null;
  avgPutts9holes: number | null;
  avgPutts18holes: number | null;
  avgStrokes9holes: number | null;
  avgStrokes18holes: number | null;
  avgStablefordPoints: number | null;  // Normalized to 18-hole equivalent
  virtualHandicap: number | null;  // Based on 18-hole rounds only
  // Best 18-hole round
  bestRoundScore: number | null;
  bestRoundDate: string | null;
  bestRoundCourse: string | null;
  // Best 9-hole round
  bestRound9Score: number | null;
  bestRound9Date: string | null;
  bestRound9Course: string | null;
}

export interface ScoreDistribution {
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubleBogeys: number;
  worse: number;
}

// Score result type (relative to par)
export type ScoreResult =
  | "albatross"
  | "eagle"
  | "birdie"
  | "par"
  | "bogey"
  | "doubleBogey"
  | "triplePlus";

// Color mapping for scores (relative to par)
// Orange = Eagle, Red = Birdie, Blue = Par, Green = Bogey, Gray = Double, Black = Triple+
export const SCORE_COLORS: Record<ScoreResult, string> = {
  albatross: "bg-orange-500 text-white",
  eagle: "bg-orange-400 text-white",
  birdie: "bg-red-500 text-white",
  par: "bg-blue-500 text-white",
  bogey: "bg-green-500 text-white",
  doubleBogey: "bg-gray-400 text-white",
  triplePlus: "bg-black text-white",
};

// Legacy alias for backward compatibility
export type StablefordResult = ScoreResult;

// Default values
export const DEFAULT_HANDICAP_INDEX = 24.0;
export const DEFAULT_PUTTS = 2;
export const DEFAULT_SINDICATO_POINTS = [4, 2, 1, 0];
export const DEFAULT_HANDICAP_PERCENTAGE = 100;

// External course search result type
export interface ExternalCourseResult {
  id: string;
  name: string;
  city?: string;
  state?: string;
  country?: string;
  address?: string;
  phone?: string;
  website?: string;
  latitude?: number;
  longitude?: number;
}

export interface ExternalSearchResponse {
  query: string;
  count: number;
  courses: ExternalCourseResult[];
}

// Import round data from scorecard image
export interface ImportedHoleData {
  number: number;
  par: number;
  handicap: number;
  strokes: number;
  distance: number;
  putts?: number;
}

export interface ImportedRoundData {
  course: {
    name: string;
    location: string;
    tee_played: {
      name: string;
      slope: number;
      rating: number;
    };
  };
  round: {
    date: string;
    player_name: string;
    handicap_index: number;
    calculated_hdj?: number;
  };
  holes: number;
  course_length: CourseLength; // "18", "front9", or "back9"
  holes_data: ImportedHoleData[];
  totals: {
    strokes: number;
    par: number;
    stableford_points: number;
    putts?: number;
  };
}

// Saved Player types (for player management)
export interface SavedPlayer {
  id: string;
  userId: string;
  name: string;
  handicapIndex: number;
  preferredTee?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedPlayerInput {
  name: string;
  handicapIndex: number;
  preferredTee?: string;
}

export interface UpdateSavedPlayerInput {
  name?: string;
  handicapIndex?: number;
  preferredTee?: string;
}
