import { useState, useCallback, useEffect, useRef } from 'react'
import type { ApiProject, ApiSession, ApiCollection, ApiSearchResult } from '../../utils/api'
import {
  createCollection, updateCollection, deleteCollection,
  addSessionToCollection, removeSessionFromCollection,
  fetchSearch,
  fetchMemory, fetchPermissions,
} from '../../utils/api'
import type { ApiMemory, ApiPermissions } from '../../utils/api'
import type { ViewMode } from '../../App'

interface SidebarProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  projects: ApiProject[]
  collections: ApiCollection[]
  sessionsMap: Record<string, ApiSession[]>
  selectedProject: string | null
  selectedSession: string | null
  onSelectProject: (name: string) => void
  onSelectSession: (sessionId: string, projectName?: string, highlight?: string) => void
  onCollectionsChange: () => void
}

// ============================================================
// 工具
// ============================================================

/** 从完整项目路径提取编码目录名（用于 API 调用） */
function getEncodedName(projectPath: string): string {
  return projectPath.split(/[\\/]/).filter(Boolean).pop() || ''
}

function formatDate(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86400000) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function buildCollectionTree(collections: ApiCollection[]) {
  const roots = collections.filter(c => !c.parentId)
  const children = (pid: string) => collections.filter(c => c.parentId === pid)
  return { roots, children }
}

// ============================================================
// 主组件
// ============================================================

