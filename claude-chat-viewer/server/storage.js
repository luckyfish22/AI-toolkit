const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// App 数据存放目录
const DATA_DIR = path.join(os.homedir(), 'AppData', 'Roaming', 'claude-chat-viewer');
const COLLECTIONS_FILE = path.join(DATA_DIR, 'collections.json');

/** 生成唯一 ID */
function uid() {
  return crypto.randomUUID();
}

/** 确保数据目录和文件存在 */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(COLLECTIONS_FILE)) {
    fs.writeFileSync(COLLECTIONS_FILE, JSON.stringify({ collections: [] }, null, 2), 'utf-8');
  }
}

/** 读取全部数据 */
function readData() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(COLLECTIONS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return { collections: [] };
  }
}

/** 写入全部数据 */
function writeData(data) {
  ensureDataDir();
  fs.writeFileSync(COLLECTIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ============================================================
// 收藏夹操作
// ============================================================

/** 获取所有收藏夹（平铺列表，前端自己构建树） */
function getCollections() {
  const data = readData();
  // 按 sortOrder 排序
  return data.collections.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

/** 创建收藏夹 */
function createCollection(name, parentId = null) {
  const data = readData();
  const now = new Date().toISOString();
  const collection = {
    id: uid(),
    name,
    parentId: parentId || null,
    sortOrder: data.collections.length,
    sessions: [],
    createdAt: now,
    updatedAt: now,
  };
  data.collections.push(collection);
  writeData(data);
  return collection;
}

/** 更新收藏夹（重命名/移动） */
function updateCollection(id, updates) {
  const data = readData();
  const col = data.collections.find(c => c.id === id);
  if (!col) return null;
  if (updates.name !== undefined) col.name = updates.name;
  if (updates.parentId !== undefined) col.parentId = updates.parentId;
  if (updates.sortOrder !== undefined) col.sortOrder = updates.sortOrder;
  col.updatedAt = new Date().toISOString();
  writeData(data);
  return col;
}

/** 删除收藏夹（同时删除子收藏夹） */
function deleteCollection(id) {
  const data = readData();
  // 收集所有要删除的 ID（包括子节点）
  const toDelete = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const col of data.collections) {
      if (col.parentId && toDelete.has(col.parentId) && !toDelete.has(col.id)) {
        toDelete.add(col.id);
        changed = true;
      }
    }
  }
  data.collections = data.collections.filter(c => !toDelete.has(c.id));
  writeData(data);
  return toDelete.size;
}

/** 添加会话引用到收藏夹 */
function addSessionToCollection(collectionId, sessionRef) {
  const data = readData();
  const col = data.collections.find(c => c.id === collectionId);
  if (!col) return null;

  // 检查是否已存在
  const exists = col.sessions.find(
    s => s.projectPath === sessionRef.projectPath && s.sessionId === sessionRef.sessionId
  );
  if (exists) return exists;

  const ref = {
    id: uid(),
    projectPath: sessionRef.projectPath,
    projectName: sessionRef.projectName || '',
    sessionId: sessionRef.sessionId,
    sessionTitle: sessionRef.sessionTitle || '',
    note: sessionRef.note || '',
    addedAt: new Date().toISOString(),
  };
  col.sessions.push(ref);
  col.updatedAt = new Date().toISOString();
  writeData(data);
  return ref;
}

/** 从收藏夹移除会话引用 */
function removeSessionFromCollection(collectionId, refId) {
  const data = readData();
  const col = data.collections.find(c => c.id === collectionId);
  if (!col) return false;
  const before = col.sessions.length;
  col.sessions = col.sessions.filter(s => s.id !== refId);
  col.updatedAt = new Date().toISOString();
  writeData(data);
  return col.sessions.length < before;
}

/** 更新会话备注 */
function updateSessionNote(collectionId, refId, note) {
  const data = readData();
  const col = data.collections.find(c => c.id === collectionId);
  if (!col) return null;
  const ref = col.sessions.find(s => s.id === refId);
  if (!ref) return null;
  ref.note = note;
  col.updatedAt = new Date().toISOString();
  writeData(data);
  return ref;
}

module.exports = {
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  addSessionToCollection,
  removeSessionFromCollection,
  updateSessionNote,
};
