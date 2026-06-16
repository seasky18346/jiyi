import React, { useState, useEffect } from 'react';
import { BookOpen, RefreshCw, AlertTriangle, HelpCircle, Layers, ClipboardList, CheckCircle2, ChevronRight, X } from 'lucide-react';

export default function HomeScreen({ reviewsData, startSession }) {
  const [activeMenu, setActiveMenu] = useState(null); // 'learn' | 'review' | null
  const [mode, setMode] = useState('standard'); // 'quick' | 'standard' | 'deep'

  const {
    loading,
    stats,
    reviews,
    totalUnlearned,
    forgotCount,
    dueReviewCount,
    actualDueCount,
    delayedCount,
    dueQuestionsCount,
    newQuestionsCount,
    cappedLearnQueue,
    cappedReviewQueue
  } = reviewsData;

  // Set default mode when modal opens
  useEffect(() => {
    if (activeMenu === 'learn') {
      setMode('standard');
    } else if (activeMenu === 'review') {
      setMode('standard');
    }
  }, [activeMenu]);

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
          onClick={() => {
            if (cappedLearnQueue.length > 0) {
              handleSelectOption('start-queue', cappedLearnQueue, '今日新学', 'learn');
            } else {
              window.customAlert('您已学完当前所有的未学概念！可以在“题库管理”中导入新资料。');
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          <div className="home-card-header">
            <span className="home-card-tag">Learn</span>
            <BookOpen className="home-card-icon text-accent" size={24} />
          </div>
          <div className="home-card-body">
            <span className="home-card-number">{cappedLearnQueue.length}</span>
            <span className="home-card-label">今日计划新学数量</span>
          </div>
          <div className="home-card-footer">
            <span>未学习总量：{totalUnlearned}</span>
          </div>
        </div>

        {/* Card 2: Review */}
        <div 
          className="home-card glass-panel review-card"
          onClick={() => {
            if (dueReviewCount > 0) {
              handleSelectOption('start-queue', cappedReviewQueue, '今日复习', 'standard');
            } else {
              window.customAlert('您今天没有到期的复习任务！可以前往“专项训练”或“今日学习包”进行练习。');
            }
          }}
          style={{ cursor: 'pointer', opacity: dueReviewCount === 0 ? 0.8 : 1 }}
        >
          <div className="home-card-header">
            <span className="home-card-tag">Review</span>
            <RefreshCw className="home-card-icon text-accent" size={24} />
          </div>
          <div className="home-card-body">
            <span className="home-card-number">{dueReviewCount} / {actualDueCount}</span>
            <span className="home-card-label">今日计划复习数 / 实际到期总数</span>
          </div>
          <div className="home-card-footer">
            <span>延误: {delayedCount} | 到期: {dueQuestionsCount} | 错题: {forgotCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
