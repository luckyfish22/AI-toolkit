const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const os = require('os');

const storage = require('./storage');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ============================================================
// 工具函数
// ============================================================

/** 获取 .claude 目录路径 */
function getClaudeDir() {
  return path.join(os.homedir(), '.claude');
}

// 缓存：从 history.jsonl 读取真实项目路径，用于显示名称
let projectPathMap = null;

/** 从 history.jsonl 构建 编码目录名 → 真实路径 的映射 */
function buildProjectPathMap() {
  if (projectPathMap) return projectPathMap;
  projectPathMap = new Map();
  const historyPath = path.join(getClaudeDir(), 'history.jsonl');
  if (!fs.existsSync(historyPath)) return projectPathMap;

  const content = fs.readFileSync(historyPath, 'utf-8');
  const lines = content.split('\n');
  const seen = new Set();

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.project && !seen.has(entry.project)) {
        seen.add(entry.project);
        // 将真实路径编码为目录名格式
        const encoded = encodeProjectPath(entry.project);
        if (!projectPathMap.has(encoded)) {
          projectPathMap.set(encoded, entry.project);
        }
      }
    } catch (e) { /* skip */ }
  }
  return projectPathMap;
}

/** 将真实路径编码为 .claude/projects/ 目录名 */
function encodeProjectPath(realPath) {
  // D:\AAA_study\my_cc\my_test -> D--AAA-study-my-cc-my-test
  // 规则: D:\ -> D--, 其余 \ 和 _ -> -
  return realPath
    .replace(/^([A-Za-z]):\\/, (_, d) => d.toUpperCase() + '--')
    .replace(/\\/g, '-')
    .replace(/_/g, '-');
}

/** 获取项目的真实工作目录路径 */
function getRealPath(encodedDirName) {
  const map = buildProjectPathMap();
  // 1. 精确匹配
  let realPath = map.get(encodedDirName);
  // 2. 忽略大小写匹配
  if (!realPath) {
    for (const [key, val] of map) {
      if (key.toLowerCase() === encodedDirName.toLowerCase()) {
        realPath = val;
        break;
      }
    }
  }
  // 3. 从项目目录的第一个转录文件中读取 cwd
  if (!realPath) {
    try {
      const projectsDir = path.join(getClaudeDir(), 'projects');
      const projectDir = path.join(projectsDir, encodedDirName);
      if (fs.existsSync(projectDir)) {
        const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
        for (const f of files) {
          const filePath = path.join(projectDir, f);
          const head = fs.readFileSync(filePath, { encoding: 'utf-8' }).split('\n').slice(0, 20);
          for (const line of head) {
            if (!line.trim()) continue;
            try {
              const entry = JSON.parse(line);
              if (entry.cwd) {
                realPath = entry.cwd;
                break;
              }
            } catch (e) { /* continue */ }
          }
          if (realPath) break;
        }
      }
    } catch (e) { /* 忽略 */ }
  }
  return realPath || '';
}

/** 获取项目的可读显示名称 */
function getDisplayName(encodedDirName) {
  const map = buildProjectPathMap();
  // 1. 精确匹配
  let realPath = map.get(encodedDirName);
  // 2. 忽略大小写匹配
  if (!realPath) {
    for (const [key, val] of map) {
      if (key.toLowerCase() === encodedDirName.toLowerCase()) {
        realPath = val;
        break;
      }
    }
  }
  if (realPath) {
    const segments = realPath.split('\\').filter(Boolean);
    return segments[segments.length - 1] || realPath;
  }
  // 3. 从项目目录的第一个转录文件中读取 cwd
  try {
    const projectsDir = path.join(getClaudeDir(), 'projects');
    const projectDir = path.join(projectsDir, encodedDirName);
    if (fs.existsSync(projectDir)) {
      const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
      if (files.length > 0) {
        const firstFile = path.join(projectDir, files[0]);
        const head = fs.readFileSync(firstFile, { encoding: 'utf-8' }).split('\n').slice(0, 10);
        for (const line of head) {
          if (!line.trim()) continue;
          try {
            const entry = JSON.parse(line);
            if (entry.cwd) {
              const segments = entry.cwd.split('\\').filter(Boolean);
              return segments[segments.length - 1] || entry.cwd;
            }
          } catch (e) { /* continue */ }
        }
      }
    }
  } catch (e) { /* 忽略 */ }

  // 4. 最终后备：从编码目录名提取
  const noDrive = encodedDirName.replace(/^[A-Za-z]--/, '');
  const parts = noDrive.split('-').filter(p => p.length > 0 && p.length < 30);
  const tail = parts.slice(-2);
  return tail.join('_') || encodedDirName;
}

