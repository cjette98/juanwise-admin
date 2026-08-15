import { request, uploadToSignedUrl } from './client';
import { clearSession, setSession } from './session';
import type {
  AnalyticsFilter,
  ApiCategory,
  ApiCategoryKey,
  ApiClass,
  ApiClassMember,
  ApiContentSettings,
  ApiCurrentUser,
  ApiGuestLeaderboard,
  ApiJigsawItem,
  ApiLeaderboard,
  ApiQuestion,
  ApiSession,
  ApiUserProfile,
  JigsawItemInput,
  ListUsersQuery,
  LoginRequest,
  Page,
  UpdateCategoryRequest,
  UploadUrlRequest,
  UploadUrlResponse,
  UpsertQuestionRequest,
} from './types';

/* -------------------------------------------------------------------- auth */

export const authApi = {
  /** Stores the session as a side effect, the same as the app's client does. */
  async login(input: LoginRequest): Promise<ApiSession> {
    const session = await request<ApiSession>('/auth/login', {
      method: 'POST',
      body: input,
      auth: false,
    });
    setSession(session);
    return session;
  },

  me(): Promise<ApiCurrentUser> {
    return request('/auth/me');
  },

  /**
   * Revokes every refresh token server-side, then drops the local session. The
   * local half runs even if the network call fails — signing out must not be
   * blocked by a dead connection.
   */
  async logout(): Promise<void> {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch {
      // best effort
    } finally {
      clearSession();
    }
  },
};

/* ------------------------------------------------------------------- users */

