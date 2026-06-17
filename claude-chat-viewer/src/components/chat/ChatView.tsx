import type { ApiTranscript } from '../../utils/api'
import { useMemo, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

interface ChatViewProps {
  transcript: ApiTranscript | null
  loading: boolean
  searchHighlight?: string | null
}

// ============================================================
// 内容提取
// ============================================================

function getUserContent(entry: any): string {
  const content = entry.message?.content
  if (typeof content !== 'string') return ''
  const cmdMatch = content.match(/<command-name>\s*(\S+)\s*<\/command-name>/)
  if (cmdMatch) return cmdMatch[1]
  const stdoutMatch = content.match(/<local-command-stdout>\s*([\s\S]*?)\s*<\/local-command-stdout>/)
  if (stdoutMatch) return stdoutMatch[1].trim()
  if (content.includes('<local-command-caveat>') || content.startsWith('Caveat:')) return ''
  return content
}

function isRealUserMessage(entry: any): boolean {
  if (entry.type !== 'user') return false
  const content = entry.message?.content
  if (typeof content === 'string') return content.trim().length > 0
  return false
}

// ============================================================
// Markdown 渲染
// ============================================================

function MarkdownContent({ text }: { text: string }) {
  if (!text) return null
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        code({ className, children, ...props }: any) {
          const isInline = !className
          if (isInline) {
            return (
              <code className="bg-gray-100 text-amber-700 px-1.5 py-0.5 rounded text-[13px] font-mono" {...props}>
                {children}
              </code>
            )
          }
          return (
            <div className="my-4 rounded-xl overflow-hidden border border-gray-200">
              <div className="flex items-center justify-between bg-gray-100 px-4 py-1.5">
                <span className="text-xs text-gray-500 font-mono">
                  {className?.replace('language-', '') || 'code'}
                </span>
                <button
                  className="text-xs text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    navigator.clipboard.writeText(String(children).replace(/\n$/, ''))
                  }}
                >复制</button>
              </div>
              <pre className="bg-code-bg overflow-x-hidden whitespace-pre-wrap break-all">
                <code className={className} {...props}>{children}</code>
              </pre>
            </div>
          )
        },
        a({ href, children }: any) {
          return <a href={href} className="text-warm-accent hover:underline" target="_blank" rel="noopener">{children}</a>
        },
        table({ children }: any) {
          return <div className="overflow-x-auto my-4"><table className="min-w-full border border-gray-200 rounded-lg text-sm">{children}</table></div>
        },
        th({ children }: any) {
          return <th className="bg-gray-50 px-3 py-2 text-left font-medium border-b border-gray-200">{children}</th>
        },
        td({ children }: any) {
          return <td className="px-3 py-2 border-b border-gray-100">{children}</td>
        },
        ul({ children }: any) {
          return <ul className="list-disc pl-5 my-3 space-y-1">{children}</ul>
        },
        ol({ children }: any) {
          return <ol className="list-decimal pl-5 my-3 space-y-1">{children}</ol>
        },
        blockquote({ children }: any) {
          return <blockquote className="border-l-3 border-warm-accent pl-3 my-3 text-gray-500 italic">{children}</blockquote>
        },
        h1({ children }: any) {
          return <h1 className="text-xl font-bold mt-6 mb-3">{children}</h1>
        },
        h2({ children }: any) {
          return <h2 className="text-lg font-semibold mt-5 mb-2">{children}</h2>
        },
        h3({ children }: any) {
          return <h3 className="text-base font-semibold mt-4 mb-2">{children}</h3>
        },
        p({ children }: any) {
          return <p className="my-2 leading-7">{children}</p>
        },
      }}
    >
      {text}
    </ReactMarkdown>
  )
}

// ============================================================
// 主组件
// ============================================================

