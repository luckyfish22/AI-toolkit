// API 请求封装 — 与 Express 后端通信

const API_BASE = '/api';

async function request<T>(
  url: string,
  options?: { method?: string; body?: unknown }
): Promise<T> {
  const fetchOptions: RequestInit = {};
  if (options?.method) {
    fetchOptions.method = options.method;
    if (options.body) {
      fetchOptions.headers = { 'Content-Type': 'application/json' };
      fetchOptions.body = JSON.stringify(options.body);
    }
  }
  const res = await fetch(`${API_BASE}${url}`, fetchOptions);
  // DELETE may return no content
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export interface ApiProject {
  name: string;
  path: string;
  displayName: string;
  realPath: string;
  sessionCount: number;
  lastActivity: number;
}

export interface ApiSession {
  sessionId: string;
  title: string;
  timestamp: number;
  messageCount: number;
  projectPath: string;
  projectName: string;
  cwd: string;
  entrypoint: string;
  version: string;
}

export interface ApiTranscriptEntry {
  uuid: string;
  parentUuid: string | null;
  type: string;
  sessionId: string;
  timestamp?: string;
  message?: {
    id?: string;
    role: string;
    content: string | unknown[];
    model?: string;
  };
  [key: string]: unknown;
}

export interface ApiTranscript {
  entries: ApiTranscriptEntry[];
  sessionMeta: {
    sessionId: string;
    title: string;
    model?: string;
    startTime?: string;
    endTime?: string;
    messageCount: number;
    cwd?: string;
    version?: string;
  };
}

export interface ApiSearchResult {
  sessionId: string;
  projectPath: string;
  projectName: string;
  sessionTitle: string;
  timestamp: number;
  matches: {
    lineNumber: number;
    context: string;
    matchType: string;
    content: string;
  }[];
}

export async function fetchProjects(): Promise<ApiProject[]> {
  const data = await request<{ projects: ApiProject[] }>('/projects');
  return data.projects;
}

export async function fetchSessions(projectName: string): Promise<ApiSession[]> {
  const data = await request<{ sessions: ApiSession[] }>(
    `/sessions/${encodeURIComponent(projectName)}`
  );
  return data.sessions;
}

export async function fetchTranscript(
  projectName: string,
  sessionId: string
): Promise<ApiTranscript> {
  return request<ApiTranscript>(
    `/transcript/${encodeURIComponent(projectName)}/${sessionId}`
  );
}

// ============================================================
// 记忆 API
// ============================================================

export interface ApiMemory {
  fileName: string
  frontmatter: {
    name?: string
    description?: string
    metadata?: {
      type?: string
      node_type?: string
      originSessionId?: string
    }
    [key: string]: unknown
  }
  body: string
}

export interface ApiPermissions {
  permissions: {
    allow?: string[]
    deny?: string[]
    [key: string]: unknown
  } | null
  projectPath: string
  message?: string
}

export async function fetchMemory(projectName: string): Promise<ApiMemory[]> {
  const data = await request<{ memories: ApiMemory[] }>(
    `/memory/${encodeURIComponent(projectName)}`
  )
  return data.memories
}

export async function fetchPermissions(projectName: string): Promise<ApiPermissions> {
  return request<ApiPermissions>(
    `/permissions/${encodeURIComponent(projectName)}`
  )
}

export async function fetchSearch(query: string): Promise<ApiSearchResult[]> {
  const data = await request<{ results: ApiSearchResult[] }>(
    `/search?q=${encodeURIComponent(query)}`
  )
  return data.results
}

// ============================================================
// 收藏夹 API
// ============================================================

export interface ApiCollection {
  id: string
  name: string
  parentId: string | null
  sortOrder: number
  sessions: ApiCollectionSession[]
  createdAt: string
  updatedAt: string
}

export interface ApiCollectionSession {
  id: string
  projectPath: string
  projectName: string
  sessionId: string
  sessionTitle: string
  note: string
  addedAt: string
}

export async function fetchCollections(): Promise<ApiCollection[]> {
  const data = await request<{ collections: ApiCollection[] }>('/collections')
  return data.collections
}

export async function createCollection(
  name: string,
  parentId: string | null = null
): Promise<ApiCollection> {
  return request<ApiCollection>('/collections', {
    method: 'POST',
    body: { name, parentId },
  })
}

export async function updateCollection(
  id: string,
  updates: Partial<ApiCollection>
): Promise<ApiCollection> {
  return request<ApiCollection>(`/collections/${id}`, {
    method: 'PUT',
    body: updates,
  })
}

export async function deleteCollection(id: string): Promise<void> {
  return request<void>(`/collections/${id}`, { method: 'DELETE' })
}

export async function addSessionToCollection(
  collectionId: string,
  session: {
    projectPath: string
    projectName: string
    sessionId: string
    sessionTitle: string
    note?: string
  }
): Promise<ApiCollectionSession> {
  return request<ApiCollectionSession>(`/collections/${collectionId}/sessions`, {
    method: 'POST',
    body: session,
  })
}

export async function removeSessionFromCollection(
  collectionId: string,
  refId: string
): Promise<void> {
  return request<void>(`/collections/${collectionId}/sessions/${refId}`, {
    method: 'DELETE',
  })
}

export async function updateSessionNote(
  collectionId: string,
  refId: string,
  note: string
): Promise<ApiCollectionSession> {
  return request<ApiCollectionSession>(
    `/collections/${collectionId}/sessions/${refId}`,
    { method: 'PUT', body: { note } }
  )
}

