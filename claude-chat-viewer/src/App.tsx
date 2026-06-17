import { useState, useEffect, useCallback, useRef } from 'react'
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'
import ChatView from './components/chat/ChatView'
import { fetchProjects, fetchSessions, fetchTranscript, fetchCollections } from './utils/api'
import type { ApiProject, ApiSession, ApiTranscript, ApiCollection } from './utils/api'

export type ViewMode = 'projects' | 'collections'

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('projects')
  const [projects, setProjects] = useState<ApiProject[]>([])
  const [collections, setCollections] = useState<ApiCollection[]>([])
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [sessionsMap, setSessionsMap] = useState<Record<string, ApiSession[]>>({})
  const loadingRef = useRef<Set<string>>(new Set())
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<ApiTranscript | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchHighlight, setSearchHighlight] = useState<string | null>(null)

  useEffect(() => {
    fetchProjects().then(setProjects).catch(err => setError(err.message))
  }, [])

  const loadCollections = useCallback(() => {
    fetchCollections().then(setCollections).catch(() => {})
  }, [])
  useEffect(() => { loadCollections() }, [loadCollections])

  const handleSelectProject = useCallback(async (projectName: string) => {
    setSelectedProject(projectName)
    setSelectedSession(null)
    setTranscript(null)
    setError(null)
    loadingRef.current.add(projectName)
    try {
      const data = await fetchSessions(projectName)
      setSessionsMap(prev => ({ ...prev, [projectName]: data }))
    } catch (err: any) {
      setError(err.message)
    }
  }, [])

  const handleSelectSession = useCallback(async (
    sessionId: string,
    projectName?: string,
    highlight?: string
  ) => {
    const project = projectName || selectedProject
    if (!project) return
    setSelectedSession(sessionId)
    setSelectedProject(project)
    setLoading(true)
    setError(null)
    setSearchHighlight(highlight || null)
    try {
      // 用 ref 防竞态：只在首次加载该项目时 fetch sessions
      if (!loadingRef.current.has(project)) {
        loadingRef.current.add(project)
        const data = await fetchSessions(project)
        setSessionsMap(prev => ({ ...prev, [project]: data }))
      }
      const data = await fetchTranscript(project, sessionId)
      setTranscript(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedProject])

  return (
    <div className="flex h-screen bg-warm-bg">
      {/* 侧边栏：固定浮层 */}
      <Sidebar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        projects={projects}
        collections={collections}
        sessionsMap={sessionsMap}
        selectedProject={selectedProject}
        selectedSession={selectedSession}
        onSelectProject={handleSelectProject}
        onSelectSession={handleSelectSession}
        onCollectionsChange={loadCollections}
      />

      {/* 主区域：占满整个窗口，内容在窗口级别居中 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: '430px' }}>
        <TopBar />
        {error && (
          <div className="bg-red-50 border-b border-red-200 text-red-700 px-4 py-2 text-sm">
            {error}
            <button className="ml-2 underline" onClick={() => setError(null)}>关闭</button>
          </div>
        )}
        <ChatView transcript={transcript} loading={loading} searchHighlight={searchHighlight} />
      </div>
    </div>
  )
}

export default App
