import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import TodayReview from './components/TodayReview';
import ReciteCard from './components/ReciteCard';
import QuestionManager from './components/QuestionManager';
import StatsView from './components/StatsView';
import Settings from './components/Settings';
import DailyPractice from './components/DailyPractice';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [recitationData, setRecitationData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  
  // Custom practice queue state
  const [practiceQueue, setPracticeQueue] = useState(null);
  const [practiceQueueName, setPracticeQueueName] = useState('');

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
    <div className="app-container">
      {/* Navigation Header */}
      <header className="nav-header">
        <div className="logo-section">
          <div className="logo-icon">G</div>
          <div>
            <span className="logo-title">GIS 考研背诵大师</span>
            <span style={{ fontSize: '0.65rem', display: 'block', color: 'var(--text-secondary)' }}>
              🟢 PostgreSQL 数据源已连接
            </span>
          </div>
          <span className="logo-badge">V3.0</span>
        </div>

        <nav className="nav-links">
          <button className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            📊 看板
          </button>
          <button className={`nav-tab ${activeTab === 'today-review' ? 'active' : ''}`} onClick={() => setActiveTab('today-review')}>
            🚀 今日复习
          </button>
          <button className={`nav-tab ${activeTab === 'daily-practice' ? 'active' : ''}`} onClick={() => setActiveTab('daily-practice')}>
            🎯 每日练习
          </button>
          <button className={`nav-tab ${activeTab === 'recite' ? 'active' : ''}`} onClick={() => setActiveTab('recite')}>
            📖 卡片背诵
          </button>
          <button className={`nav-tab ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>
            📈 统计弱点
          </button>
          <button className={`nav-tab ${activeTab === 'editor' ? 'active' : ''}`} onClick={() => setActiveTab('editor')}>
            ✏️ 题库管理
          </button>
          <button className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            ⚙️ 设置
          </button>
        </nav>
      </header>

      {/* Main Container */}
      <main className="main-content">
        {loading ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="spinner"></div>
            <p style={{ marginTop: '1rem' }}>正在同步最新背诵库与莱特纳进度...</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard 
                onNavigate={setActiveTab} 
              />
            )}
            
            {activeTab === 'today-review' && (
              <TodayReview 
                onNavigate={setActiveTab}
                customQueue={practiceQueue}
                customQueueName={practiceQueueName}
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
              <QuestionManager />
            )}

            {activeTab === 'settings' && (
              <Settings />
            )}
          </>
        )}
      </main>

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
    </div>
  );
}