function Sidebar({
  viewMode, onViewModeChange,
  projects, collections, sessionsMap,
  selectedProject, selectedSession,
  onSelectProject, onSelectSession, onCollectionsChange,
}: SidebarProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())
  const [pinnedProjects, setPinnedProjects] = useState<Set<string>>(new Set())
  const [projectMenuOpen, setProjectMenuOpen] = useState<string | null>(null)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newColName, setNewColName] = useState('')
  const [newColParentId, setNewColParentId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')

  // 记忆/权限弹窗
  const [memoryModal, setMemoryModal] = useState<{
    projectName: string; displayName: string
  } | null>(null)
  const [memoryData, setMemoryData] = useState<ApiMemory[]>([])
  const [memoryLoading, setMemoryLoading] = useState(false)

  const [permModal, setPermModal] = useState<{
    projectName: string; displayName: string
  } | null>(null)
  const [permData, setPermData] = useState<ApiPermissions | null>(null)
  const [permLoading, setPermLoading] = useState(false)

  // 搜索状态
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ApiSearchResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Ctrl+K 聚焦搜索
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // 防抖搜索
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setSearchOpen(false); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try { const data = await fetchSearch(searchQuery.trim()); setSearchResults(data); setSearchOpen(true) }
      catch { setSearchResults([]) }
      finally { setSearching(false) }
    }, 250)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleSearchSelect = useCallback((r: ApiSearchResult, matchContent: string) => {
    const encodedName = getEncodedName(r.projectPath)
    onSelectSession(r.sessionId, encodedName, matchContent.slice(0, 80))
    setSearchOpen(false); setSearchQuery(''); setSearchResults([])
  }, [onSelectSession])

  const showToast = useCallback((msg: string) => {
    setToast(msg); setTimeout(() => setToast(null), 2000)
  }, [])

  // ============================================================
  // 操作
  // ============================================================

  const toggleProject = (name: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
    onSelectProject(name)
  }

  const toggleCollection = (id: string) => {
    setExpandedCollections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleAddToCollection = async (colId: string, session: ApiSession) => {
    try {
      await addSessionToCollection(colId, {
        projectPath: session.projectPath,
        projectName: session.projectName,
        sessionId: session.sessionId,
        sessionTitle: session.title,
      })
      onCollectionsChange()
      showToast('已添加')
    } catch (e: any) { showToast(e.message) }
  }

  const handleRemoveFromCollection = async (colId: string, refId: string) => {
    await removeSessionFromCollection(colId, refId)
    onCollectionsChange()
    showToast('已移除')
  }

  const handleCreateCollection = async () => {
    if (!newColName.trim()) return
    await createCollection(newColName.trim(), newColParentId)
    onCollectionsChange()
    setShowNewDialog(false); setNewColName(''); setNewColParentId(null)
  }

  const handleRename = async (id: string) => {
    if (!renameText.trim()) { setRenamingId(null); return }
    await updateCollection(id, { name: renameText.trim() })
    onCollectionsChange(); setRenamingId(null)
  }

  const handleDeleteCollection = async (col: ApiCollection) => {
    if (confirm(`删除「${col.name}」？`)) {
      await deleteCollection(col.id)
      onCollectionsChange()
    }
  }

  const handleViewMemory = async (project: ApiProject) => {
    setMemoryModal({ projectName: project.name, displayName: project.displayName })
    setMemoryLoading(true)
    setMemoryData([])
    try {
      const data = await fetchMemory(project.name)
      setMemoryData(data)
    } catch (e: any) { showToast(e.message) }
    finally { setMemoryLoading(false) }
  }

  const handleViewPermissions = async (project: ApiProject) => {
    setPermModal({ projectName: project.name, displayName: project.displayName })
    setPermLoading(true)
    setPermData(null)
    try {
      const data = await fetchPermissions(project.name)
      setPermData(data)
    } catch (e: any) { showToast(e.message) }
    finally { setPermLoading(false) }
  }

  const { roots, children } = buildCollectionTree(collections)

  // ============================================================
  // 渲染收藏夹节点（递归）
  // ============================================================
  const renderCollectionTree = (col: ApiCollection, depth = 0) => {
    const isOpen = expandedCollections.has(col.id)
    const subs = children(col.id)
    return (
      <div key={col.id}>
        <div
          className="flex items-center gap-2 py-2 px-3 cursor-pointer hover:bg-warm-hover rounded text-sm group"
          style={{ paddingLeft: 12 + depth * 14 }}
          onClick={() => toggleCollection(col.id)}
        >
          <svg className={`w-3 h-3 text-gray-500 flex-shrink-0 transition ${isOpen ? 'rotate-90' : ''}`}
            fill="currentColor" viewBox="0 0 20 20">
            <path d="M7.293 4.707L14.586 12l-7.293 7.293 1.414 1.414L17.414 12 8.707 3.293 7.293 4.707z" />
          </svg>
          <span className="text-amber-400 text-xs">⭐</span>
          <span className="flex-1 truncate text-warm-text">{col.name}</span>
          <span className="text-xs text-gray-500 opacity-0 group-hover:opacity-100">{col.sessions.length}</span>
        </div>
        {isOpen && subs.map(s => renderCollectionTree(s, depth + 1))}
        {isOpen && col.sessions.map(ref => (
          <div
            key={ref.id}
            className={`flex items-center gap-1 py-1 text-xs cursor-pointer hover:bg-warm-hover rounded group
              ${selectedSession === ref.sessionId ? 'bg-warm-active' : ''}`}
            style={{ paddingLeft: 28 + (depth + 1) * 14 }}
            onClick={() => onSelectSession(ref.sessionId, getEncodedName(ref.projectPath))}
          >
            <span className="flex-1 truncate text-warm-text">{ref.sessionTitle || ref.sessionId.slice(0, 8)}</span>
            <button
              className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 px-1"
              onClick={e => { e.stopPropagation(); handleRemoveFromCollection(col.id, ref.id) }}
            >×</button>
          </div>
        ))}
      </div>
    )
  }

  // ============================================================
  // 会话列表项
  // ============================================================
  const SessionItem = ({ session }: { session: ApiSession }) => {
    const [menuOpen, setMenuOpen] = useState(false)
    const isSelected = selectedSession === session.sessionId

    return (
      <div
        className="group relative flex items-center gap-2 px-4 cursor-pointer rounded text-[17px] hover:bg-warm-hover"
        style={{ paddingTop: '7px', paddingBottom: '7px' }}
        onClick={() => onSelectSession(session.sessionId, getEncodedName(session.projectPath))}
      >
        <span className="flex-1 truncate text-warm-text leading-snug">{session.title}</span>
        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{formatDate(session.timestamp)}</span>
        <div className="relative">
          <button
            className="text-gray-500 hover:text-warm-text opacity-0 group-hover:opacity-100 px-0.5"
            onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
          >···</button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-6 z-50 bg-warm-active border border-warm-border rounded-lg shadow-xl py-1 min-w-[140px]">
                {collections.map(c => (
                  <button key={c.id}
                    className="w-full text-left px-3 py-2 text-sm text-warm-text hover:bg-warm-hover"
                    onClick={e => { e.stopPropagation(); handleAddToCollection(c.id, session); setMenuOpen(false) }}
                  >⭐ {c.name}</button>
                ))}
                <div className="border-t border-warm-border my-0.5" />
                <button
                  className="w-full text-left px-3 py-2 text-sm text-warm-text hover:bg-warm-hover"
                  onClick={e => { e.stopPropagation(); setNewColParentId(null); setNewColName(session.title.slice(0, 30)); setShowNewDialog(true); setMenuOpen(false) }}
                >+ 新建收藏夹</button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ============================================================
  // 渲染
  // ============================================================
  const sideClass = "bg-warm-sidebar border-r border-warm-border flex flex-col select-none z-20"

  // 收藏夹视图
  if (viewMode === 'collections') {
    return (
      <aside className={sideClass} style={{ position: 'fixed', left: 0, top: 0, bottom: 0, width: '360px', paddingLeft: '22px', paddingRight: '12px' }}>
        {/* Logo */}
        <div style={{ padding: '16px', borderBottom: '1px solid #e8e2d8' }}>
          <span style={{
            fontSize: '22px',
            fontWeight: 800,
            letterSpacing: '0.12em',
            fontFamily: "'Segoe UI', 'Microsoft YaHei', sans-serif",
            color: '#c46b4a',
          }}>MY_CC</span>
        </div>

        {/* 搜索 */}
        <div style={{ padding: '8px 16px', position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#8c8580' }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input ref={searchInputRef} type="text" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setSearchOpen(true) }}
              placeholder="搜索… Ctrl+K"
              style={{ width: '100%', height: '32px', paddingLeft: '30px', paddingRight: '10px',
                borderRadius: '8px', border: '1px solid #e8e2d8', background: '#ffffff',
                fontSize: '13px', color: '#1a1a1a', outline: 'none' }} />
          </div>
          {searchOpen && (
            <div style={{ position: 'absolute', top: '100%', left: '16px', right: '16px', zIndex: 60,
              background: '#ffffff', borderRadius: '10px', border: '1px solid #e8e2d8',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)', maxHeight: '360px', overflowY: 'auto' }}>
              <div style={{ padding: '8px 12px', fontSize: '11px', color: '#8c8580', borderBottom: '1px solid #e8e2d8' }}>
                {searching ? '搜索中…' : `${searchResults.length} 个会话`}
              </div>
              {searchResults.length === 0 && !searching && (
                <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: '13px', color: '#8c8580' }}>无匹配</div>
              )}
              {searchResults.map(r => (
                <div key={r.sessionId + r.projectPath}>
                  <div style={{ padding: '4px 12px', fontSize: '11px', color: '#8c8580', background: '#faf8f5' }}>
                    {r.projectName}
                  </div>
                  {r.matches.slice(0, 3).map((m, i) => (
                    <div key={i} onClick={() => handleSearchSelect(r, m.content)}
                      style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', lineHeight: 1.5,
                        color: '#1a1a1a', borderBottom: '1px solid #f5f1ea' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#faf8f5')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span style={{ fontSize: '10px', color: '#8c8580', marginRight: '6px' }}>{m.matchType}</span>
                      {m.content.slice(0, 100)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          {searchOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 55 }} onClick={() => setSearchOpen(false)} />}
        </div>

        {/* 导航 */}
        <div className="px-4 py-3 space-y-1">
          <button
            className="w-full text-left px-3 rounded text-sm text-gray-500 hover:bg-warm-hover"
            style={{ paddingTop: '7px', paddingBottom: '7px' }}
            onClick={() => onViewModeChange('projects')}
          >💬 对话</button>
          <button
            className="w-full text-left px-4 rounded text-[15px] text-warm-text bg-warm-active"
            style={{ paddingTop: '7px', paddingBottom: '7px' }}
            onClick={() => onViewModeChange('collections')}
          >⭐ 收藏夹</button>
        </div>

        {/* 收藏夹列表 */}
        <div className="flex-1 overflow-y-auto px-4 py-1">
          <p className="text-sm text-gray-500 px-3 py-2.5 uppercase tracking-wider">Starred</p>
          {roots.length === 0 && (
            <p className="text-sm text-gray-500 px-3 py-2">暂无收藏夹</p>
          )}
          {roots.map(root => renderCollectionTree(root))}
        </div>

        {/* 底部 */}
        <div className="px-4 py-2 border-t border-warm-border">
          <button
            className="w-full text-left text-xs text-gray-500 hover:text-warm-text py-1"
            onClick={() => { setNewColParentId(null); setNewColName(''); setShowNewDialog(true) }}
          >+ 新建收藏夹</button>
        </div>

        {toast && <div className="fixed bottom-4 right-4 bg-warm-active text-warm-text px-3 py-2 rounded-lg text-sm z-50 shadow-lg">{toast}</div>}

        {/* 新建对话框 */}
        {showNewDialog && (
          <>
            <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setShowNewDialog(false)} />
            <div className="fixed inset-0 flex items-center justify-center z-50" onClick={() => setShowNewDialog(false)}>
              <div className="bg-white rounded-xl shadow-xl p-4 w-80" onClick={e => e.stopPropagation()}>
                <h3 className="font-semibold text-gray-900 mb-3">
                  {newColParentId ? '新建子收藏夹' : '新建收藏夹'}
                </h3>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-warm-accent mb-3"
                  placeholder="名称" value={newColName}
                  onChange={e => setNewColName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateCollection(); if (e.key === 'Escape') setShowNewDialog(false) }}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg" onClick={() => setShowNewDialog(false)}>取消</button>
                  <button className="px-3 py-1.5 text-sm bg-warm-accent text-white rounded-lg hover:bg-warm-accent disabled:opacity-50" onClick={handleCreateCollection} disabled={!newColName.trim()}>创建</button>
                </div>
              </div>
            </div>
          </>
        )}
      </aside>
    )
  }

  // ============================================================
  // 项目视图（默认）
  // ============================================================
  return (
    <aside className={sideClass} style={{ position: 'fixed', left: 0, top: 0, bottom: 0, width: '360px', paddingLeft: '22px', paddingRight: '12px' }}>
      {/* Logo */}
      <div style={{ padding: '16px', borderBottom: '1px solid #e8e2d8' }}>
        <span style={{
          fontSize: '22px',
          fontWeight: 800,
          letterSpacing: '0.12em',
          fontFamily: "'Segoe UI', 'Microsoft YaHei', sans-serif",
          color: '#c46b4a',
        }}>MY_CC</span>
      </div>

      {/* 搜索 */}
      <div style={{ padding: '8px 16px', position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#8c8580' }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input ref={searchInputRef} type="text" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setSearchOpen(true) }}
            placeholder="搜索… Ctrl+K"
            style={{ width: '100%', height: '32px', paddingLeft: '30px', paddingRight: '10px',
              borderRadius: '8px', border: '1px solid #e8e2d8', background: '#ffffff',
              fontSize: '13px', color: '#1a1a1a', outline: 'none' }} />
        </div>
        {searchOpen && (
          <div style={{ position: 'absolute', top: '100%', left: '16px', right: '16px', zIndex: 60,
            background: '#ffffff', borderRadius: '10px', border: '1px solid #e8e2d8',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)', maxHeight: '360px', overflowY: 'auto' }}>
            <div style={{ padding: '8px 12px', fontSize: '11px', color: '#8c8580', borderBottom: '1px solid #e8e2d8' }}>
              {searching ? '搜索中…' : `${searchResults.length} 个会话`}
            </div>
            {searchResults.length === 0 && !searching && (
              <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: '13px', color: '#8c8580' }}>无匹配</div>
            )}
            {searchResults.map(r => (
              <div key={r.sessionId + r.projectPath}>
                <div style={{ padding: '4px 12px', fontSize: '11px', color: '#8c8580', background: '#faf8f5' }}>
                  {r.projectName}
                </div>
                {r.matches.slice(0, 3).map((m, i) => (
                  <div key={i} onClick={() => handleSearchSelect(r, m.content)}
                    style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', lineHeight: 1.5,
                      color: '#1a1a1a', borderBottom: '1px solid #f5f1ea' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#faf8f5')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <span style={{ fontSize: '10px', color: '#8c8580', marginRight: '6px' }}>{m.matchType}</span>
                    {m.content.slice(0, 100)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {searchOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 55 }} onClick={() => setSearchOpen(false)} />}
      </div>

      {/* 导航 */}
      <div className="px-4 py-3 space-y-1">
        <button
          className="w-full text-left px-4 rounded text-[15px] text-warm-text bg-warm-active"
          style={{ paddingTop: '7px', paddingBottom: '7px' }}
          onClick={() => onViewModeChange('projects')}
        >💬 对话</button>
        <button
          className="w-full text-left px-3 rounded text-sm text-gray-500 hover:bg-warm-hover"
          style={{ paddingTop: '7px', paddingBottom: '7px' }}
          onClick={() => onViewModeChange('collections')}
        >⭐ 收藏夹</button>
      </div>

      {/* 项目列表 */}
      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <p className="text-xs text-gray-500 px-4 py-4">扫描中...</p>
        ) : (
          [...projects].sort((a, b) => {
            const aPin = pinnedProjects.has(a.name) ? 1 : 0
            const bPin = pinnedProjects.has(b.name) ? 1 : 0
            if (aPin !== bPin) return bPin - aPin
            return b.lastActivity - a.lastActivity
          }).map(project => {
            const isOpen = expandedProjects.has(project.name)
            const isActive = selectedProject === project.name
            return (
              <div key={project.name}>
                {/* 项目标题 — 作为分区 */}
                <div className={`group flex items-center rounded transition ${isActive ? 'bg-warm-active' : 'hover:bg-warm-hover'}`}>
                  <button
                    className={`flex-1 flex items-center gap-2 pl-6 text-base uppercase tracking-wider font-medium text-left ${isActive ? 'text-warm-text' : 'text-gray-500 hover:text-warm-text'}`}
                    style={{ paddingTop: '7px', paddingBottom: '7px' }}
                    onClick={() => toggleProject(project.name)}
                  >
                    <svg className={`w-2.5 h-2.5 transition flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7.293 4.707L14.586 12l-7.293 7.293 1.414 1.414L17.414 12 8.707 3.293 7.293 4.707z" />
                    </svg>
                    <span className="truncate">{project.displayName}</span>
                    {pinnedProjects.has(project.name) && (
                      <span style={{ fontSize: '10px', color: '#c46b4a', marginLeft: '4px' }}>📌</span>
                    )}
                  </button>
                  {/* 三点菜单 */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                      onClick={e => { e.stopPropagation(); setProjectMenuOpen(projectMenuOpen === project.name ? null : project.name) }}
                      style={{ padding: '7px 10px', color: '#8c8580', fontSize: '16px', opacity: projectMenuOpen === project.name ? 1 : undefined }}
                      className="opacity-0 group-hover:opacity-100 hover:text-warm-text"
                    >···</button>
                    {projectMenuOpen === project.name && (
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setProjectMenuOpen(null)} />
                        <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 50, background: '#fff', borderRadius: '10px', border: '1px solid #e8e2d8', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', minWidth: '150px', padding: '4px' }}>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setPinnedProjects(prev => {
                                const next = new Set(prev)
                                prev.has(project.name) ? next.delete(project.name) : next.add(project.name)
                                return next
                              })
                              setProjectMenuOpen(null)
                            }}
                            style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '13px', color: '#1a1a1a', borderRadius: '6px', border: 'none', background: 'none', cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f5f1ea')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                          >
                            {pinnedProjects.has(project.name) ? '📌 取消置顶' : '📌 置顶该项目'}
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              navigator.clipboard.writeText(project.realPath || project.path).then(() => showToast('已复制项目路径'))
                              setProjectMenuOpen(null)
                            }}
                            style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '13px', color: '#1a1a1a', borderRadius: '6px', border: 'none', background: 'none', cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f5f1ea')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                          >
                            📋 复制项目地址
                          </button>
                          <div style={{ height: '1px', background: '#e8e2d8', margin: '4px 0' }} />
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setProjectMenuOpen(null)
                              handleViewMemory(project)
                            }}
                            style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '13px', color: '#1a1a1a', borderRadius: '6px', border: 'none', background: 'none', cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f5f1ea')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                          >
                            🧠 查看记忆
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setProjectMenuOpen(null)
                              handleViewPermissions(project)
                            }}
                            style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '13px', color: '#1a1a1a', borderRadius: '6px', border: 'none', background: 'none', cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f5f1ea')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                          >
                            🔒 查看权限
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {/* 会话列表 */}
                {isOpen && (
                  <div className="border-l border-warm-border" style={{ marginLeft: '32px', paddingLeft: '18px' }}>
                    {!sessionsMap[project.name] && <p className="text-xs text-gray-500 px-3 py-2">加载中...</p>}
                    {sessionsMap[project.name]?.map(s => <SessionItem key={s.sessionId} session={s} />)}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* 底部 */}
      <div className="px-4 py-2 border-t border-warm-border text-xs text-gray-500">
        {projects.length} 个项目
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-warm-active text-warm-text px-3 py-2 rounded-lg text-sm z-50 shadow-lg">
          {toast}
        </div>
      )}

      {/* 新建收藏夹对话框 */}
      {showNewDialog && (
        <>
          <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setShowNewDialog(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50" onClick={() => setShowNewDialog(false)}>
            <div className="bg-white rounded-xl shadow-xl p-4 w-80" onClick={e => e.stopPropagation()}>
              <h3 className="font-semibold text-gray-900 mb-3">
                {newColParentId ? '新建子收藏夹' : '新建收藏夹'}
              </h3>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-warm-accent mb-3"
                placeholder="名称" value={newColName}
                onChange={e => setNewColName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateCollection(); if (e.key === 'Escape') setShowNewDialog(false) }}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg" onClick={() => setShowNewDialog(false)}>取消</button>
                <button className="px-3 py-1.5 text-sm bg-warm-accent text-white rounded-lg hover:bg-warm-accent disabled:opacity-50" onClick={handleCreateCollection} disabled={!newColName.trim()}>创建</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 记忆弹窗 */}
      {memoryModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setMemoryModal(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50" onClick={() => setMemoryModal(null)}>
            <div className="bg-white rounded-xl shadow-xl w-[560px] max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8e2d8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a' }}>🧠 {memoryModal.displayName} — 记忆</h3>
                <button onClick={() => setMemoryModal(null)}
                  style={{ color: '#8c8580', fontSize: '20px', border: 'none', background: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
                {memoryLoading ? (
                  <p style={{ textAlign: 'center', color: '#8c8580', padding: '32px 0' }}>加载中…</p>
                ) : memoryData.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#8c8580', padding: '32px 0' }}>该项目暂无记忆</p>
                ) : (
                  memoryData.map((mem, i) => (
                    <details key={i} style={{ marginBottom: '12px', border: '1px solid #e8e2d8', borderRadius: '10px', overflow: 'hidden' }}>
                      <summary style={{ padding: '12px 16px', cursor: 'pointer', background: '#faf8f5', fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}>
                        {mem.frontmatter.name || mem.fileName}
                        {mem.frontmatter.metadata?.type && (
                          <span style={{
                            marginLeft: '8px', fontSize: '11px', padding: '1px 6px', borderRadius: '4px',
                            background: mem.frontmatter.metadata.type === 'user' ? '#fef3c7' : '#e0f2fe',
                            color: mem.frontmatter.metadata.type === 'user' ? '#92400e' : '#075985',
                          }}>{mem.frontmatter.metadata.type}</span>
                        )}
                      </summary>
                      <div style={{ padding: '12px 16px', fontSize: '13px', lineHeight: 1.7, color: '#1a1a1a' }}>
                        {mem.frontmatter.description && (
                          <p style={{ color: '#8c8580', marginBottom: '8px', fontSize: '12px' }}>{mem.frontmatter.description}</p>
                        )}
                        <div style={{ whiteSpace: 'pre-wrap' }}>{mem.body}</div>
                      </div>
                    </details>
                  ))
                )}
              </div>
              <div style={{ padding: '12px 20px', borderTop: '1px solid #e8e2d8', textAlign: 'right' }}>
                <button onClick={() => setMemoryModal(null)}
                  style={{ padding: '6px 16px', fontSize: '13px', color: '#8c8580', background: '#f5f1ea', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>关闭</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 权限弹窗 */}
      {permModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setPermModal(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50" onClick={() => setPermModal(null)}>
            <div className="bg-white rounded-xl shadow-xl w-[600px] max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8e2d8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a' }}>🔒 {permModal.displayName} — 权限</h3>
                <button onClick={() => setPermModal(null)}
                  style={{ color: '#8c8580', fontSize: '20px', border: 'none', background: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
                {permLoading ? (
                  <p style={{ textAlign: 'center', color: '#8c8580', padding: '32px 0' }}>加载中…</p>
                ) : !permData ? (
                  <p style={{ textAlign: 'center', color: '#8c8580', padding: '32px 0' }}>加载失败</p>
                ) : !permData.permissions ? (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <p style={{ color: '#8c8580', marginBottom: '8px' }}>{permData.message || '该项目无本地权限配置'}</p>
                    {permData.projectPath && (
                      <p style={{ fontSize: '12px', color: '#b0a89f' }}>
                        项目路径：{permData.projectPath}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    {permData.projectPath && (
                      <p style={{ fontSize: '12px', color: '#b0a89f', marginBottom: '12px' }}>
                        项目路径：{permData.projectPath}
                      </p>
                    )}
                    {permData.permissions.allow && permData.permissions.allow.length > 0 && (
                      <div style={{ marginBottom: '12px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#22c55e', marginBottom: '6px' }}>
                          ✅ 已允许 ({permData.permissions.allow.length})
                        </h4>
                        <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '8px 12px', maxHeight: '200px', overflowY: 'auto' }}>
                          {permData.permissions.allow.map((item, i) => (
                            <div key={i} style={{ fontSize: '12px', fontFamily: 'monospace', color: '#1a1a1a', padding: '2px 0', borderBottom: '1px solid #dcfce7' }}>
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {permData.permissions.deny && permData.permissions.deny.length > 0 && (
                      <div>
                        <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#ef4444', marginBottom: '6px' }}>
                          ❌ 已拒绝 ({permData.permissions.deny.length})
                        </h4>
                        <div style={{ background: '#fef2f2', borderRadius: '8px', padding: '8px 12px', maxHeight: '200px', overflowY: 'auto' }}>
                          {permData.permissions.deny.map((item, i) => (
                            <div key={i} style={{ fontSize: '12px', fontFamily: 'monospace', color: '#1a1a1a', padding: '2px 0', borderBottom: '1px solid #fee2e2' }}>
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div style={{ padding: '12px 20px', borderTop: '1px solid #e8e2d8', textAlign: 'right' }}>
                <button onClick={() => setPermModal(null)}
                  style={{ padding: '6px 16px', fontSize: '13px', color: '#8c8580', background: '#f5f1ea', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>关闭</button>
              </div>
            </div>
          </div>
        </>
      )}
    </aside>
  )
}

export default Sidebar
