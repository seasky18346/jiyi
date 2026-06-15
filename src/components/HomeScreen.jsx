import React, { useState, useEffect } from 'react';
import { BookOpen, RefreshCw, AlertTriangle, HelpCircle, Layers, ClipboardList, CheckCircle2, ChevronRight, X } from 'lucide-react';

export default function HomeScreen({ startSession }) {
  const [stats, setStats] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState(null); // 'learn' | 'review' | null
  const [mode, setMode] = useState('standard'); // 'quick' | 'standard' | 'deep'

  useEffect(() => {
    fetchHomeData();
  }, []);

  // Set default mode when modal opens
  useEffect(() => {
    if (activeMenu === 'learn') {
      setMode('standard');
    } else if (activeMenu === 'review') {
      setMode('standard'); // default for reviews, but "错题回炉" option will override or defaults can be changed
    }
  }, [activeMenu]);

  const fetchHomeData = async () => {
    try {
      const [resStats, resReviews] = await Promise.all([
        fetch('/api/statistics').then(r => r.json()),
        fetch('/api/today-reviews').then(r => r.json())
      ]);
      if (resStats.success) setStats(resStats.data);
      if (resReviews.success) setReviews(resReviews.data);
    } catch (err) {
      console.error('Failed to load home screen data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate countdown to KAO YAN (postgraduate entrance exam) - typical date is Dec 19, 2026 for 2027 exam
  const getExamCountdown = () => {
    const examDate = new Date('2026-12-19T00:00:00');
    const now = new Date();
    const diff = examDate - now;
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>正在同步最新背诵库与莱特纳进度...</p>
      </div>
    );
  }

  // Derived counts
  const totalUnlearned = stats ? (stats.totalQuestions - stats.learnedQuestions) : 0;
  const newQuestionsCount = reviews?.newQuestions?.length || 0;
  const dueReviewCount = stats?.remainingReviewsToday || 0;
  const forgotCount = reviews?.errorReinforcement?.length || 0;

  // Today's new target (capped at 20 or remaining new questions)
  const DAILY_NEW_GOAL = 20;
  const todayNewTarget = Math.min(DAILY_NEW_GOAL, newQuestionsCount);
  const countdown = getExamCountdown();

  const handleSelectOption = (action, queue = null, name = '', sessionMode = 'standard') => {
    setActiveMenu(null);
    if (action === 'start-queue') {
      startSession('today-review', queue, name, sessionMode);
    } else {
      startSession(action, null, '', sessionMode);
    }
  };

  return (
    <div className="home-screen-view animate-fade">
      {/* Immersive Welcome Area */}
      <header className="home-hero" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h1 className="home-title">GIS Review</h1>
        <p className="home-subtitle">沉浸式 GIS 考研考点背诵系统</p>
        
        {/* Countdown Badge */}
        <div className="countdown-badge" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.4rem 1.2rem',
          borderRadius: '20px',
          background: 'var(--accent-muted)',
          border: '1px solid var(--accent)',
          color: 'var(--accent)',
          fontWeight: '700',
          fontSize: '0.85rem',
          marginTop: '1rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          🎯 距离 2027 考研冲刺仅剩 <strong>{countdown}</strong> 天
        </div>
      </header>

      {/* Main Entry Cards */}
      <div className="home-cards-grid">
        {/* Card 1: Learn */}
        <div 
          className="home-card glass-panel learn-card"
          onClick={() => setActiveMenu('learn')}
        >
          <div className="home-card-header">
            <span className="home-card-tag">Learn</span>
            <BookOpen className="home-card-icon text-accent" size={24} />
          </div>
          <div className="home-card-body">
            <span className="home-card-number">{todayNewTarget}</span>
            <span className="home-card-label">今日计划新学数量</span>
          </div>
          <div className="home-card-footer">
            <span>未学习总量：{totalUnlearned}</span>
          </div>
        </div>

        {/* Card 2: Review */}
        <div 
          className="home-card glass-panel review-card"
          onClick={() => setActiveMenu('review')}
        >
          <div className="home-card-header">
            <span className="home-card-tag">Review</span>
            <RefreshCw className="home-card-icon text-accent" size={24} />
          </div>
          <div className="home-card-body">
            <span className="home-card-number">{dueReviewCount}</span>
            <span className="home-card-label">今日到期待复习</span>
          </div>
          <div className="home-card-footer">
            <span>错题待回炉：{forgotCount}</span>
          </div>
        </div>
      </div>

      {/* Popovers for Learn/Review */}
      {activeMenu && (
        <div className="overlay-modal-container" onClick={() => setActiveMenu(null)}>
          <div className="overlay-modal glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: '1rem' }}>
              <h3>{activeMenu === 'learn' ? '新学任务' : '复习任务'}</h3>
              <button className="modal-close-btn" onClick={() => setActiveMenu(null)}>
                <X size={20} />
              </button>
            </div>

            {/* Mode selector Segment Control */}
            <div className="mode-selector-container" style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                选择练习模式:
              </span>
              <div className="mode-pills" style={{ display: 'flex', background: 'rgba(0,0,0,0.15)', borderRadius: '12px', padding: '2px', border: '1px solid var(--border-color)' }}>
                {[
                  { id: 'quick', label: '⚡ 快速复习', desc: '仅测试填空' },
                  { id: 'standard', label: '🚀 标准复习', desc: '填空+论述，可跳过AI' },
                  { id: 'deep', label: '🧠 深度自测', desc: '填空+论述+AI智能阅卷' }
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    style={{
                      flex: 1,
                      padding: '0.5rem 0.25rem',
                      borderRadius: '10px',
                      border: 'none',
                      background: mode === m.id ? 'var(--accent)' : 'transparent',
                      color: mode === m.id ? 'var(--bg-dark)' : 'var(--text-secondary)',
                      fontWeight: '700',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    title={m.desc}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="modal-options-list">
              {activeMenu === 'learn' ? (
                <>
                  <button 
                    className="modal-option-item"
                    disabled={newQuestionsCount === 0}
                    onClick={() => handleSelectOption('start-queue', reviews.newQuestions.slice(0, todayNewTarget), '今日新学', mode)}
                    style={newQuestionsCount === 0 ? { opacity: 0.6 } : {}}
                  >
                    <div className="option-icon-wrapper success">
                      <Layers size={18} />
                    </div>
                    <div className="option-details">
                      <h4>今日计划新学</h4>
                      <p>进行今日新学 {todayNewTarget} 个考点（使用已选模式）</p>
                    </div>
                    <ChevronRight size={18} className="option-arrow" />
                  </button>

                  <button 
                    className="modal-option-item"
                    onClick={() => handleSelectOption('recite', null, '', mode)}
                  >
                    <div className="option-icon-wrapper info">
                      <ClipboardList size={18} />
                    </div>
                    <div className="option-details">
                      <h4>全部卡片背诵</h4>
                      <p>在所有知识库卡片中自由进行浏览和记忆</p>
                    </div>
                    <ChevronRight size={18} className="option-arrow" />
                  </button>

                  <button 
                    className="modal-option-item"
                    onClick={() => handleSelectOption('daily-practice', null, '', mode)}
                  >
                    <div className="option-icon-wrapper warning">
                      <CheckCircle2 size={18} />
                    </div>
                    <div className="option-details">
                      <h4>专项回忆练习</h4>
                      <p>按科目、章节、题型进行自定义筛选特训</p>
                    </div>
                    <ChevronRight size={18} className="option-arrow" />
                  </button>
                </>
              ) : (
                <>
                  <button 
                    className="modal-option-item"
                    disabled={dueReviewCount === 0}
                    onClick={() => handleSelectOption('start-queue', [...(reviews?.delayedQuestions || []), ...(reviews?.dueQuestions || [])], '今日复习', mode)}
                    style={dueReviewCount === 0 ? { opacity: 0.6 } : {}}
                  >
                    <div className="option-icon-wrapper success">
                      <RefreshCw size={18} />
                    </div>
                    <div className="option-details">
                      <h4>今日到期复习</h4>
                      <p>巩固今天到期的 {dueReviewCount} 个核心概念（默认标准复习）</p>
                    </div>
                    <ChevronRight size={18} className="option-arrow" />
                  </button>

                  <button 
                    className="modal-option-item"
                    disabled={forgotCount === 0}
                    onClick={() => handleSelectOption('start-queue', reviews.errorReinforcement, '错题强化', 'deep')}
                    style={forgotCount === 0 ? { opacity: 0.6 } : {}}
                  >
                    <div className="option-icon-wrapper danger">
                      <AlertTriangle size={18} />
                    </div>
                    <div className="option-details">
                      <h4>错题回炉</h4>
                      <p>集中自测当前答错较多的 {forgotCount} 个易忘难点（强制深度自测）</p>
                    </div>
                    <ChevronRight size={18} className="option-arrow" />
                  </button>

                  <button 
                    className="modal-option-item"
                    onClick={() => handleSelectOption('stats', null, '', mode)}
                  >
                    <div className="option-icon-wrapper warning">
                      <HelpCircle size={18} />
                    </div>
                    <div className="option-details">
                      <h4>弱点统计看板</h4>
                      <p>查看历史掌握度分布与高频失分错题统计</p>
                    </div>
                    <ChevronRight size={18} className="option-arrow" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
