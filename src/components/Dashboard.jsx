import React from 'react';

export default function Dashboard({ recitationData, progress, onNavigate }) {
  // Calculations
  const allItems = recitationData.flatMap(g => g.items) || [];
  const totalConcepts = allItems.reduce((acc, item) => acc + (item.points ? item.points.length : 0), 0);
  
  const cardStatus = progress?.cardStatus || {};
  
  // Leitner Boxes counts
  const boxCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let masteredCount = 0;
  let inProgressCount = 0;
  
  allItems.forEach(item => {
    if (item.points) {
      item.points.forEach(p => {
        const status = cardStatus[p.id];
        if (status) {
          const box = status.box || 1;
          boxCounts[box] = (boxCounts[box] || 0) + 1;
          if (box >= 4) {
            masteredCount++;
          } else {
            inProgressCount++;
          }
        }
      });
    }
  });

  const unlearnedCount = totalConcepts - (masteredCount + inProgressCount);
  const masteredPercentage = totalConcepts > 0 ? Math.round((masteredCount / totalConcepts) * 100) : 0;
  
  // Circle progress calculation
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (masteredPercentage / 100) * circumference;

  return (
    <div className="dashboard-view animate-fade">
      <div className="section-title">
        <span>📊 背诵状态大盘</span>
      </div>
      
      <div className="dashboard-grid">
        {/* Left Side: Stats and Info */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div className="stats-row">
            <div className="glass-panel stat-card primary-stat">
              <div className="stat-label">总概念数</div>
              <div className="stat-number">{totalConcepts}</div>
            </div>
            <div className="glass-panel stat-card">
              <div className="stat-label">已掌握 (Box 4-5)</div>
              <div className="stat-number" style={{ color: 'var(--success)' }}>{masteredCount}</div>
            </div>
            <div className="glass-panel stat-card">
              <div className="stat-label">学习中 (Box 1-3)</div>
              <div className="stat-number" style={{ color: 'var(--primary)' }}>{inProgressCount}</div>
            </div>
            <div className="glass-panel stat-card">
              <div className="stat-label">未学习</div>
              <div className="stat-number" style={{ color: 'var(--text-muted)' }}>{unlearnedCount}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Progress Circular */}
            <div className="progress-container glass-panel" style={{ position: 'relative', width: '180px', height: '180px' }}>
              <svg className="progress-circle-svg" width="140" height="140">
                <defs>
                  <linearGradient id="cyan-violet-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--primary)" />
                    <stop offset="100%" stopColor="var(--secondary)" />
                  </linearGradient>
                </defs>
                <circle className="progress-circle-bg" cx="70" cy="70" r={radius} strokeWidth="10" />
                <circle 
                  className="progress-circle-bar" 
                  cx="70" 
                  cy="70" 
                  r={radius} 
                  strokeWidth="10" 
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                />
              </svg>
              <div className="progress-text-overlay">
                <span className="progress-percentage">{masteredPercentage}%</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>掌握率</span>
              </div>
            </div>

            {/* Explanatory notes */}
            <div style={{ flex: 1, minWidth: '200px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '0.5rem' }}>考研倒计时复习</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                本系统基于<strong>莱特纳 (Leitner) 卡片盒系统</strong>，通过记忆反馈自动为您安排复习频率。
                建议每天完成“检测模式”以评估弱项，并利用“语音带背”加深磨平记忆。
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Quick Actions & Boxes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel quick-start-panel">
            <div className="section-title" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
              <span>⚡ 快速开始</span>
            </div>
            <div className="quick-actions-list">
              <button className="action-btn-large" onClick={() => onNavigate('recite')}>
                <div className="action-icon-wrapper">📖</div>
                <div className="action-details">
                  <h4>进入背诵模式</h4>
                  <p>卡片翻转自评、关键词遮罩、TTS语音带背</p>
                </div>
              </button>
              
              <button className="action-btn-large" onClick={() => onNavigate('test')}>
                <div className="action-icon-wrapper">📝</div>
                <div className="action-details">
                  <h4>进入检测模式</h4>
                  <p>挖空填空、AI 语义评分概念默写</p>
                </div>
              </button>

              <button className="action-btn-large" onClick={() => onNavigate('editor')}>
                <div className="action-icon-wrapper">⚙️</div>
                <div className="action-details">
                  <h4>管理知识库</h4>
                  <p>编辑每日背诵词条，直接修改本地文件</p>
                </div>
              </button>
            </div>
          </div>

          {/* Leitner Box details */}
          <div className="glass-panel leitner-status-panel">
            <div className="section-title" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
              <span>📦 记忆卡片盒分布</span>
            </div>
            <div className="leitner-boxes-list">
              {[
                { box: 1, name: '卡片盒 1 (每天复习)', color: 'var(--danger)' },
                { box: 2, name: '卡片盒 2 (每2天复习)', color: 'var(--warning)' },
                { box: 3, name: '卡片盒 3 (每4天复习)', color: 'var(--info)' },
                { box: 4, name: '卡片盒 4 (每7天复习)', color: 'var(--success)' },
                { box: 5, name: '卡片盒 5 (已完全掌握)', color: 'var(--secondary)' },
              ].map(b => (
                <div key={b.box} className={`leitner-box-item ${boxCounts[b.box] > 0 ? 'active-box' : ''}`}>
                  <div className="leitner-box-info">
                    <span className="leitner-box-num" style={boxCounts[b.box] > 0 ? { backgroundColor: b.color } : {}}>{b.box}</span>
                    <span className="leitner-box-name">{b.name}</span>
                  </div>
                  <span className="leitner-box-count">{boxCounts[b.box] || 0} 个</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
