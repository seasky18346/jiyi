import React, { useState } from 'react';
import { 
  BarChart2, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  BookOpen, 
  Layers, 
  RefreshCw, 
  Sparkles, 
  Flame, 
  Award,
  Zap,
  Activity,
  ArrowRight,
  HelpCircle
} from 'lucide-react';

export default function StatsView({ reviewsData }) {
  const stats = reviewsData?.stats;
  const loading = reviewsData?.loading;
  const [togglingId, setTogglingId] = useState(null);

  if (loading) {
    return (
      <div className="glass-panel animate-pulse" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
          正在诊断考点掌握程度与 AI 盲区对账单...
        </p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
        <HelpCircle size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>暂无诊断数据，请先开始背诵复习。</p>
        <button 
          className="text-btn primary-btn" 
          onClick={() => reviewsData?.fetchReviews()}
          style={{ marginTop: '1.5rem', padding: '0.5rem 1.5rem' }}
        >
          🔄 重新加载
        </button>
      </div>
    );
  }

  // Helper to check if a card is in the weak (error reinforcement) queue
  const isWeakCard = (questionId) => {
    return reviewsData?.reviews?.errorReinforcement?.some(r => r.id === questionId);
  };

  // Toggle weak card status directly from stats
  const handleToggleWeak = async (questionId, currentWeak) => {
    setTogglingId(questionId);
    try {
      const res = await fetch('/api/history/toggle-weak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, forceWeak: !currentWeak })
      });
      const data = await res.json();
      if (data.success) {
        if (reviewsData && reviewsData.fetchReviews) {
          await reviewsData.fetchReviews();
        }
      } else {
        await window.customAlert('更新薄弱状态失败: ' + data.message);
      }
    } catch (err) {
      console.error('Failed to toggle weak card from stats view:', err);
      await window.customAlert('网络连接请求出错。');
    } finally {
      setTogglingId(null);
    }
  };

  // Leitner level configurations
  const levelNames = {
    0: { name: 'Box 0 未学习', desc: '新入库尚未背过的概念', color: 'var(--text-muted)' },
    1: { name: 'Box 1 遗忘重置', desc: '刚开始背或错题重温', color: 'var(--danger)' },
    2: { name: 'Box 2 模糊印象', desc: '能大概想起但漏掉核心点', color: 'var(--warning)' },
    3: { name: 'Box 3 基本会背', desc: '能背出大部分得分点', color: 'var(--info)' },
    4: { name: 'Box 4 熟练掌握', desc: '无遗漏回忆，回答流利', color: 'var(--success)' },
    5: { name: 'Box 5 长期保留', desc: '安排极长复习周期', color: 'var(--secondary)' }
  };

  // Calculate overall mastery percentage
  const totalCount = stats.totalQuestions || 1;
  const masteredCount = Object.entries(stats.levelDistribution || {})
    .filter(([level]) => parseInt(level) >= 4)
    .reduce((sum, [, count]) => sum + count, 0);
  const masteryPercentage = Math.round((masteredCount / totalCount) * 100);

  // Formatter for relative time
  const formatRelativeTime = (timeStr) => {
    if (!timeStr) return '已到期';
    const nextTime = new Date(timeStr);
    const now = new Date();
    const diffMs = nextTime - now;
    if (diffMs <= 0) return '已到期';
    
    const diffMins = Math.ceil(diffMs / (1000 * 60));
    if (diffMins < 60) return `${diffMins} 分钟后`;
    
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    if (diffHours < 24) return `${diffHours} 小时后`;
    
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return `${diffDays} 天后`;
  };

  return (
    <div className="stats-view-container animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart2 style={{ color: 'var(--primary)' }} /> 
            长期记忆与学习诊断看板
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            基于艾宾浩斯遗忘曲线和 AI 阅卷明细自动生成的考研专业课多维记忆诊断系统。
          </p>
        </div>
        <button 
          className="text-btn" 
          style={{ padding: '0.5rem 1.25rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          onClick={() => reviewsData?.fetchReviews()}
        >
          <RefreshCw size={14} className={reviewsData.loading ? 'animate-spin' : ''} />
          刷新多维诊断
        </button>
      </div>

      {/* 💡 智能复习决策建议 Banner */}
      <div className="glass-panel" style={{ 
        padding: '1.25rem 1.5rem', 
        background: 'linear-gradient(135deg, rgba(0, 210, 255, 0.08) 0%, rgba(139, 92, 246, 0.05) 100%)', 
        borderColor: 'rgba(0, 210, 255, 0.25)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '1.25rem' 
      }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{ 
            background: 'var(--primary-glow)', 
            padding: '0.6rem', 
            borderRadius: '12px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(0, 210, 255, 0.2)'
          }}>
            <Sparkles size={20} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <h4 style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              今日备考复习决策建议
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.3rem', lineHeight: '1.4' }}>
              当前全库记忆掌握率：<strong style={{ color: 'var(--success)' }}>{masteryPercentage}%</strong>
              <span style={{ margin: '0 0.5rem', color: 'rgba(255,255,255,0.15)' }}>|</span>
              已背诵启动卡片占总库比：<strong style={{ color: 'var(--primary)' }}>{stats.totalQuestions > 0 ? Math.round((stats.learnedQuestions / stats.totalQuestions) * 100) : 0}%</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel stat-card" style={{ padding: '1.25rem' }}>
          <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>全库概念数</div>
          <div className="stat-number" style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: '800', marginTop: '0.25rem' }}>
            {stats.totalQuestions}
          </div>
        </div>
        <div className="glass-panel stat-card" style={{ borderLeft: '3px solid var(--primary)', padding: '1.25rem' }}>
          <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>已启动背诵</div>
          <div className="stat-number" style={{ color: 'var(--primary)', fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: '800', marginTop: '0.25rem' }}>
            {stats.learnedQuestions}
          </div>
        </div>
        <div className="glass-panel stat-card" style={{ borderLeft: '3px solid var(--success)', padding: '1.25rem' }}>
          <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>今日已做</div>
          <div className="stat-number" style={{ color: 'var(--success)', fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: '800', marginTop: '0.25rem' }}>
            {stats.completedToday}
          </div>
        </div>
        <div className="glass-panel stat-card" style={{ borderLeft: '3px solid var(--warning)', padding: '1.25rem' }}>
          <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>待温故总数</div>
          <div className="stat-number" style={{ color: 'var(--warning)', fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: '800', marginTop: '0.25rem' }}>
            {stats.remainingReviewsToday}
          </div>
        </div>
        <div className="glass-panel stat-card" style={{ borderLeft: '3px solid var(--secondary)', padding: '1.25rem' }}>
          <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>默写平均分</div>
          <div className="stat-number" style={{ color: 'var(--secondary)', fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: '800', marginTop: '0.25rem' }}>
            {stats.averageScore} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/ 10</span>
          </div>
        </div>
        <div className="glass-panel stat-card" style={{ borderLeft: '3px solid var(--danger)', padding: '1.25rem' }}>
          <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>累计错题次数</div>
          <div className="stat-number" style={{ color: 'var(--danger)', fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: '800', marginTop: '0.25rem' }}>
            {stats.totalErrors}
          </div>
        </div>
      </div>

      {/* Grid: Mastery Levels & AI Error Mode Summary */}
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        
        {/* Mastery Distribution */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Layers size={18} style={{ color: 'var(--primary)' }} />
            Leitner 遗忘盒子掌握度分布
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {Object.keys(levelNames).map(lvlKey => {
              const lvl = parseInt(lvlKey);
              const count = stats.levelDistribution?.[lvl] || 0;
              const barPercentage = stats.totalQuestions > 0 ? Math.round((count / stats.totalQuestions) * 100) : 0;
              
              return (
                <div key={lvl} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <div>
                      <span style={{ fontWeight: '700', color: levelNames[lvl].color, marginRight: '0.5rem' }}>
                        {levelNames[lvl].name}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        ({levelNames[lvl].desc})
                      </span>
                    </div>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>
                      {count} 题 ({barPercentage}%)
                    </span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.02)' }}>
                    <div style={{ 
                      width: `${barPercentage}%`, 
                      height: '100%', 
                      background: levelNames[lvl].color,
                      borderRadius: '10px',
                      boxShadow: `0 0 10px ${levelNames[lvl].color}55`,
                      transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Error Mode Summary */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', color: 'var(--primary)', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Sparkles size={18} style={{ color: 'var(--primary)' }} />
            AI 阅卷扣分点与高频遗漏分析 (Top 5)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {stats.aiCommonMistakes && stats.aiCommonMistakes.length > 0 ? (
              stats.aiCommonMistakes.map((m, idx) => {
                const maxCount = stats.aiCommonMistakes[0]?.count || 1;
                const progressWidth = Math.round((m.count / maxCount) * 100);
                
                return (
                  <div key={idx} style={{ 
                    padding: '0.75rem 1rem', 
                    background: 'rgba(255,255,255,0.01)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {/* Background indicator bar */}
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${progressWidth}%`,
                      background: 'rgba(0, 210, 255, 0.03)',
                      zIndex: 0,
                      pointerEvents: 'none'
                    }}></div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', minWidth: 0 }}>
                        <span style={{ 
                          fontSize: '0.7rem', 
                          fontWeight: '800', 
                          color: '#fff', 
                          background: 'rgba(255,255,255,0.08)',
                          borderRadius: '4px',
                          width: '18px',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {idx + 1}
                        </span>
                        <span style={{ 
                          fontWeight: '600', 
                          color: 'var(--text-primary)', 
                          fontSize: '0.85rem',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap'
                        }} title={m.point}>
                          {m.point}
                        </span>
                      </div>
                      <span style={{ 
                        color: 'var(--primary)', 
                        fontSize: '0.75rem', 
                        fontWeight: '800', 
                        whiteSpace: 'nowrap',
                        background: 'rgba(0, 210, 255, 0.08)',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(0, 210, 255, 0.15)'
                      }}>
                        累计遗漏 {m.count} 次
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '4rem 1rem', 
                color: 'var(--text-muted)', 
                fontSize: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <CheckCircle size={32} style={{ color: 'var(--success)' }} />
                <span>暂无 AI 阅卷遗漏点数据。</span>
                <span style={{ fontSize: '0.75rem' }}>自测提交AI评阅后，漏答的细节得分点会自动在此聚类分析。</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Grid: High frequency error list & Upcoming timeline */}
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        
        {/* Top 10 Hardest Questions & Weak Oven Toggle */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--danger)', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Flame size={18} style={{ color: 'var(--danger)' }} />
              高频错题攻坚与回炉管理 (Top 10)
            </h3>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              点击闪电标记可直接干预
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '380px', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {stats.top10Hardest && stats.top10Hardest.length > 0 ? (
              stats.top10Hardest.map((q, idx) => {
                const activeWeak = isWeakCard(q.id);
                const isToggling = togglingId === q.id;

                return (
                  <div 
                    key={q.id} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '0.75rem', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.01)',
                      fontSize: '0.85rem',
                      gap: '0.75rem',
                      transition: 'border-color var(--transition-fast)'
                    }}
                    className="hard-question-row"
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: '700', fontSize: '0.75rem' }}>#{idx+1}</span>
                        <span style={{ 
                          fontSize: '0.65rem', 
                          background: 'rgba(239, 68, 68, 0.08)', 
                          color: 'var(--danger)', 
                          padding: '0.05rem 0.35rem', 
                          borderRadius: '4px',
                          fontWeight: '600'
                        }}>
                          错误 {q.error_count} 次
                        </span>
                        <span style={{ 
                          fontSize: '0.65rem', 
                          background: 'rgba(255, 255, 255, 0.03)', 
                          color: 'var(--text-secondary)', 
                          padding: '0.05rem 0.35rem', 
                          borderRadius: '4px'
                        }}>
                          均分 {parseFloat(q.average_score || 0).toFixed(1)}
                        </span>
                      </div>
                      <div style={{ 
                        fontWeight: '600', 
                        color: 'var(--text-primary)',
                        textOverflow: 'ellipsis', 
                        overflow: 'hidden', 
                        whiteSpace: 'nowrap' 
                      }}>
                        {q.question}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => handleToggleWeak(q.id, activeWeak)}
                      style={{
                        background: activeWeak ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${activeWeak ? 'var(--warning)' : 'var(--border-color)'}`,
                        color: activeWeak ? 'var(--warning)' : 'var(--text-muted)',
                        padding: '0.4rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all var(--transition-fast)',
                        position: 'relative'
                      }}
                      title={activeWeak ? "点击将此题从错题回炉中移出" : "强制将此题拉回今日复习包 (错题回炉)"}
                    >
                      {isToggling ? (
                        <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '1px', margin: 0 }}></div>
                      ) : (
                        <Zap size={14} fill={activeWeak ? 'currentColor' : 'none'} />
                      )}
                    </button>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                暂无高频错误题目。
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Reviews Timeline */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', color: 'var(--primary)', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={18} style={{ color: 'var(--primary)' }} />
            温故知新：即将遗忘复习轴 (前 5)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
            {stats.upcomingForgotten && stats.upcomingForgotten.length > 0 ? (
              stats.upcomingForgotten.map((q, idx) => {
                const isOverdue = q.next_review_time ? new Date(q.next_review_time) <= new Date() : true;
                const timeRelative = formatRelativeTime(q.next_review_time);
                
                return (
                  <div key={q.id} style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
                    {/* Vertical line indicator */}
                    {idx < 4 && (
                      <div style={{
                        position: 'absolute',
                        left: '9px',
                        top: '20px',
                        bottom: '-20px',
                        width: '2px',
                        background: 'rgba(255,255,255,0.05)',
                        zIndex: 0
                      }}></div>
                    )}
                    
                    {/* Time node circle */}
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: isOverdue ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 210, 255, 0.15)',
                      border: `2px solid ${isOverdue ? 'var(--danger)' : 'var(--primary)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1,
                      marginTop: '2px'
                    }}>
                      <div style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: isOverdue ? 'var(--danger)' : 'var(--primary)'
                      }}></div>
                    </div>

                    <div style={{ flex: 1, minWidth: 0, paddingBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.15rem' }}>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: '800', 
                          color: isOverdue ? 'var(--danger)' : 'var(--primary)' 
                        }}>
                          {timeRelative}
                        </span>
                        <span style={{ 
                          fontSize: '0.65rem', 
                          background: 'rgba(255,255,255,0.04)', 
                          color: 'var(--text-secondary)',
                          padding: '0.05rem 0.35rem',
                          borderRadius: '4px',
                          fontWeight: '700'
                        }}>
                          Leitner Box {q.mastery_level}
                        </span>
                      </div>
                      <div style={{ 
                        fontSize: '0.85rem', 
                        color: 'var(--text-primary)', 
                        fontWeight: '500',
                        textOverflow: 'ellipsis', 
                        overflow: 'hidden', 
                        whiteSpace: 'nowrap'
                      }} title={q.question}>
                        {q.question}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)', fontSize: '0.85rem', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                您的遗忘盒子空空如也，请先开始学习新卡片。
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Grid: 7-Days Trend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* 7 Days Trend Table */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Activity size={18} style={{ color: 'var(--primary)' }} />
            近 7 天背诵负荷与效率趋势
          </h3>
          <div style={{ flex: 1, overflowX: 'auto' }}>
            {stats.last7DaysActivity && stats.last7DaysActivity.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.6rem 0.5rem' }}>日期</th>
                    <th style={{ padding: '0.6rem 0.5rem' }}>背诵强度</th>
                    <th style={{ padding: '0.6rem 0.5rem' }}>日均得分</th>
                    <th style={{ padding: '0.6rem 0.5rem' }}>状态评估</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.last7DaysActivity.map((day, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '0.6rem 0.5rem', fontWeight: '600', color: 'var(--text-primary)' }}>{day.date}</td>
                      <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-secondary)' }}>{day.count} 次作答</td>
                      <td style={{ padding: '0.6rem 0.5rem', color: 'var(--primary)', fontWeight: '700' }}>
                        {parseFloat(day.avg_score || 0).toFixed(1)} 分
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem' }}>
                        <span style={{ 
                          fontSize: '0.7rem', 
                          padding: '0.15rem 0.4rem', 
                          borderRadius: '4px',
                          backgroundColor: day.count > 10 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(0, 210, 255, 0.08)',
                          color: day.count > 10 ? 'var(--success)' : 'var(--primary)',
                          fontWeight: '700'
                        }}>
                          {day.count > 10 ? '高强冲刺' : '稳步巩固'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                暂无背诵趋势记录。
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