/** 流式解析 JSONL 文件 */
async function parseJSONL(filePath) {
  const entries = [];
  if (!fs.existsSync(filePath)) return entries;

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch (e) {
      // 跳过损坏的行（向前兼容）
    }
  }
  return entries;
}

// ============================================================
// API 路由
// ============================================================

/** GET /api/projects — 获取所有项目列表 */
app.get('/api/projects', (req, res) => {
  try {
    const claudeDir = getClaudeDir();
    const projectsDir = path.join(claudeDir, 'projects');
    const projects = [];

    if (!fs.existsSync(projectsDir)) {
      return res.json({ projects: [] });
    }

    const dirs = fs.readdirSync(projectsDir, { withFileTypes: true });
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;

      // 统计 .jsonl 文件数量和最新时间
      const projectPath = path.join(projectsDir, dir.name);
      const files = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));
      let latestTime = 0;
      for (const f of files) {
        const stat = fs.statSync(path.join(projectPath, f));
        if (stat.mtimeMs > latestTime) latestTime = stat.mtimeMs;
      }

      projects.push({
        name: dir.name,
        path: projectPath,
        displayName: getDisplayName(dir.name),
        realPath: getRealPath(dir.name),
        sessionCount: files.length,
        lastActivity: latestTime,
      });
    }

    // 按最后活动时间倒序
    projects.sort((a, b) => b.lastActivity - a.lastActivity);
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/sessions/:projectName — 获取某项目的会话列表 */
app.get('/api/sessions/:projectName', async (req, res) => {
  try {
    const claudeDir = getClaudeDir();
    const projectPath = path.join(claudeDir, 'projects', req.params.projectName);
    const sessions = [];

    if (!fs.existsSync(projectPath)) {
      return res.json({ sessions: [] });
    }

    const files = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl') && !f.includes('journal'));
    for (const file of files) {
      const filePath = path.join(projectPath, file);
      const sessionId = file.replace('.jsonl', '');
      const stat = fs.statSync(filePath);

      // 读取前几条获取标题
      let title = sessionId.slice(0, 8) + '...';
      let messageCount = 0;
      const entries = [];
      const rl = readline.createInterface({
        input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
        crlfDelay: Infinity,
      });

      for await (const line of rl) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          entries.push(entry);
          messageCount++;

          // 检查 ai-title
          if (entry.type === 'ai-title' && entry.aiTitle) {
            title = entry.aiTitle;
          }
          // 取第一个用户消息作为后备标题
          if (!title.startsWith(sessionId.slice(0, 8)) && entry.type === 'user' && title === sessionId.slice(0, 8) + '...') {
            const content = typeof entry.message?.content === 'string'
              ? entry.message.content
              : '';
            if (content && !content.includes('<local-command')) {
              title = content.slice(0, 60);
            }
          }
        } catch (e) { /* skip */ }
        if (entries.length >= 20) break; // 只看前 20 行找标题
      }

      sessions.push({
        sessionId,
        title,
        timestamp: stat.mtimeMs,
        messageCount,
        projectPath,
        projectName: getDisplayName(req.params.projectName),
        cwd: entries.find(e => e.cwd)?.cwd || '',
        entrypoint: entries.find(e => e.entrypoint)?.entrypoint || '',
        version: entries.find(e => e.version)?.version || '',
      });
    }

    // 按时间倒序
    sessions.sort((a, b) => b.timestamp - a.timestamp);
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/transcript/:projectName/:sessionId — 获取完整转录 */
app.get('/api/transcript/:projectName/:sessionId', async (req, res) => {
  try {
    const claudeDir = getClaudeDir();
    const filePath = path.join(
      claudeDir, 'projects', req.params.projectName,
      req.params.sessionId + '.jsonl'
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    const entries = await parseJSONL(filePath);

    // 提取会话元数据
    let title = req.params.sessionId.slice(0, 8) + '...';
    let model = '';
    let startTime = '';
    let endTime = '';
    let cwd = '';
    let version = '';

    for (const entry of entries) {
      if (entry.type === 'ai-title' && entry.aiTitle) {
        title = entry.aiTitle;
      }
      if (entry.message?.model) model = entry.message.model;
      if (entry.cwd) cwd = entry.cwd;
      if (entry.version) version = entry.version;
      if (entry.timestamp) {
        if (!startTime) startTime = entry.timestamp;
        endTime = entry.timestamp;
      }
    }

    res.json({
      entries,
      sessionMeta: {
        sessionId: req.params.sessionId,
        title,
        model,
        startTime,
        endTime,
        messageCount: entries.length,
        cwd,
        version,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/search?q=keyword — 全文搜索 */
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.json({ results: [] });

    const claudeDir = getClaudeDir();
    const projectsDir = path.join(claudeDir, 'projects');
    const results = [];

    if (!fs.existsSync(projectsDir)) {
      return res.json({ results: [] });
    }

    const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter(d => d.isDirectory());

    for (const projectDir of projectDirs) {
      const projectPath = path.join(projectsDir, projectDir.name);
      const files = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl') && !f.includes('journal'));

      for (const file of files) {
        const filePath = path.join(projectPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const matches = [];

        for (let i = 0; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          try {
            const entry = JSON.parse(lines[i]);
            // 只搜索用户消息和 AI 回复
            if (entry.type !== 'user' && entry.type !== 'assistant') continue;
            // 提取纯文字内容
            let textContent;
            if (typeof entry.message?.content === 'string') {
              textContent = entry.message.content;
            } else if (Array.isArray(entry.message?.content)) {
              textContent = entry.message.content
                .filter(b => b.type === 'text' && b.text)
                .map(b => b.text).join(' ');
            }
            if (!textContent || !textContent.toLowerCase().includes(query.toLowerCase())) continue;
            matches.push({
              lineNumber: i + 1,
              context: textContent.slice(0, 200),
              matchType: entry.type || 'unknown',
              content: textContent,
            });
          } catch (e) {
            // 跳过无法解析的行
          }
          if (matches.length >= 10) break; // 每个会话最多 10 个匹配
        }

        if (matches.length > 0) {
          results.push({
            sessionId: file.replace('.jsonl', ''),
            projectPath,
            projectName: getDisplayName(projectDir.name),
            sessionTitle: '', // 由前端补充
            timestamp: fs.statSync(filePath).mtimeMs,
            matches,
          });
        }
      }
    }

    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 记忆 API
// ============================================================

/** GET /api/memory/:projectName — 获取项目记忆文件 */
app.get('/api/memory/:projectName', (req, res) => {
  try {
    const claudeDir = getClaudeDir();
    const memoryDir = path.join(claudeDir, 'projects', req.params.projectName, 'memory');
    const memories = [];

    if (!fs.existsSync(memoryDir)) {
      return res.json({ memories });
    }

    const files = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md') && f !== 'MEMORY.md');
    for (const file of files) {
      const filePath = path.join(memoryDir, file);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = parseMemoryFile(raw);
      memories.push({
        fileName: file,
        ...parsed,
      });
    }

    res.json({ memories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** 解析记忆文件的 YAML frontmatter + Markdown body */
function parseMemoryFile(raw) {
  const result = { frontmatter: {}, body: '' };
  if (!raw.startsWith('---')) {
    result.body = raw;
    return result;
  }
  const secondDelim = raw.indexOf('---', 3);
  if (secondDelim === -1) {
    result.body = raw;
    return result;
  }
  const fmBlock = raw.slice(3, secondDelim).trim();
  result.body = raw.slice(secondDelim + 3).trim();

  // 简单 YAML 解析（支持 name, description, metadata 嵌套）
  let currentKey = '';
  const lines = fmBlock.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const indent = line.search(/\S/);
    const trimmed = line.trim();
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();

    if (indent === 0) {
      currentKey = key;
      if (value) {
        result.frontmatter[key] = value;
      } else {
        result.frontmatter[key] = {};
      }
    } else if (currentKey) {
      // 嵌套值
      if (typeof result.frontmatter[currentKey] === 'object') {
        result.frontmatter[currentKey][key] = value;
      }
    }
  }
  return result;
}

// ============================================================
// 权限 API
// ============================================================

/** GET /api/permissions/:projectName — 获取项目权限配置 */
app.get('/api/permissions/:projectName', (req, res) => {
  try {
    const realPath = getRealPath(req.params.projectName);

    if (!realPath) {
      return res.json({ permissions: null, message: '无法确定项目路径' });
    }

    const settingsPath = path.join(realPath, '.claude', 'settings.local.json');
    if (!fs.existsSync(settingsPath)) {
      return res.json({ permissions: null, message: '该项目无本地权限配置' });
    }

    const raw = fs.readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(raw);
    res.json({
      permissions: settings.permissions || null,
      projectPath: realPath,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 收藏夹 API
// ============================================================

/** GET /api/collections — 获取所有收藏夹 */
app.get('/api/collections', (req, res) => {
  try {
    const collections = storage.getCollections();
    res.json({ collections });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/collections — 创建收藏夹 */
app.post('/api/collections', (req, res) => {
  try {
    const { name, parentId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: '名称不能为空' });
    }
    const col = storage.createCollection(name.trim(), parentId || null);
    res.json(col);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/collections/:id — 更新收藏夹 */
app.put('/api/collections/:id', (req, res) => {
  try {
    const col = storage.updateCollection(req.params.id, req.body);
    if (!col) return res.status(404).json({ error: '收藏夹不存在' });
    res.json(col);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/collections/:id — 删除收藏夹 */
app.delete('/api/collections/:id', (req, res) => {
  try {
    const count = storage.deleteCollection(req.params.id);
    if (count === 0) return res.status(404).json({ error: '收藏夹不存在' });
    res.json({ deleted: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/collections/:id/sessions — 添加会话到收藏夹 */
app.post('/api/collections/:id/sessions', (req, res) => {
  try {
    const ref = storage.addSessionToCollection(req.params.id, req.body);
    if (!ref) return res.status(404).json({ error: '收藏夹不存在' });
    res.json(ref);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/collections/:id/sessions/:refId — 从收藏夹移除会话 */
app.delete('/api/collections/:id/sessions/:refId', (req, res) => {
  try {
    const ok = storage.removeSessionFromCollection(req.params.id, req.params.refId);
    if (!ok) return res.status(404).json({ error: '未找到' });
    res.json({ removed: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/collections/:id/sessions/:refId — 更新会话备注 */
app.put('/api/collections/:id/sessions/:refId', (req, res) => {
  try {
    const ref = storage.updateSessionNote(req.params.id, req.params.refId, req.body.note || '');
    if (!ref) return res.status(404).json({ error: '未找到' });
    res.json(ref);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 生产模式：托管静态文件
// ============================================================
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    // 跳过 API 路由
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ============================================================
// 启动
// ============================================================
app.listen(PORT, () => {
  console.log(`\n🔍 Claude Chat Viewer 已启动`);
  console.log(`   前端: http://localhost:${PORT}`);
  console.log(`   API:  http://localhost:${PORT}/api`);
  console.log(`   按 Ctrl+C 停止\n`);
});
