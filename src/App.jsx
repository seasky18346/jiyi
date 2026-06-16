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
import LoginScreen from './components/LoginScreen';
import ReportView from './components/ReportView';
import useSettings from './hooks/useSettings';
import useReviews from './hooks/useReviews';
import './App.css';
import './theme/theme.css';

// Guard patch to avoid recursion when HMR hot reloads
if (!window.__fetchPatched) {
  window.__fetchPatched = true;
  const originalFetch = window.fetch;
  window.fetch = async function (resource, options = {}) {
    const url = typeof resource === 'string' ? resource : resource.url;
    const isApiRequest = url && url.startsWith('/api/');
    const isAuthRequest = url && (
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/register') ||
      url.includes('/api/auth/refresh')
    );

    let updatedOptions = { ...options };
    
    if (isApiRequest && !isAuthRequest) {
      const token = localStorage.getItem('gis_access_token');
      if (token) {
        updatedOptions.headers = {
          ...updatedOptions.headers,
          'Authorization': `Bearer ${token}`
        };
      }
    }

    let response = await originalFetch(resource, updatedOptions);

    if (response.status === 401 && isApiRequest && !isAuthRequest) {
      const refreshToken = localStorage.getItem('gis_refresh_token');
      if (refreshToken) {
        try {
          const refreshResponse = await originalFetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
          });
          
          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            if (refreshData.success && refreshData.accessToken) {
              localStorage.setItem('gis_access_token', refreshData.accessToken);
              
              updatedOptions.headers = {
                ...updatedOptions.headers,
                'Authorization': `Bearer ${refreshData.accessToken}`
              };
              response = await originalFetch(resource, updatedOptions);
              return response;
            }
          }
        } catch (err) {
          console.error('Silent refresh failed:', err);
        }
      }
      
      localStorage.removeItem('gis_access_token');
      localStorage.removeItem('gis_refresh_token');
      window.dispatchEvent(new Event('auth_logout'));
    }

    return response;
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [recitationData, setRecitationData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  
  // Custom practice queue state
  const [practiceQueue, setPracticeQueue] = useState(null);
  const [practiceQueueName, setPracticeQueueName] = useState('');
  const [practiceMode, setPracticeMode] = useState('standard');

  // Authentication State
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const {
    theme,
    setTheme,
    dailyNewGoal,
    setDailyNewGoal,
    dailyReviewGoal,
    setDailyReviewGoal
  } = useSettings();

  const reviewsData = useReviews(dailyNewGoal, dailyReviewGoal, !!accessToken);

  const toggleTheme = () => {
    setTheme(theme === 'orderly' ? 'misty-rose' : 'orderly');
  };

  const handleNavigate = (tab) => {
    if (tab === 'dashboard' || tab === 'home') {
      handleExitSession();
    } else {
      setActiveTab(tab);
    }
  };

  const handleExitSession = () => {
    setPracticeQueue(null);
    setPracticeQueueName('');
    setPracticeMode('standard');
    setActiveTab('home');
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('gis_access_token');
    localStorage.removeItem('gis_refresh_token');
    setUser(null);
    setAccessToken(null);
    handleExitSession();
  };

  // Auth initialization on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedAccessToken = localStorage.getItem('gis_access_token');
      const storedRefreshToken = localStorage.getItem('gis_refresh_token');

      if (!storedAccessToken && !storedRefreshToken) {
        setAuthLoading(false);
        return;
      }

      if (storedAccessToken) {
        try {
          const resProfile = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${storedAccessToken}` }
          });
          if (resProfile.ok) {
            const data = await resProfile.json();
            if (data.success) {
              setUser(data.user);
              setAccessToken(storedAccessToken);
              
              // Slide the refresh token since user is active within 2 days
              try {
                const resRefreshLong = await fetch('/api/auth/refresh-long', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${storedAccessToken}` }
                });
                const refreshLongData = await resRefreshLong.json();
                if (refreshLongData.success) {
                  localStorage.setItem('gis_refresh_token', refreshLongData.refreshToken);
                }
              } catch (e) {
                console.error('Failed to slide refresh token:', e);
              }
              setAuthLoading(false);
              return;
            }
          }
        } catch (err) {
          console.error('Initial token verification failed:', err);
        }
      }

      // If access token was invalid/missing, try refresh token
      if (storedRefreshToken) {
        try {
          const resRefresh = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: storedRefreshToken })
          });
          const refreshData = await resRefresh.json();
          if (refreshData.success && refreshData.accessToken) {
            localStorage.setItem('gis_access_token', refreshData.accessToken);
            setAccessToken(refreshData.accessToken);

            const resProfile = await fetch('/api/auth/me', {
              headers: { 'Authorization': `Bearer ${refreshData.accessToken}` }
            });
            const profileData = await resProfile.json();
            if (profileData.success) {
              setUser(profileData.user);
            }
          } else {
            // Refresh token expired/invalid as well
            localStorage.removeItem('gis_access_token');
            localStorage.removeItem('gis_refresh_token');
          }
        } catch (err) {
          console.error('Initial refresh token check failed:', err);
        }
      }

      setAuthLoading(false);
    };

    initAuth();
  }, []);

  // Listen to auth_logout custom events triggered by fetch interceptor
  useEffect(() => {
    const handleLogoutEvent = () => {
      setUser(null);
      setAccessToken(null);
    };
    window.addEventListener('auth_logout', handleLogoutEvent);
    return () => {
      window.removeEventListener('auth_logout', handleLogoutEvent);
    };
  }, []);

  // Initialize data from database
  useEffect(() => {
    if (accessToken) {
      fetchQuestions();
    }
  }, [accessToken]);

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
    reviewsData.fetchReviews();
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
        reviewsData.fetchReviews();
      } else {
        await window.customAlert('卡片评估保存失败：' + res.message);
      }
    } catch (e) {
      console.error(e);
      await window.customAlert('卡片评估网络请求出错。');
    }
  };

  if (authLoading) {
    return (
      <div className="app-container" data-theme={theme || 'misty-rose'}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <div className="spinner"></div>
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>正在验证账户会话...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-container" data-theme={theme || 'misty-rose'}>
        <LoginScreen 
          onLoginSuccess={(userData, token) => {
            setUser(userData);
            setAccessToken(token);
          }}
          theme={theme}
          toggleTheme={toggleTheme}
        />
      </div>
    );
  }

  return (
    <AppShell
      activeTab={activeTab}
      setActiveTab={handleNavigate}
      onExitSession={handleExitSession}
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
              reviewsData={reviewsData}
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
              dailyNewGoal={dailyNewGoal}
              dailyReviewGoal={dailyReviewGoal}
              onClearCustomQueue={() => {
                setPracticeQueue(null);
                setPracticeQueueName('');
              }}
              reviewsData={reviewsData}
            />
          )}

          {activeTab === 'practice' && (
            <DailyPractice
              onStartPractice={(name, queue) => {
                setPracticeQueue(queue);
                setPracticeQueueName(name);
                setPracticeMode('standard');
                setActiveTab('today-review');
              }}
              reviewsData={reviewsData}
            />
          )}

          {activeTab === 'report' && (
            <ReportView 
              onStartPractice={(name, queue) => {
                setPracticeQueue(queue);
                setPracticeQueueName(name);
                setPracticeMode('standard');
                setActiveTab('today-review');
              }}
              reviewsData={reviewsData}
            />
          )}
          
          {activeTab === 'recite' && (
            <ReciteCard 
              recitationData={recitationData} 
              onRateCard={handleRateCard} 
            />
          )}

          {activeTab === 'stats' && (
            <StatsView 
              reviewsData={reviewsData}
            />
          )}

          {activeTab === 'editor' && (
            <QuestionManager 
              globalImportState={importState}
              onStartGlobalImport={startGlobalImport}
            />
          )}

          {activeTab === 'settings' && (
            <Settings 
              theme={theme} 
              setTheme={setTheme} 
              dailyNewGoal={dailyNewGoal}
              setDailyNewGoal={setDailyNewGoal}
              dailyReviewGoal={dailyReviewGoal}
              setDailyReviewGoal={setDailyReviewGoal}
              user={user}
              onLogout={handleLogout}
            />
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
