import type {
  Course,
  CreateCourseInput,
  Round,
  CreateRoundInput,
  UpdateRoundInput,
  User,
  AdminStats,
  UserStats,
  ImportedRoundData,
  SavedPlayer,
  CreateSavedPlayerInput,
  UpdateSavedPlayerInput,
} from "@/types";

// Get API URL from environment or use default
// In production, if VITE_API_URL is not set, derive it from the current origin
function getApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl;
  }
  // In production (HTTPS), default to the backend subdomain
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    // Assuming backend is at golfshot.up.railway.app when frontend is at golfshotf.up.railway.app
    return 'https://golfshot.up.railway.app';
  }
  return "http://localhost:8000";
}

const API_URL = getApiUrl();

// Transform backend Course (snake_case) to frontend Course (camelCase)
function transformCourse(backendCourse: Record<string, unknown>): Course {
  return {
    id: backendCourse.id as string,
    name: backendCourse.name as string,
    holes: backendCourse.holes as 9 | 18,
    par: backendCourse.par as number,
    tees: backendCourse.tees as Course["tees"],
    holesData: (backendCourse.holes_data || backendCourse.holesData) as Course["holesData"],
    isFavorite: (backendCourse.is_favorite ?? backendCourse.isFavorite ?? false) as boolean,
    createdAt: backendCourse.created_at as string,
    updatedAt: backendCourse.updated_at as string,
  };
}

// Transform backend Player (snake_case) to frontend Player (camelCase)
function transformPlayer(backendPlayer: Record<string, unknown>): Round["players"][0] {
  return {
    id: backendPlayer.id as string,
    name: backendPlayer.name as string,
    odHandicapIndex: (backendPlayer.od_handicap_index ?? backendPlayer.odHandicapIndex) as number,
    teeBox: (backendPlayer.tee_box ?? backendPlayer.teeBox) as string,
    team: backendPlayer.team as "A" | "B" | undefined,
    playingHandicap: (backendPlayer.playing_handicap ?? backendPlayer.playingHandicap) as number,
    scores: backendPlayer.scores as Record<number, { strokes: number; putts: number }>,
  };
}

// Transform backend Round (snake_case) to frontend Round (camelCase)
function transformRound(backendRound: Record<string, unknown>): Round {
  return {
    id: backendRound.id as string,
    odId: (backendRound.od_id ?? backendRound.odId) as number,
    odUserId: (backendRound.od_user_id ?? backendRound.odUserId) as string,
    isFinished: (backendRound.is_finished ?? backendRound.isFinished) as boolean,
    isImported: (backendRound.is_imported ?? backendRound.isImported) as boolean | undefined,
    courseId: (backendRound.course_id ?? backendRound.courseId) as string,
    courseName: (backendRound.course_name ?? backendRound.courseName) as string,
    roundDate: (backendRound.round_date ?? backendRound.roundDate) as string,
    courseLength: (backendRound.course_length ?? backendRound.courseLength) as Round["courseLength"],
    gameMode: (backendRound.game_mode ?? backendRound.gameMode) as Round["gameMode"],
    useHandicap: (backendRound.use_handicap ?? backendRound.useHandicap) as boolean,
    handicapPercentage: (backendRound.handicap_percentage ?? backendRound.handicapPercentage) as 100 | 75,
    sindicatoPoints: (backendRound.sindicato_points ?? backendRound.sindicatoPoints) as number[] | undefined,
    teamMode: (backendRound.team_mode ?? backendRound.teamMode) as Round["teamMode"],
    bestBallPoints: (backendRound.best_ball_points ?? backendRound.bestBallPoints) as number | undefined,
    worstBallPoints: (backendRound.worst_ball_points ?? backendRound.worstBallPoints) as number | undefined,
    currentHole: (backendRound.current_hole ?? backendRound.currentHole) as number,
    completedHoles: (backendRound.completed_holes ?? backendRound.completedHoles) as number[],
    players: ((backendRound.players || []) as Record<string, unknown>[]).map(transformPlayer),
    createdAt: backendRound.created_at as string,
    updatedAt: backendRound.updated_at as string,
  };
}

