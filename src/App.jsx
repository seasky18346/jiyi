import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import ReciteCard from './components/ReciteCard';
import Tester from './components/Tester';
import Editor from './components/Editor';
import Settings from './components/Settings';
import './App.css';

// Default mock data in case no file is loaded yet (failsafe)
const defaultData = [
  {
    date: "6月12日背诵内容：地理信息系统基础理论",
    items: [
      {
        id: 1,
        title: "地理数据和地理信息",
        points: [
          {
            id: "1_1",
            concept: "地理数据 (Geographic Data)",
            description: "关于地理实体性质、特征和运动状态的**原始描述**或**事实记录**。特点是**原始性、未加工**。",
            keywords: ["原始描述", "事实记录", "原始性、未加工"]
          }
        ]
      }
    ]
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [recitationData, setRecitationData] = useState([]);
  const [progress, setProgress] = useState({ cardStatus: {}, history: [] });
  const [isSyncing, setIsSyncing] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState(false);
  
  // Settings state (loads from localStorage on init)
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('gis_recite_settings');
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      apiKey: parsed.apiKey || 'sk-ck90iazmmd6hy7mi4uxjvhry22z6s46q0fxt8xhk6ubppn77',
      apiUrl: parsed.apiUrl || 'https://api.xiaomimimo.com/v1',
      apiModel: parsed.apiModel || 'mimo-v2.5',
      webdavEnabled: parsed.webdavEnabled !== undefined ? parsed.webdavEnabled : true,
      webdavUrl: parsed.webdavUrl || 'https://dav.jianguoyun.com/dav/',
      webdavUser: parsed.webdavUser || '1834612963@qq.com',
      webdavPassword: parsed.webdavPassword || 'a8ytcehv84ypk2yj'
    };
  });

  // Base API URL for local backend
  const BACKEND_BASE = window.location.origin.includes('localhost:') ? 'http://localhost:5000' : '';

  // Initialize data
  useEffect(() => {
    checkAndLoadData();
  }, []);

  const checkAndLoadData = async () => {
    try {
      // 1. Try local Node backend
      const response = await fetch(`${BACKEND_BASE}/api/recitation`, {
        signal: AbortSignal.timeout(2000) // Timeout fast
      });
      if (response.ok) {
        const res = await response.json();
        setRecitationData(res.data);
        setBackendAvailable(true);
        
        // Load progress from backend
        const progResponse = await fetch(`${BACKEND_BASE}/api/progress`);
        if (progResponse.ok) {
          const progRes = await progResponse.json();
          setProgress(progRes.data || { cardStatus: {}, history: [] });
        }
        return;
      }
    } catch (e) {
      console.warn("Local backend server not available, falling back to LocalStorage/WebDAV:", e);
    }

    // 2. Fallback to LocalStorage
    setBackendAvailable(false);
    const cachedData = localStorage.getItem('gis_recite_data');
    const cachedProg = localStorage.getItem('gis_recite_progress');
    
    if (cachedData) {
      setRecitationData(JSON.parse(cachedData));
    } else {
      setRecitationData(defaultData);
    }
    
    if (cachedProg) {
      setProgress(JSON.parse(cachedProg));
    }

    // 3. WebDAV Auto Pull if enabled
    if (settings.webdavEnabled && settings.webdavUrl && settings.webdavUser && settings.webdavPassword) {
      handleWebDAVSync('pull');
    }
  };

  // Save Settings
  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('gis_recite_settings', JSON.stringify(newSettings));
  };

  // Helper: WebDAV REST Client
  const requestWebDAV = async (filename, method, body = null) => {
    const { webdavUrl, webdavUser, webdavPassword } = settings;
    const authHeader = 'Basic ' + btoa(unescape(encodeURIComponent(webdavUser + ":" + webdavPassword)));
    
    const headers = new Headers();
    headers.set('Authorization', authHeader);
    
    if (method === 'PUT') {
      headers.set('Content-Type', 'text/plain; charset=utf-8');
    }

    const response = await fetch(`${webdavUrl}/${filename}`, {
      method,
      headers,
      body: body
    });

    if (method === 'GET' && response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`WebDAV Error: ${response.status} ${response.statusText}`);
    }

    return method === 'GET' ? await response.text() : true;
  };

  // WebDAV Synchronization (Pull / Push)
  const handleWebDAVSync = async (direction) => {
    setIsSyncing(true);
    try {
      if (direction === 'push') {
        // Upload both data and progress
        const dataStr = JSON.stringify(recitationData, null, 2);
        const progStr = JSON.stringify(progress, null, 2);
        
        await requestWebDAV('recitation_data.json', 'PUT', dataStr);
        await requestWebDAV('recitation_progress.json', 'PUT', progStr);
      } else {
        // Pull data and progress
        const remoteDataStr = await requestWebDAV('recitation_data.json', 'GET');
        const remoteProgStr = await requestWebDAV('recitation_progress.json', 'GET');
        
        if (remoteDataStr) {
          const parsedData = JSON.parse(remoteDataStr);
          setRecitationData(parsedData);
          localStorage.setItem('gis_recite_data', remoteDataStr);
        }
        if (remoteProgStr) {
          const parsedProg = JSON.parse(remoteProgStr);
          setProgress(parsedProg);
          localStorage.setItem('gis_recite_progress', remoteProgStr);
        }
      }
    } catch (error) {
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  // Save / Update Recitation Data (from Editor)
  const handleSaveRecitation = async (updatedData) => {
    setRecitationData(updatedData);
    
    if (backendAvailable) {
      // Save to local physical Markdown file via Express Backend
      const response = await fetch(`${BACKEND_BASE}/api/recitation/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updatedData })
      });
      if (!response.ok) {
        throw new Error('Backend markdown update failed');
      }
    } else {
      // Save to local storage cache
      localStorage.setItem('gis_recite_data', JSON.stringify(updatedData));
      
      // If WebDAV is enabled, push immediately to keep cloud updated
      if (settings.webdavEnabled) {
        const dataStr = JSON.stringify(updatedData, null, 2);
        await requestWebDAV('recitation_data.json', 'PUT', dataStr);
      }
    }
  };

  // Leitner Spaced Repetition Rate Card Callback
  const handleRateCard = async (pointId, rating) => {
    const boxIntervals = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 15 };
    const currentStatus = progress.cardStatus[pointId] || { box: 1 };
    
    let newBox = currentStatus.box;
    if (rating === 'forgot') {
      newBox = 1; // Back to box 1
    } else if (rating === 'hard') {
      newBox = Math.max(1, newBox - 1);
    } else if (rating === 'good') {
      newBox = Math.min(5, newBox + 1);
    } else if (rating === 'easy') {
      newBox = Math.min(5, newBox + 2); // Jump forward 2 boxes
    }

    const intervalDays = boxIntervals[newBox];
    const nextReviewTime = new Date();
    nextReviewTime.setDate(nextReviewTime.getDate() + intervalDays);

    const updatedProg = {
      ...progress,
      cardStatus: {
        ...progress.cardStatus,
        [pointId]: {
          box: newBox,
          nextReviewTime: nextReviewTime.toISOString()
        }
      },
      history: [
        ...progress.history,
        {
          pointId,
          rating,
          time: new Date().toISOString()
        }
      ]
    };

    setProgress(updatedProg);

    if (backendAvailable) {
      // Save to local backend JSON file
      await fetch(`${BACKEND_BASE}/api/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProg)
      });
    } else {
      // Save cache
      localStorage.setItem('gis_recite_progress', JSON.stringify(updatedProg));
      
      // Sync WebDAV if active
      if (settings.webdavEnabled) {
        await requestWebDAV('recitation_progress.json', 'PUT', JSON.stringify(updatedProg, null, 2));
      }
    }
  };

  // Helper for loading/importing local Markdown manually in PWA mode
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      
      // Parse markdown client side
      const parsedData = parseMarkdownClient(text);
      setRecitationData(parsedData);
      localStorage.setItem('gis_recite_data', JSON.stringify(parsedData));
      
      // Sync WebDAV if active
      if (settings.webdavEnabled) {
        await requestWebDAV('recitation_data.json', 'PUT', JSON.stringify(parsedData, null, 2));
      }
    };
    reader.readAsText(file);
  };

  // Client-side markdown parsing logic in case server is unavailable (PWA Mode)
  const parseMarkdownClient = (text) => {
    const lines = text.split(/\r?\n/);
    const result = [];
    let currentGroup = null;
    let currentItem = null;
    let globalItemIndex = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('## ')) {
        const title = line.replace(/^##\s*(📅)?\s*/, '').trim();
        currentGroup = { date: title, items: [] };
        result.push(currentGroup);
        currentItem = null;
        continue;
      }

      if (line.startsWith('### ')) {
        const rawTitle = line.replace('### ', '').trim();
        const match = rawTitle.match(/^(\d+)\.\s*(.*)/);
        const id = match ? parseInt(match[1]) : globalItemIndex;
        const title = match ? match[2] : rawTitle;

        currentItem = { id, title, rawContent: [], points: [] };
        globalItemIndex = id + 1;

        if (currentGroup) {
          currentGroup.items.push(currentItem);
        } else {
          currentGroup = { date: "未分类", items: [currentItem] };
          result.push(currentGroup);
        }
        continue;
      }

      if (currentItem && line !== '') {
        currentItem.rawContent.push(line);
        const listItemMatch = line.match(/^([*\-+]$|^\*|^\d+\.)\s+(.*)/);
        if (listItemMatch) {
          const itemContent = listItemMatch[2].trim();
          const termMatch = itemContent.match(/^(?:\*\*|\*)(.*?)(?:\*\*|\*)\s*(.*?)\s*[：:]\s*(.*)/);
          
          if (termMatch) {
            const mainTerm = termMatch[1].trim();
            const subTerm = termMatch[2].trim();
            const concept = subTerm ? `${mainTerm} (${subTerm})` : mainTerm;
            const description = termMatch[3].trim();
            const keywords = [];
            const regex = /\*\*(.*?)\*\*/g;
            let kwMatch;
            while ((kwMatch = regex.exec(description)) !== null) {
              const kw = kwMatch[1].trim();
              if (kw && !keywords.includes(kw)) keywords.push(kw);
            }

            currentItem.points.push({
              id: `${currentItem.id}_${currentItem.points.length + 1}`,
              concept,
              description,
              keywords,
              rawLine: line
            });
          } else {
            const keywords = [];
            const regex = /\*\*(.*?)\*\*/g;
            let kwMatch;
            while ((kwMatch = regex.exec(itemContent)) !== null) {
              const kw = kwMatch[1].trim();
              if (kw && !keywords.includes(kw)) keywords.push(kw);
            }

            currentItem.points.push({
              id: `${currentItem.id}_${currentItem.points.length + 1}`,
              concept: currentItem.title,
              description: itemContent,
              keywords,
              rawLine: line
            });
          }
        }
      }
    }

    result.forEach(group => {
      group.items.forEach(item => {
        item.rawContent = item.rawContent.join('\n');
      });
    });

    return result;
  };

  return (
    <div className="app-container">
      {/* Navigation Header */}
      <header className="nav-header">
        <div className="logo-section">
          <div className="logo-icon">G</div>
          <div>
            <span className="logo-title">GIS 考研背诵大师</span>
            <span style={{ fontSize: '0.65rem', display: 'block', color: 'var(--text-secondary)' }}>
              {backendAvailable ? '🟢 PC 本地连接中' : '🔵 PWA 独立运行中'}
            </span>
          </div>
          <span className="logo-badge">V2.0</span>
        </div>

        <nav className="nav-links">
          <button className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            📊 总览
          </button>
          <button className={`nav-tab ${activeTab === 'recite' ? 'active' : ''}`} onClick={() => setActiveTab('recite')}>
            📖 带背
          </button>
          <button className={`nav-tab ${activeTab === 'test' ? 'active' : ''}`} onClick={() => setActiveTab('test')}>
            📝 检测
          </button>
          <button className={`nav-tab ${activeTab === 'editor' ? 'active' : ''}`} onClick={() => setActiveTab('editor')}>
            ✏️ 编辑
          </button>
          <button className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            ⚙️ 设置
          </button>
        </nav>
      </header>

      {/* Main Container */}
      <main className="main-content">
        {/* Cloud Mode upload prompt in case client has no data */}
        {!backendAvailable && recitationData.length === 0 && (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', marginBottom: '2rem' }}>
            <h3>📥 加载您的背诵知识库</h3>
            <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 1.5rem 0', fontSize: '0.9rem' }}>
              检测到当前为移动端/PWA云运行。请导入您的 <strong>.md</strong> 背诵汇总文件以开始，或前往“设置”配置坚果云 WebDAV 自动同步。
            </p>
            <input 
              type="file" 
              accept=".md" 
              onChange={handleFileUpload} 
              style={{ display: 'none' }} 
              id="file-import-btn"
            />
            <label htmlFor="file-import-btn" className="text-btn primary-btn" style={{ display: 'inline-flex', cursor: 'pointer' }}>
              选择本地 .md 文件导入
            </label>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <Dashboard 
            recitationData={recitationData} 
            progress={progress} 
            onNavigate={setActiveTab} 
          />
        )}
        
        {activeTab === 'recite' && (
          <ReciteCard 
            recitationData={recitationData} 
            progress={progress} 
            onRateCard={handleRateCard} 
          />
        )}

        {activeTab === 'test' && (
          <Tester 
            recitationData={recitationData} 
            settings={settings} 
          />
        )}

        {activeTab === 'editor' && (
          <Editor 
            recitationData={recitationData} 
            onSaveRecitation={handleSaveRecitation} 
          />
        )}

        {activeTab === 'settings' && (
          <Settings 
            settings={settings} 
            onSaveSettings={handleSaveSettings} 
            onSyncCloud={handleWebDAVSync}
            isSyncing={isSyncing}
          />
        )}
      </main>
    </div>
  );
}
