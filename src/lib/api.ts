import type { UserRole, User, EventItem } from "./storage";
import { apiClient, ApiError } from "./apiClient";
import { API_ENDPOINTS } from "./apiUrls";

export interface LoginResult {
  success: boolean;
  error?: string;
}

export interface SignupPayload {
  role: UserRole;
  name: string;
  email: string;
  password: string;
  profilePhoto: string;
  dob: string;
  gender: string;
  interests: string[];
  orgCategory?: string;
}

export interface SignupResult {
  success: boolean;
  error?: string;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    const data = await apiClient.post<{
      success?: boolean;
      access_token?: string;
      user?: User;
      detail?: string;
      error?: string;
    }>(API_ENDPOINTS.LOGIN, { email, password });

    if (!data.success && !data.access_token) {
      return { success: false, error: data.error || data.detail || "Login failed" };
    }

    return { success: true };
  } catch (err) {
    if (err instanceof ApiError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "Unable to reach server" };
  }
}

export async function signup(payload: SignupPayload): Promise<SignupResult> {
  try {
    const data = await apiClient.post<{
      success?: boolean;
      user?: User;
      detail?: string;
      error?: string;
    }>(API_ENDPOINTS.SIGNUP, payload);

    if (!data.success && !data.user) {
      return { success: false, error: data.error || data.detail || "Signup failed" };
    }

    return { success: true };
  } catch (err) {
    if (err instanceof ApiError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "Unable to reach server" };
  }
}

export interface EventFilters {
  category?: string;
  search?: string;
  upcoming?: boolean;
}

export async function fetchEvents(filters?: EventFilters): Promise<EventItem[]> {
  try {
    // Fetch ALL events by iterating through pages (backend is paginated).
    const pageSize = 50;
    let page = 1;
    const all: any[] = [];

    // Safety cap in case of unexpected backend behaviour
    const maxPages = 40; // up to 2000 events

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));

      if (filters?.category) {
        params.set("category", filters.category);
      }
      if (filters?.upcoming) {
        params.set("upcoming", "true");
      }
      if (filters?.search) {
        params.set("search", filters.search);
      }

      const raw = await apiClient.get<{
        page: number;
        limit: number;
        data: any[];
      }>(`${API_ENDPOINTS.EVENTS}?${params.toString()}`);

      const batch: any[] = Array.isArray(raw?.data) ? raw.data : [];
      if (!batch.length) break;

      all.push(...batch);

      if (batch.length < pageSize || page >= maxPages) break;
      page += 1;
    }

    return all.map((e) => {
      const id = typeof e?.id === "string" && e.id ? e.id : crypto.randomUUID();
      const title = typeof e?.title === "string" ? e.title : "Untitled event";
      const description = typeof e?.description === "string" ? e.description : "";
      const category = typeof e?.category === "string" ? e.category : "Other";

      const start = typeof e?.start_datetime === "string" ? new Date(e.start_datetime) : null;
      const date = start ? start.toISOString().slice(0, 10) : "";
      const time = start ? start.toTimeString().slice(0, 5) : "";

      const location =
        typeof e?.location_name === "string"
          ? e.location_name
          : typeof e?.location === "string"
            ? e.location
            : "";

      const lat = typeof e?.latitude === "number" ? e.latitude : 0;
      const lng = typeof e?.longitude === "number" ? e.longitude : 0;

      const budget =
        typeof e?.cost === "number"
          ? e.cost
          : typeof e?.budget === "number"
            ? e.budget
            : Number(e?.cost ?? e?.budget) || 0;

      const participantsLimit =
        typeof e?.max_capacity === "number"
          ? e.max_capacity
          : typeof e?.participantsLimit === "number"
            ? e.participantsLimit
            : Number(e?.max_capacity ?? e?.participantsLimit) || 0;

      const participants: string[] = Array.isArray(e?.participants)
        ? e.participants.filter((p: any) => typeof p === "string")
        : [];

      const image =
        typeof e?.image === "string" && e.image
          ? e.image
          : "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80";

      const organizer = typeof e?.created_by === "string" ? "Organizer" : "Organizer";
      const organizerId = typeof e?.created_by === "string" ? e.created_by : "";
      const organizerAvatar = "";

      const mapped: EventItem = {
        id,
        title,
        description,
        category,
        date,
        time,
        location,
        lat,
        lng,
        budget,
        participantsLimit,
        participants,
        image,
        organizer,
        organizerId,
        organizerAvatar,
        isPrivate: false,
        isDraft: false,
        requiresApproval: false,
        reviews: [],
        reports: [],
        collaborators: [],
        survey: undefined,
      };

      return mapped;
    });
  } catch (_err) {
    throw _err;
  }
}

