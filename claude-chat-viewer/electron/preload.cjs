const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('api', {
  // 数据就绪检查
  ping: () => 'pong',

  // 获取所有项目列表
  getProjects: () => ipcRenderer.invoke('get-projects'),

  // 获取某项目的会话列表
  getSessions: (projectPath) => ipcRenderer.invoke('get-sessions', projectPath),

  // 获取某个会话的完整转录
  getTranscript: (projectPath, sessionId) =>
    ipcRenderer.invoke('get-transcript', projectPath, sessionId),

  // 搜索
  search: (query, options) => ipcRenderer.invoke('search', query, options),
});