export const usersApi = {
  list(query: ListUsersQuery = {}): Promise<Page<ApiUserProfile>> {
    return request('/users', { query: { ...query } });
  },

  /**
   * Pages through every user matching the filter. The console's tables sort,
   * count and cross-reference the whole set (a student's class code, a
   * teacher's roster size), so a single page would give wrong totals.
   */
  async listAll(query: Omit<ListUsersQuery, 'cursor' | 'limit'> = {}): Promise<ApiUserProfile[]> {
    const out: ApiUserProfile[] = [];
    let cursor: string | undefined;
    do {
      const page = await usersApi.list({ ...query, limit: 100, cursor });
      out.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return out;
  },

  get(uid: string): Promise<ApiUserProfile> {
    return request(`/users/${encodeURIComponent(uid)}`);
  },
};

/* ----------------------------------------------------------------- classes */

export const classesApi = {
  /** Admin-only cross-teacher view — juanwise-be `GET /classes`. */
  async all(teacherId?: string): Promise<ApiClass[]> {
    const { items } = await request<{ items: ApiClass[] }>('/classes', { query: { teacherId } });
    return items;
  },

  get(id: string): Promise<ApiClass> {
    return request(`/classes/${encodeURIComponent(id)}`);
  },

  members(
    id: string,
    query: { includeRemoved?: boolean; limit?: number; cursor?: string } = {},
  ): Promise<Page<ApiClassMember>> {
    return request(`/classes/${encodeURIComponent(id)}/members`, {
      query: {
        limit: query.limit,
        cursor: query.cursor,
        includeRemoved:
          query.includeRemoved === undefined ? undefined : String(query.includeRemoved),
      },
    });
  },

  /** Pages through the whole roster — classes are small enough to hold in memory. */
  async allMembers(id: string, includeRemoved = false): Promise<ApiClassMember[]> {
    const out: ApiClassMember[] = [];
    let cursor: string | undefined;
    do {
      const page = await classesApi.members(id, { includeRemoved, limit: 100, cursor });
      out.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return out;
  },
};

/* ----------------------------------------------------------------- content */

export const contentApi = {
  async categories(): Promise<ApiCategory[]> {
    const { items } = await request<{ items: ApiCategory[] }>('/content/categories');
    return items;
  },

  category(key: ApiCategoryKey): Promise<ApiCategory> {
    return request(`/content/categories/${key}`);
  },

  updateCategory(key: ApiCategoryKey, patch: UpdateCategoryRequest): Promise<ApiCategory> {
    return request(`/content/categories/${key}`, { method: 'PUT', body: patch });
  },

  /**
   * Replaces the pictures and the activity assignments together. Upload, edit,
   * delete and assign are all "the jigsaw content is now this", so an activity
   * cannot be left pointing at a picture deleted in the same edit.
   */
  replaceJigsaws(
    key: ApiCategoryKey,
    items: JigsawItemInput[],
    slots: Record<string, string>,
  ): Promise<{ items: ApiJigsawItem[]; slots: Record<string, string> }> {
    return request(`/content/categories/${key}/jigsaws`, {
      method: 'PUT',
      body: { items, slots },
    });
  },

  /**
   * Every slot in the grid, not just admin edits — a slot with no override
   * comes back with its seeded default and `isOverride: false`.
   */
  async questions(query: { category?: ApiCategoryKey; level?: number } = {}): Promise<ApiQuestion[]> {
    const { items } = await request<{ items: ApiQuestion[] }>('/content/questions', { query });
    return items;
  },

  question(category: ApiCategoryKey, level: number, activityNum: number): Promise<ApiQuestion> {
    return request(`/content/questions/${category}/${level}/${activityNum}`);
  },

  upsertQuestion(
    category: ApiCategoryKey,
    level: number,
    activityNum: number,
    input: UpsertQuestionRequest,
  ): Promise<ApiQuestion> {
    return request(`/content/questions/${category}/${level}/${activityNum}`, {
      method: 'PUT',
      body: input,
    });
  },

  /** Reverts to the seeded default; 404s when there was no override. */
  revertQuestion(
    category: ApiCategoryKey,
    level: number,
    activityNum: number,
  ): Promise<ApiQuestion> {
    return request(`/content/questions/${category}/${level}/${activityNum}`, { method: 'DELETE' });
  },

  settings(): Promise<ApiContentSettings> {
    return request('/content/settings');
  },

  updateSettings(showMiniLesson: boolean): Promise<ApiContentSettings> {
    return request('/content/settings', { method: 'PUT', body: { showMiniLesson } });
  },
};

/* --------------------------------------------------------------- analytics */

export const analyticsApi = {
  leaderboard(
    classId: string,
    filter: AnalyticsFilter = {},
    limit = 10,
  ): Promise<ApiLeaderboard> {
    return request('/analytics/leaderboard', { query: { classId, ...filter, limit } });
  },

  /** Registered students with no class — juanwise-be `GET /analytics/leaderboard/guests`. */
  guestLeaderboard(filter: AnalyticsFilter = {}, limit = 50): Promise<ApiGuestLeaderboard> {
    return request('/analytics/leaderboard/guests', { query: { ...filter, limit } });
  },
};

/* ------------------------------------------------------------------- media */

const CONTENT_TYPES: UploadUrlRequest['contentType'][] = ['image/jpeg', 'image/png', 'image/webp'];

function contentTypeFor(file: File): UploadUrlRequest['contentType'] {
  const found = CONTENT_TYPES.find((type) => type === file.type);
  if (found) return found;
  // A JPEG picked on some systems arrives as `image/jpg` or with no type at all.
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

export const mediaApi = {
  createUploadUrl(input: UploadUrlRequest): Promise<UploadUrlResponse> {
    return request('/media/upload-url', { method: 'POST', body: input });
  },

  /**
   * Two-step upload: ask the API for a signed URL, PUT the bytes straight to
   * Cloud Storage, then hand back the public URL to store on the category.
   */
  async upload(
    file: File,
    purpose: UploadUrlRequest['purpose'],
    options: { categoryKey?: string } = {},
  ): Promise<string> {
    const contentType = contentTypeFor(file);
    const signed = await mediaApi.createUploadUrl({
      purpose,
      contentType,
      categoryKey: options.categoryKey,
    });
    await uploadToSignedUrl(signed.uploadUrl, file, contentType, signed.requiredHeaders);
    return signed.publicUrl;
  },
};
