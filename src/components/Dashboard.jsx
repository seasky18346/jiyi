import React, { useState, useEffect } from 'react';

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch('/api/statistics');
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error(err);
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
        <p style={{ marginTop: '1rem' }}>正在加载你的复习大盘状态...</p>
      </div>
    );
  }

  if (!stats) return null;

  const total = stats.totalQuestions || 1;
  const masteredCount = (stats.levelDistribution[4] || 0) + (stats.levelDistribution[5] || 0);
  const masteredPercentage = Math.round((masteredCount / total) * 100);

  // Circle progress calculation
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (masteredPercentage / 100) * circumference;

  const countdown = getExamCountdown();

  return (
    <div className="dashboard-view animate-fade">
      <div className="section-title">
        <span>📊 背诵状态大盘</span>
      </div>
      
      <div className="dashboard-grid">
        {/* Left Side: Stats and Info */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Main counts */}
          <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            <div className="glass-panel stat-card primary-stat" style={{ padding: '0.75rem' }}>
              <div className="stat-label">总知识数</div>
              <div className="stat-number" style={{ fontSize: '1.5rem' }}>{stats.totalQuestions}</div>
            </div>
            <div className="glass-panel stat-card" style={{ padding: '0.75rem' }}>
              <div className="stat-label">待复习题</div>
              <div className="stat-number" style={{ color: 'var(--warning)', fontSize: '1.5rem' }}>{stats.remainingReviewsToday}</div>
            </div>
            <div className="glass-panel stat-card" style={{ padding: '0.75rem' }}>
              <div className="stat-label">今日完成</div>
              <div className="stat-number" style={{ color: 'var(--success)', fontSize: '1.5rem' }}>{stats.completedToday}</div>
            </div>
            <div className="glass-panel stat-card" style={{ padding: '0.75rem' }}>
              <div className="stat-label">已背诵</div>
              <div className="stat-number" style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>{stats.learnedQuestions}</div>
            </div>
          </div>

          {/* Progress Circular & Exam Countdown */}
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            
            {/* Progress Circular */}
            <div className="progress-container glass-panel" style={{ position: 'relative', width: '150px', height: '150px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <svg className="progress-circle-svg" width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
                <defs>
                  <linearGradient id="cyan-violet-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--primary)" />
                    <stop offset="100%" stopColor="var(--secondary)" />
                  </linearGradient>
                </defs>
                <circle className="progress-circle-bg" cx="60" cy="60" r={radius} strokeWidth="8" style={{ fill: 'none', stroke: 'rgba(255,255,255,0.03)' }} />
                <circle 
                  className="progress-circle-bar" 
                  cx="60" 
                  cy="60" 
                  r={radius} 
                  strokeWidth="8" 
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  style={{ fill: 'none', stroke: 'url(#cyan-violet-grad)', transition: 'stroke-dashoffset 0.5s ease' }}
                />
              </svg>
              <div className="progress-text-overlay" style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span className="progress-percentage" style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'var(--font-display)' }}>{masteredPercentage}%</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>掌握率 (Box 4-5)</span>
              </div>
            </div>

            {/* Countdown and info */}
            <div style={{ flex: 1, minWidth: '180px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '0.3rem', fontSize: '1.1rem' }}>
                📅 2027 考研冲刺倒计时
              </h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: '900', color: countdown < 50 ? 'var(--danger)' : 'var(--primary)', fontFamily: 'var(--font-display)' }}>
                  {countdown}
                </span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>天</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.4', marginTop: '0.2rem' }}>
                考研非一日之功，利用系统安排好的间隔重复算法，磨平你的专业课核心弱点，稳定提升作答均分！
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Quick Actions & Boxes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Quick Actions */}
          <div className="glass-panel quick-start-panel" style={{ padding: '1rem' }}>
            <div className="section-title" style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
              <span>⚡ 学习导航</span>
            </div>
            <div className="quick-actions-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              
              <button className="action-btn-large" onClick={() => onNavigate('today-review')} style={{ padding: '0.6rem' }}>
                <div className="action-icon-wrapper" style={{ fontSize: '1.25rem' }}>🚀</div>
                <div className="action-details" style={{ textAlign: 'left' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: '600' }}>进入今日复习 (主动回忆)</h4>
                  <p style={{ fontSize: '0.75rem' }}>标准题目显示、大模型语义阅卷打分、显示得分点缺陷</p>
                </div>
              </button>
              
              <button className="action-btn-large" onClick={() => onNavigate('recite')} style={{ padding: '0.6rem' }}>
                <div className="action-icon-wrapper" style={{ fontSize: '1.25rem' }}>📖</div>
                <div className="action-details" style={{ textAlign: 'left' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: '600' }}>进入卡片背诵 (概念自评)</h4>
                  <p style={{ fontSize: '0.75rem' }}>卡片翻转自评、关键词隐藏遮罩、TTS 语音带背模式</p>
                </div>
              </button>

              <button className="action-btn-large" onClick={() => onNavigate('stats')} style={{ padding: '0.6rem' }}>
                <div className="action-icon-wrapper" style={{ fontSize: '1.25rem' }}>🔍</div>
                <div className="action-details" style={{ textAlign: 'left' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: '600' }}>查看盲区与弱点分析</h4>
                  <p style={{ fontSize: '0.75rem' }}>高频错误考点追踪、学习统计趋势、最薄弱模块分析</p>
                </div>
              </button>

              <button className="action-btn-large" onClick={() => onNavigate('editor')} style={{ padding: '0.6rem' }}>
                <div className="action-icon-wrapper" style={{ fontSize: '1.25rem' }}>✏️</div>
                <div className="action-details" style={{ textAlign: 'left' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: '600' }}>管理专业课知识库</h4>
                  <p style={{ fontSize: '0.75rem' }}>新增及编辑题目、导入大纲 Markdown/JSON、导出数据</p>
                </div>
              </button>
            </div>
          </div>

          {/* Leitner Box details */}
          <div className="glass-panel leitner-status-panel" style={{ padding: '1rem' }}>
            <div className="section-title" style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
              <span>📦 记忆盒子卡片分布</span>
            </div>
            <div className="leitner-boxes-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {[
                { box: 1, name: 'Box 1 (每天复习 - 完全不会)', count: stats.levelDistribution[1] || 0, color: 'var(--danger)' },
                { box: 2, name: 'Box 2 (每2天复习 - 模糊印象)', count: stats.levelDistribution[2] || 0, color: 'var(--warning)' },
                { box: 3, name: 'Box 3 (每4天复习 - 基本会)', count: stats.levelDistribution[3] || 0, color: 'var(--info)' },
                { box: 4, name: 'Box 4 (每7天复习 - 熟练掌握)', count: stats.levelDistribution[4] || 0, color: 'var(--success)' },
                { box: 5, name: 'Box 5 (已完全掌握 - 长期熟记)', count: stats.levelDistribution[5] || 0, color: 'var(--secondary)' },
              ].map(b => (
                <div key={b.box} className={`leitner-box-item ${b.count > 0 ? 'active-box' : ''}`} style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}>
                  <div className="leitner-box-info" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="leitner-box-num" style={{ 
                      backgroundColor: b.count > 0 ? b.color : 'rgba(255,255,255,0.03)',
                      color: b.count > 0 ? '#fff' : 'var(--text-muted)',
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: '700'
                    }}>{b.box}</span>
                    <span className="leitner-box-name">{b.name}</span>
                  </div>
                  <span className="leitner-box-count">{b.count} 个</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