// Transform frontend Player (camelCase) to backend format (snake_case)
function transformPlayerToBackend(player: Round["players"][0]): Record<string, unknown> {
  return {
    id: player.id,
    name: player.name,
    od_handicap_index: player.odHandicapIndex,
    tee_box: player.teeBox,
    team: player.team,
    playing_handicap: player.playingHandicap,
    scores: player.scores,
  };
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("access_token");

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "An error occurred" }));
    console.error("API Error:", error);
    const errorMessage = typeof error.detail === 'string'
      ? error.detail
      : JSON.stringify(error.detail || error.message || "Request failed");
    throw new Error(errorMessage);
  }

  return response.json();
}

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    return fetchWithAuth("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  register: async (email: string, password: string, displayName?: string) => {
    return fetchWithAuth("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, display_name: displayName }),
    });
  },

  logout: async () => {
    return fetchWithAuth("/auth/logout", { method: "POST" });
  },

  getMe: async (): Promise<User> => {
    return fetchWithAuth("/auth/me");
  },
};

// Users API
export const usersApi = {
  list: async (): Promise<User[]> => {
    return fetchWithAuth("/users/");
  },

  get: async (id: string): Promise<User> => {
    return fetchWithAuth(`/users/${id}`);
  },

  update: async (id: string, data: Partial<User>): Promise<User> => {
    return fetchWithAuth(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<void> => {
    return fetchWithAuth(`/users/${id}`, { method: "DELETE" });
  },

  getMyStats: async (): Promise<UserStats> => {
    const data = await fetchWithAuth("/users/me/stats");
    // Transform snake_case to camelCase
    return {
      totalRounds: data.total_rounds,
      avgStrokesPar3: data.avg_strokes_par3,
      avgStrokesPar4: data.avg_strokes_par4,
      avgStrokesPar5: data.avg_strokes_par5,
      avgPuttsPerRound: data.avg_putts_per_round,
      avgPutts9holes: data.avg_putts_9holes,
      avgPutts18holes: data.avg_putts_18holes,
      avgStrokes9holes: data.avg_strokes_9holes,
      avgStrokes18holes: data.avg_strokes_18holes,
      avgStablefordPoints: data.avg_stableford_points,
      virtualHandicap: data.virtual_handicap,
      bestRoundScore: data.best_round_score,
      bestRoundDate: data.best_round_date,
      bestRoundCourse: data.best_round_course,
    };
  },
};

// Courses API
export const coursesApi = {
  list: async (): Promise<Course[]> => {
    const data = await fetchWithAuth("/courses/");
    return (data as Record<string, unknown>[]).map(transformCourse);
  },

  get: async (id: string): Promise<Course> => {
    const data = await fetchWithAuth(`/courses/${id}`);
    return transformCourse(data as Record<string, unknown>);
  },

  create: async (data: CreateCourseInput): Promise<Course> => {
    const result = await fetchWithAuth("/courses/", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return transformCourse(result as Record<string, unknown>);
  },

  update: async (id: string, data: Partial<CreateCourseInput>): Promise<Course> => {
    const result = await fetchWithAuth(`/courses/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return transformCourse(result as Record<string, unknown>);
  },

  delete: async (id: string): Promise<void> => {
    return fetchWithAuth(`/courses/${id}`, { method: "DELETE" });
  },

  getRoundsCount: async (id: string): Promise<number> => {
    const result = await fetchWithAuth(`/courses/${id}/rounds-count`);
    return (result as { count: number }).count;
  },

  migrate: async (): Promise<{ migrated: string[]; skipped: string[] }> => {
    return fetchWithAuth("/courses/migrate", { method: "POST" });
  },

  // Image OCR methods - extract course data from scorecard images
  extractFromImage: async (file: File): Promise<{ success: boolean; message: string; course_data: CreateCourseInput }> => {
    const token = localStorage.getItem("access_token");
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_URL}/courses/from-image/extract`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "An error occurred" }));
      throw new Error(error.detail || error.message || "Failed to extract course data");
    }

    return response.json();
  },

  saveExtracted: async (courseData: CreateCourseInput): Promise<Course> => {
    const result = await fetchWithAuth("/courses/from-image/save", {
      method: "POST",
      body: JSON.stringify(courseData),
    });
    return transformCourse(result as Record<string, unknown>);
  },
};

