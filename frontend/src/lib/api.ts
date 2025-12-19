import type {
  Course,
  CreateCourseInput,
  Round,
  CreateRoundInput,
  UpdateRoundInput,
  User,
  AdminStats,
} from "@/types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Transform backend Course (snake_case) to frontend Course (camelCase)
function transformCourse(backendCourse: Record<string, unknown>): Course {
  return {
    id: backendCourse.id as string,
    name: backendCourse.name as string,
    holes: backendCourse.holes as 9 | 18,
    par: backendCourse.par as number,
    tees: backendCourse.tees as Course["tees"],
    holesData: (backendCourse.holes_data || backendCourse.holesData) as Course["holesData"],
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
    return fetchWithAuth("/users");
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
};

// Courses API
export const coursesApi = {
  list: async (): Promise<Course[]> => {
    const data = await fetchWithAuth("/courses");
    return (data as Record<string, unknown>[]).map(transformCourse);
  },

  get: async (id: string): Promise<Course> => {
    const data = await fetchWithAuth(`/courses/${id}`);
    return transformCourse(data as Record<string, unknown>);
  },

  create: async (data: CreateCourseInput): Promise<Course> => {
    const result = await fetchWithAuth("/courses", {
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
    const data = await fetchWithAuth("/rounds");
    return (data as Record<string, unknown>[]).map(transformRound);
  },

  get: async (id: string): Promise<Round> => {
    const data = await fetchWithAuth(`/rounds/${id}`);
    return transformRound(data as Record<string, unknown>);
  },

  create: async (data: CreateRoundInput | Record<string, unknown>): Promise<Round> => {
    const result = await fetchWithAuth("/rounds", {
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
};

// Admin API
export const adminApi = {
  getStats: async (): Promise<AdminStats> => {
    return fetchWithAuth("/admin/stats");
  },
};
