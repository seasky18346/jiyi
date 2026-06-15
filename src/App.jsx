import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import TodayReview from './components/TodayReview';
import ReciteCard from './components/ReciteCard';
import QuestionManager from './components/QuestionManager';
import StatsView from './components/StatsView';
import Settings from './components/Settings';
import DailyPractice from './components/DailyPractice';
import HomeScreen from './components/HomeScreen';
import AppShell from './components/AppShell';
import './App.css';
import './theme/theme.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [recitationData, setRecitationData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  
  // Custom practice queue state
  const [practiceQueue, setPracticeQueue] = useState(null);
  const [practiceQueueName, setPracticeQueueName] = useState('');
  const [practiceMode, setPracticeMode] = useState('standard');

  // Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('gis_review_theme') || 'misty-rose';
  });

  const toggleTheme = () => {
    const newTheme = theme === 'orderly' ? 'misty-rose' : 'orderly';
    setTheme(newTheme);
    localStorage.setItem('gis_review_theme', newTheme);
  };

  const handleNavigate = (tab) => {
    if (tab === 'dashboard') {
      setActiveTab('home');
    } else {
      setActiveTab(tab);
    }
  };

  // Initialize data from database
  useEffect(() => {
    fetchQuestions();
  }, []);

  // Global customAlert and customConfirm registration
  useEffect(() => {
    window.customAlert = (message) => {
      return new Promise((resolve) => {
        setDialog({ type: 'alert', message, resolve });
      });
    };
    window.customConfirm = (message) => {
      return new Promise((resolve) => {
        setDialog({ type: 'confirm', message, resolve });
      });
    };
    return () => {
      delete window.customAlert;
      delete window.customConfirm;
    };
  }, []);

  const [importState, setImportState] = useState({
    isImporting: false,
    total: 0,
    current: 0,
    currentTitle: '',
    message: ''
  });
  const [completionMessage, setCompletionMessage] = useState('');

  const startGlobalImport = async (questionsList, useAI, defaultSubject) => {
    setImportState({
      isImporting: true,
      total: questionsList.length,
      current: 0,
      currentTitle: '',
      message: `🔄 正在准备导入 ${questionsList.length} 个题目...`
    });
    setCompletionMessage('');

    let successCount = 0;
    for (let i = 0; i < questionsList.length; i++) {
      const q = questionsList[i];
      setImportState(prev => ({
        ...prev,
        current: i,
        currentTitle: q.title,
        message: `🔄 正在处理 (${i + 1}/${questionsList.length}): ${q.title}...`
      }));

      try {
        const endpoint = useAI ? '/api/questions/import-ai' : '/api/questions/import';
        const payload = useAI 
          ? { text: q.text, defaultSubject: defaultSubject || '地理信息系统', defaultChapter: q.chapter }
          : { format: 'markdown', content: q.text };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          successCount++;
        }
      } catch (err) {
        console.error(`Failed to import question: ${q.title}`, err);
      }
    }

    setImportState({
      isImporting: false,
      total: 0,
      current: 0,
      currentTitle: '',
      message: ''
    });
    setCompletionMessage(`🎉 导入完成！成功导入 ${successCount} / ${questionsList.length} 个题目。`);
    fetchQuestions(true);
    setTimeout(() => setCompletionMessage(''), 8000);
  };

  const fetchQuestions = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch('/api/questions');
      const res = await response.json();
      if (res.success) {
        setRecitationData(res.data);
      }
    } catch (e) {
      console.error("Local database server connection failed:", e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Spaced Repetition Rate Card Callback
  const handleRateCard = async (questionId, rating) => {
    try {
      const response = await fetch('/api/cards/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, rating })
      });
      const res = await response.json();
      if (res.success) {
        // Refresh question states silently without unmounting
        fetchQuestions(true);
      } else {
        await window.customAlert('卡片评估保存失败：' + res.message);
      }
    } catch (e) {
      console.error(e);
      await window.customAlert('卡片评估网络请求出错。');
    }
  };

  return (
    <AppShell
      activeTab={activeTab}
      setActiveTab={handleNavigate}
      theme={theme}
      toggleTheme={toggleTheme}
      backendAvailable={true}
      sessionFilter={practiceQueueName === '今日复习' ? 'review' : practiceQueueName === '今日新学' ? 'learn' : practiceQueueName === '错题强化' ? 'forgot' : 'all'}
    >
      {/* Floating Global Import Progress Banner */}
      {importState.isImporting && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: 'rgba(10, 15, 30, 0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--primary)',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 20px rgba(0, 210, 255, 0.15)',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
            <div className="spinner" style={{ width: '1.25rem', height: '1.25rem', borderWidth: '2px', margin: 0 }}></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                {importState.message}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                当前处理: {importState.currentTitle || '准备中...'}
              </span>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', minWidth: '300px' }}>
            <div style={{ 
              flex: 1, 
              height: '6px', 
              backgroundColor: 'rgba(255, 255, 255, 0.05)', 
              borderRadius: '3px',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{ 
                width: `${(importState.current / importState.total) * 100}%`, 
                height: '100%', 
                backgroundColor: 'var(--primary)',
                boxShadow: '0 0 8px var(--primary)',
                borderRadius: '3px',
                transition: 'width 0.4s ease-out'
              }}></div>
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--primary)', minWidth: '40px', textAlign: 'right' }}>
              {Math.round((importState.current / importState.total) * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Floating Completion Success Banner */}
      {completionMessage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: 'rgba(16, 185, 129, 0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--success)',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          boxShadow: '0 4px 20px rgba(16, 185, 129, 0.2)',
          color: '#fff',
          fontSize: '0.85rem',
          fontWeight: '600',
          boxSizing: 'border-box'
        }}>
          <span>{completionMessage}</span>
          <button 
            onClick={() => setCompletionMessage('')}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#fff', 
              cursor: 'pointer', 
              fontSize: '1rem',
              marginLeft: '1rem',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            ×
          </button>
        </div>
      )}

      {loading ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <div className="spinner"></div>
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>正在同步最新背诵库与莱特纳进度...</p>
        </div>
      ) : (
        <>
          {activeTab === 'home' && (
            <HomeScreen
              startSession={(action, queue = null, name = '', mode = 'standard') => {
                setPracticeMode(mode);
                if (queue) {
                  setPracticeQueue(queue);
                  setPracticeQueueName(name);
                  setActiveTab('today-review');
                } else {
                  setActiveTab(action);
                }
              }}
            />
          )}
          
          {activeTab === 'today-review' && (
            <TodayReview 
              onNavigate={handleNavigate}
              customQueue={practiceQueue}
              customQueueName={practiceQueueName}
              practiceMode={practiceMode}
              onClearCustomQueue={() => {
                setPracticeQueue(null);
                setPracticeQueueName('');
              }}
            />
          )}

          {activeTab === 'daily-practice' && (
            <DailyPractice
              onStartPractice={(name, queue) => {
                setPracticeQueue(queue);
                setPracticeQueueName(name);
                setActiveTab('today-review');
              }}
            />
          )}
          
          {activeTab === 'recite' && (
            <ReciteCard 
              recitationData={recitationData} 
              onRateCard={handleRateCard} 
            />
          )}

          {activeTab === 'stats' && (
            <StatsView />
          )}

          {activeTab === 'editor' && (
            <QuestionManager 
              globalImportState={importState}
              onStartGlobalImport={startGlobalImport}
            />
          )}

          {activeTab === 'settings' && (
            <Settings theme={theme} setTheme={setTheme} />
          )}
        </>
      )}

      {/* Custom Dialog Overlay */}
      {dialog && (
        <div className="custom-dialog-overlay">
          <div className="custom-dialog-card">
            <div className={`custom-dialog-icon ${dialog.type}`}>
              {dialog.type === 'alert' ? 'ℹ️' : '❓'}
            </div>
            <div className="custom-dialog-message">
              {dialog.message}
            </div>
            <div className="custom-dialog-actions">
              {dialog.type === 'confirm' && (
                <button
                  className="custom-dialog-btn cancel"
                  onClick={() => {
                    dialog.resolve(false);
                    setDialog(null);
                  }}
                >
                  取消
                </button>
              )}
              <button
                className="custom-dialog-btn confirm-ok"
                onClick={() => {
                  dialog.resolve(true);
                  setDialog(null);
                }}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