// Rounds API
export const roundsApi = {
  list: async (): Promise<Round[]> => {
    const data = await fetchWithAuth("/rounds/");
    return (data as Record<string, unknown>[]).map(transformRound);
  },

  get: async (id: string): Promise<Round> => {
    const data = await fetchWithAuth(`/rounds/${id}`);
    return transformRound(data as Record<string, unknown>);
  },

  create: async (data: CreateRoundInput | Record<string, unknown>): Promise<Round> => {
    const result = await fetchWithAuth("/rounds/", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return transformRound(result as Record<string, unknown>);
  },

  update: async (id: string, data: UpdateRoundInput | Record<string, unknown>): Promise<Round> => {
    // Transform camelCase to snake_case for backend
    const backendData: Record<string, unknown> = {};
    const inputData = data as Record<string, unknown>;

    // Map camelCase fields to snake_case
    if (inputData.currentHole !== undefined) backendData.current_hole = inputData.currentHole;
    if (inputData.completedHoles !== undefined) backendData.completed_holes = inputData.completedHoles;
    if (inputData.isFinished !== undefined) backendData.is_finished = inputData.isFinished;

    // Transform players to backend format if present
    if (inputData.players && Array.isArray(inputData.players)) {
      backendData.players = (inputData.players as Round["players"]).map(transformPlayerToBackend);
    }

    const result = await fetchWithAuth(`/rounds/${id}`, {
      method: "PUT",
      body: JSON.stringify(backendData),
    });
    return transformRound(result as Record<string, unknown>);
  },

  delete: async (id: string): Promise<void> => {
    return fetchWithAuth(`/rounds/${id}`, { method: "DELETE" });
  },

  finish: async (id: string): Promise<Round> => {
    const result = await fetchWithAuth(`/rounds/${id}/finish`, { method: "PATCH" });
    return transformRound(result as Record<string, unknown>);
  },

  // Import round from image
  extractFromImage: async (file: File): Promise<{ success: boolean; message: string; round_data: ImportedRoundData }> => {
    const token = localStorage.getItem("access_token");
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_URL}/rounds/import/extract`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "An error occurred" }));
      throw new Error(error.detail || error.message || "Failed to extract round data");
    }

    return response.json();
  },

  saveImported: async (roundData: ImportedRoundData): Promise<Round> => {
    const result = await fetchWithAuth("/rounds/import/save", {
      method: "POST",
      body: JSON.stringify(roundData),
    });
    return transformRound(result as Record<string, unknown>);
  },
};

// Admin API
export const adminApi = {
  getStats: async (): Promise<AdminStats> => {
    return fetchWithAuth("/admin/stats");
  },
};

// Transform backend SavedPlayer (snake_case) to frontend SavedPlayer (camelCase)
function transformSavedPlayer(backendPlayer: Record<string, unknown>): SavedPlayer {
  return {
    id: backendPlayer.id as string,
    userId: (backendPlayer.user_id ?? backendPlayer.userId) as string,
    name: backendPlayer.name as string,
    handicapIndex: (backendPlayer.handicap_index ?? backendPlayer.handicapIndex) as number,
    preferredTee: (backendPlayer.preferred_tee ?? backendPlayer.preferredTee) as string | undefined,
    createdAt: backendPlayer.created_at as string,
    updatedAt: backendPlayer.updated_at as string,
  };
}

// Players API (saved players for quick selection)
export const playersApi = {
  list: async (): Promise<SavedPlayer[]> => {
    const result = await fetchWithAuth("/players/");
    return (result as Record<string, unknown>[]).map(transformSavedPlayer);
  },

  get: async (id: string): Promise<SavedPlayer> => {
    const result = await fetchWithAuth(`/players/${id}`);
    return transformSavedPlayer(result as Record<string, unknown>);
  },

  create: async (player: CreateSavedPlayerInput): Promise<SavedPlayer> => {
    const result = await fetchWithAuth("/players/", {
      method: "POST",
      body: JSON.stringify({
        name: player.name,
        handicap_index: player.handicapIndex,
        preferred_tee: player.preferredTee,
      }),
    });
    return transformSavedPlayer(result as Record<string, unknown>);
  },

  update: async (id: string, player: UpdateSavedPlayerInput): Promise<SavedPlayer> => {
    const body: Record<string, unknown> = {};
    if (player.name !== undefined) body.name = player.name;
    if (player.handicapIndex !== undefined) body.handicap_index = player.handicapIndex;
    if (player.preferredTee !== undefined) body.preferred_tee = player.preferredTee;

    const result = await fetchWithAuth(`/players/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return transformSavedPlayer(result as Record<string, unknown>);
  },

  delete: async (id: string): Promise<void> => {
    return fetchWithAuth(`/players/${id}`, { method: "DELETE" });
  },
};