function ChatView({ transcript, loading, searchHighlight }: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const highlightRef = useRef<string | null>(null)

  // 搜索高亮：滚动到匹配消息
  useEffect(() => {
    if (!searchHighlight || !transcript || loading) return
    // 避免重复滚动
    if (highlightRef.current === searchHighlight) return
    highlightRef.current = searchHighlight
    // 等渲染完成后滚动
    const timer = setTimeout(() => {
      const el = document.getElementById('search-highlight-target')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 200)
    if (!searchHighlight) highlightRef.current = null
    return () => clearTimeout(timer)
  }, [searchHighlight, transcript, loading])

  const messages = useMemo(() => {
    if (!transcript) return []
    const hl = searchHighlight?.toLowerCase()
    return transcript.entries
      .filter((e) => e.type === 'user' || e.type === 'assistant')
      .filter((e) => e.type === 'assistant' || isRealUserMessage(e))
      .map((e, i) => {
        if (e.type === 'user') {
          const content = getUserContent(e)
          return {
            role: 'user' as const,
            content,
            timestamp: e.timestamp,
            key: `${e.uuid || 'msg'}-${i}`,
            isHighlighted: hl ? content.toLowerCase().includes(hl) : false,
          }
        }
        const blocks = Array.isArray(e.message?.content)
          ? e.message!.content
          : (typeof e.message?.content === 'string'
            ? [{ type: 'text', text: e.message.content }]
            : [])
        const textParts = blocks
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
        const fullText = textParts.join('\n')
        return {
          role: 'assistant' as const,
          text: fullText,
          model: e.message?.model,
          timestamp: e.timestamp,
          key: e.uuid || i,
          isHighlighted: hl ? fullText.toLowerCase().includes(hl) : false,
        }
      })
  }, [transcript, searchHighlight])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [transcript])

  // ============ 状态 ============
  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf8f5' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '32px', height: '32px', margin: '0 auto 12px', border: '2px solid #e8e2d8', borderTopColor: '#c46b4a', borderRadius: '50%' }} className="animate-spin" />
          <p style={{ fontSize: '15px', color: '#1a1a1a' }}>加载中…</p>
        </div>
      </div>
    )
  }

  if (!transcript) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf8f5' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '96px', height: '96px', margin: '0 auto 24px', borderRadius: '24px', background: '#f5f1ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg style={{ width: '44px', height: '44px', color: '#c46b4a' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <p style={{ fontSize: '24px', fontWeight: 600, color: '#1a1a1a', marginBottom: '8px' }}>选择对话开始浏览</p>
          <p style={{ fontSize: '16px', color: '#8c8580' }}>从左侧选择一个会话查看聊天记录</p>
        </div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf8f5' }}>
        <p style={{ fontSize: '15px', color: '#1a1a1a' }}>该会话暂无消息</p>
      </div>
    )
  }

  const title = transcript.sessionMeta.title || '未命名'

  // ============ 正常渲染 ============
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-warm-bg">
      {/* 会话头 */}
      <div
      style={{
        paddingTop: '24px',
        paddingBottom: '24px',
        borderBottom: '1px solid #e8e2d8',
        flexShrink: 0,
        maxWidth: '860px',
        marginLeft: 'auto',
        marginRight: 'auto',
        paddingLeft: '40px',
        paddingRight: '40px',
        width: '100%',
      }}
    >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1a1a1a' }}>{title}</h2>
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#8c8580', flexShrink: 0, marginLeft: '16px' }}>
            {transcript.sessionMeta.model && <span>{transcript.sessionMeta.model}</span>}
            <span>{messages.length} 条消息</span>
          </div>
        </div>
      </div>

      {/* 消息区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div
      className="py-8 space-y-8 overflow-x-hidden [&_pre]:whitespace-pre-wrap [&_pre]:break-all [&_code]:break-all"
      style={{
        maxWidth: '860px',
        marginLeft: 'auto',
        marginRight: 'auto',
        paddingLeft: '40px',
        paddingRight: '40px',
        width: '100%',
      }}
    >
          {messages.map((msg) => {
            const isUser = msg.role === 'user'
            const timeStr = msg.timestamp
              ? new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
              : ''

            return (
              <div key={msg.key} id={msg.isHighlighted ? 'search-highlight-target' : undefined}
                style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: isUser ? '85%' : '100%',
                  width: isUser ? undefined : '100%',
                  background: msg.isHighlighted ? '#fef3c7' : 'transparent',
                  borderRadius: msg.isHighlighted ? '8px' : undefined,
                  padding: msg.isHighlighted ? '8px' : undefined,
                  margin: msg.isHighlighted ? '-8px' : undefined,
                }}>
                  {isUser ? (
                    /* 用户消息 */
                    <div>
                      <div style={{
                        background: '#f0ebe2',
                        borderRadius: '16px',
                        borderTopRightRadius: '6px',
                        padding: '14px 18px',
                        fontSize: '15px',
                        lineHeight: 1.7,
                        color: '#1a1a1a',
                        wordBreak: 'break-word',
                        overflow: 'hidden',
                      }}>
                        <MarkdownContent text={msg.content} />
                      </div>
                      {timeStr && (
                        <div style={{ fontSize: '11px', color: '#8c8580', marginTop: '4px', textAlign: 'right' }}>{timeStr}</div>
                      )}
                    </div>
                  ) : (
                    /* Claude 消息 */
                    <div>
                      {/* 文本内容 */}
                      <div style={{
                        fontSize: '15px',
                        lineHeight: 1.7,
                        color: '#1a1a1a',
                      }}>
                        <MarkdownContent text={msg.text} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div className="h-8" />
        </div>
      </div>
    </div>
  )
}

export default ChatView
