// ============================================================
// Claude Code 转录文件的数据类型定义
// ============================================================

/** 内容块类型 —— 向前兼容（catch-all unknown 分支） */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string; signature: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: string; [key: string]: unknown }

/** 转录条目类型 */
export type EntryType =
  | 'user'
  | 'assistant'
  | 'system'
  | 'attachment'
  | 'mode'
  | 'ai-title'
  | 'agent-name'
  | 'custom-title'
  | 'file-history-snapshot'
  | 'permission-mode'
  | 'last-prompt'
  | 'queue-operation'

/** 转录 JSONL 中单行的基础结构 */
export interface TranscriptEntry {
  uuid: string
  parentUuid: string | null
  type: EntryType | string
  sessionId: string
  timestamp?: string
  isSidechain?: boolean
  message?: {
    id?: string
    role: string
    content: string | ContentBlock[]
    model?: string
    usage?: Record<string, unknown>
  }
  [key: string]: unknown
}

/** 消息树节点 */
export interface MessageNode {
  uuid: string
  parentUuid: string | null
  entry: TranscriptEntry
  children: MessageNode[]
  isSidechain: boolean
}

/** UI 层使用的统一消息 */
export interface UIMessage {
  type: 'user' | 'assistant' | 'system' | 'attachment' | 'info'
  messageId?: string
  contentBlocks?: ContentBlock[]
  model?: string
  timestamp?: string
  uuid: string
  // 用户消息
  userContent?: string
  // 系统消息
  systemSubtype?: string
  systemContent?: string
  // 附件
  attachmentType?: string
  attachmentContent?: string
  // 会话信息
  mode?: string
  aiTitle?: string
}

/** 项目信息 */
export interface Project {
  name: string       // 路径编码名（D--AAA-study-...）
  path: string       // 完整路径
  displayName: string // 人类可读名
  sessionCount: number
  lastActivity: number
}

/** 会话信息 */
export interface Session {
  sessionId: string
  title: string
  timestamp: number
  messageCount: number
  projectPath: string
  projectName: string
  cwd: string
  entrypoint: string
  version: string
}

/** 会话转录完整数据 */
export interface Transcript {
  messages: UIMessage[]
  sessionMeta: {
    sessionId: string
    title: string
    model?: string
    startTime?: string
    endTime?: string
    messageCount: number
    version?: string
    cwd?: string
  }
}

/** 搜索结果 */
export interface SearchResult {
  sessionId: string
  projectPath: string
  projectName: string
  sessionTitle: string
  timestamp: number
  matches: SearchMatch[]
}

export interface SearchMatch {
  lineNumber: number
  context: string
  matchType: string
  content: string
}
