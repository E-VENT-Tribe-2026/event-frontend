import { getBaseUrl } from "./apiUrls";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions extends RequestInit {
  authToken?: string | null;
}

class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function request<TResponse>(
  path: string,
  method: HttpMethod,
  body?: unknown,
  options: RequestOptions = {},
): Promise<TResponse> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    throw new Error("API base URL is not configured (VITE_API_BASE_URL).");
  }

  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (options.authToken) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${options.authToken}`;
  }

  const res = await fetch(url, {
    ...options,
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      typeof data === "object" && data !== null && "detail" in data
        ? // @ts-expect-error detail is often present on FastAPI errors
          data.detail || "Request failed"
        : (data as string) || "Request failed";
    throw new ApiError(message, res.status, data);
  }

  return data as TResponse;
}

export const apiClient = {
  get: <TResponse>(path: string, options?: RequestOptions) =>
    request<TResponse>(path, "GET", undefined, options),
  post: <TResponse>(path: string, body?: unknown, options?: RequestOptions) =>
    request<TResponse>(path, "POST", body, options),
  put: <TResponse>(path: string, body?: unknown, options?: RequestOptions) =>
    request<TResponse>(path, "PUT", body, options),
  patch: <TResponse>(path: string, body?: unknown, options?: RequestOptions) =>
    request<TResponse>(path, "PATCH", body, options),
  delete: <TResponse>(path: string, options?: RequestOptions) =>
    request<TResponse>(path, "DELETE", undefined, options),
};

export { ApiError };

