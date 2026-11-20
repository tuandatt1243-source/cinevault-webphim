const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const TOKEN_KEY = 'cinevault_access_token';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request(path, { method = 'GET', body, params, signal } = {}) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    });
  }

  const headers = { Accept: 'application/json' };
  const token = getStoredToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : null;

  if (!res.ok) {
    let message = 'Yêu cầu thất bại. Vui lòng thử lại.';
    if (data?.detail) {
      if (typeof data.detail === 'string') {
        message = data.detail;
      } else if (Array.isArray(data.detail)) {
        message = data.detail
          .map((e) => {
            const loc = Array.isArray(e.loc) ? e.loc.slice(1).join('.') : '';
            return loc ? `${loc}: ${e.msg}` : e.msg;
          })
          .join(' · ');
      }
    }
    throw new ApiError(message, res.status, data);
  }

  return data;
}

export const api = {
  health: () => request('/health'),

  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  // Users & Watchlist
  updateProfile: (payload) => request('/users/me', { method: 'PATCH', body: payload }),
  getWatchlist: () => request('/users/me/watchlist'),
  addWatchlist: (movieId) => request(`/users/me/watchlist/${movieId}`, { method: 'POST' }),
  removeWatchlist: (movieId) => request(`/users/me/watchlist/${movieId}`, { method: 'DELETE' }),

  // Movies
  getGenres: () => request('/movies/genres'),
  getDecades: () => request('/movies/decades'),
  getRoulette: (params) => request('/movies/roulette', { params }),
  getPersonSpotlight: (name, role = 'director') =>
    request('/movies/person', { params: { name, role } }),
  getMovieInsights: (movieId) => request(`/movies/${movieId}/insights`),
  listMovies: (params) => request('/movies', { params }),
  getMovie: (movieId, trackView = true) =>
    request(`/movies/${movieId}`, { params: { track_view: trackView } }),
  translateMovie: (movieId, lang) =>
    request(`/movies/${movieId}/translate`, { params: { lang } }),
  createMovie: (payload) => request('/movies', { method: 'POST', body: payload }),
  updateMovie: (movieId, payload) => request(`/movies/${movieId}`, { method: 'PUT', body: payload }),
  softDeleteMovie: (movieId) => request(`/movies/${movieId}`, { method: 'DELETE' }),
  restoreMovie: (movieId) => request(`/movies/${movieId}/restore`, { method: 'POST' }),

  // Reviews & Interactions
  listMovieReviews: (movieId, params) => request(`/movies/${movieId}/reviews`, { params }),
  upsertReview: (movieId, payload) =>
    request(`/movies/${movieId}/reviews`, { method: 'POST', body: payload }),
  deleteReview: (reviewId) => request(`/reviews/${reviewId}`, { method: 'DELETE' }),
  createInteraction: (payload) => request('/interactions', { method: 'POST', body: payload }),

  // Tito Concierge (MongoDB RAG + Embedded Chat Sessions)
  assistantStatus: () => request('/assistant/status'),
  assistantChat: (payload) => request('/assistant/chat', { method: 'POST', body: payload }),
  assistantGetSession: (sessionId) => request(`/assistant/sessions/${sessionId}`),
  assistantClearSession: (sessionId) =>
    request(`/assistant/sessions/${sessionId}`, { method: 'DELETE' }),

  // Admin
  getAdminStats: () => request('/admin/stats'),
  getAdminSyncJobs: (params) => request('/admin/sync-jobs', { params }),
  adminListUsers: (params) => request('/admin/users', { params }),
  adminUpdateUser: (userId, payload) =>
    request(`/admin/users/${userId}`, { method: 'PATCH', body: payload }),
  adminListReviews: (params) => request('/admin/reviews', { params }),
  adminModerateReview: (reviewId, isHidden) =>
    request(`/admin/reviews/${reviewId}/moderate`, {
      method: 'PATCH',
      body: { is_hidden: isHidden },
    }),
};
