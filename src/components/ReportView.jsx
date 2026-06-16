import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Search, Filter, Calendar, BookOpen, AlertTriangle, ArrowRight, Eye, RefreshCcw } from 'lucide-react';

export default function ReportView({ onStartPractice, reviewsData }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search/Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [scoreFilter, setScoreFilter] = useState('all'); // 'all', 'high', 'pass', 'fail'
  
  // Selected attempt details modal
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      if (data.success) {
        setHistory(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch history logs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter history list
  const filteredHistory = history.filter(h => {
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const matchTitle = (h.question || '').toLowerCase().includes(term);
      const matchAnswer = (h.full_answer_input || '').toLowerCase().includes(term);
      if (!matchTitle && !matchAnswer) return false;
    }
    if (scoreFilter !== 'all') {
      const score = parseFloat(h.total_score || 0);
      if (scoreFilter === 'high' && score < 8) return false;
      if (scoreFilter === 'pass' && (score < 5 || score >= 8)) return false;
      if (scoreFilter === 'fail' && score >= 5) return false;
    }
    return true;
  });

  // Toggle card in error reinforcement queue
  const handleToggleWeak = async (questionId, forceWeak) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/history/toggle-weak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, forceWeak })
      });
      const data = await res.json();
      if (data.success) {
        await window.customAlert(
          forceWeak 
            ? '已成功将此考点重新标记为薄弱点，即刻排入“错题回炉”复习队列！' 
            : '已将此考点移出“错题回炉”队列，间隔已重置为正常状态。'
        );
        if (reviewsData && reviewsData.fetchReviews) {
          await reviewsData.fetchReviews();
        }
      } else {
        await window.customAlert('错题回炉更新失败: ' + data.message);
      }
    } catch (err) {
      console.error(err);
      await window.customAlert('网络连接请求出错。');
    } finally {
      setActionLoading(false);
    }
  };

  const getScoreColor = (score) => {
    const s = parseFloat(score || 0);
    if (s >= 8) return 'var(--success)';
    if (s >= 5) return 'var(--info)';
    return 'var(--danger)';
  };

  const parseAiFeedback = (attempt) => {
    if (!attempt || !attempt.ai_feedback) return null;
    try {
      const parsed = typeof attempt.ai_feedback === 'string' 
        ? JSON.parse(attempt.ai_feedback) 
        : attempt.ai_feedback;
      return parsed.full_evaluation || parsed.result?.full_evaluation || parsed;
    } catch (e) {
      return null;
    }
  };

  const parseClozeAnswers = (attempt) => {
    if (!attempt || !attempt.cloze_answers) return {};
    try {
      return typeof attempt.cloze_answers === 'string' 
        ? JSON.parse(attempt.cloze_answers) 
        : attempt.cloze_answers;
    } catch (e) {
      return {};
    }
  };

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>正在汇总您的作答轨迹与 AI 阅卷对账单...</p>
      </div>
    );
  }

  return (
    <div className="report-view-container animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Page Header */}
      <div className="glass-panel" style={{ padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: '800' }}>📊 综合考评阅卷系统</h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '0.9rem' }}>
          在这里，您可以回溯自系统创建以来的每一次作答记录，对照“标准答案”与“自己当时的作答”，查看 AI 点评并一键回炉重背。
        </p>
      </div>

      {/* Filter panel */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '1rem', flex: 1, minWidth: '280px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              className="form-input-text"
              placeholder="搜索考点题目或当时作答..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: '0.5rem 1rem 0.5rem 2.2rem', fontSize: '0.85rem' }}
            />
            <Search size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>

          <select
            className="form-input-text"
            value={scoreFilter}
            onChange={(e) => setScoreFilter(e.target.value)}
            style={{ width: '130px', padding: '0.5rem', fontSize: '0.85rem', height: 'auto', cursor: 'pointer' }}
          >
            <option value="all">🎯 全部成绩</option>
            <option value="high">🟢 优秀 (≥8分)</option>
            <option value="pass">🔵 合格 (5-7分)</option>
            <option value="fail">🔴 不及格 (&lt;5分)</option>
          </select>
        </div>

        <button
          type="button"
          onClick={fetchHistory}
          className="text-btn"
          style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <RefreshCcw size={14} />
          刷新列表
        </button>
      </div>

      {/* History attempts list */}
      {filteredHistory.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredHistory.map((h) => {
            const aiReport = parseAiFeedback(h);
            const isWeak = reviewsData?.reviews?.errorReinforcement?.some(r => r.id === h.question_id);
            const scoreColor = getScoreColor(h.total_score);
            const dateStr = new Date(h.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={h.id}
                onClick={() => setSelectedAttempt(h)}
                className="glass-panel"
                style={{
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  borderLeft: `4px solid ${scoreColor}`,
                  background: 'rgba(255,255,255,0.01)',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'}
              >
                <div style={{ flex: 1, minWidth: 0, marginRight: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      ⏱️ {dateStr}
                    </span>
                    <span style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(255,255,255,0.04)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {h.chapter || '未分类'}
                    </span>
                    {isWeak && (
                      <span style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', fontSize: '0.65rem', fontWeight: 'bold' }}>
                        错题回炉中
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: '0.95rem', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {h.question}
                  </h3>

                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    作答记录: {h.full_answer_input ? h.full_answer_input.trim() : '（未作答论述）'}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: '800', color: scoreColor, fontFamily: 'var(--font-display)' }}>
                      {parseFloat(h.total_score).toFixed(0)} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>分</span>
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {aiReport?.level || (parseFloat(h.total_score) >= 8 ? '良好自评' : '待强化')}
                    </span>
                  </div>
                  <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          🫙 暂无符合条件的历次作答对账单。
        </div>
      )}

      {/* Attempt Details Modal Overlay */}
      {selectedAttempt && (
        <div className="overlay-modal-container" onClick={() => setSelectedAttempt(null)}>
          <div className="overlay-modal glass-panel" style={{ maxWidth: '750px', width: '90%', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            
            <div className="modal-header" style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem' }}>📄 历史作答分析报告</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  测验时间: {new Date(selectedAttempt.created_at).toLocaleString()}
                </span>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedAttempt(null)}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Question card */}
              <div className="glass-panel" style={{ padding: '1rem 1.25rem', background: 'rgba(0,0,0,0.1)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                  {selectedAttempt.chapter || '未分类'}
                </span>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginTop: '0.2rem', lineHeight: '1.4' }}>
                  {selectedAttempt.question}
                </h4>
              </div>

              {/* Score summary row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', textAlign: 'center' }}>
                <div className="glass-panel" style={{ padding: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>填空得分</span>
                  <div style={{ fontSize: '1.05rem', fontWeight: 'bold', marginTop: '0.15rem' }}>
                    {selectedAttempt.cloze_score !== null ? `${parseFloat(selectedAttempt.cloze_score).toFixed(0)} / 10` : '--'}
                  </div>
                </div>
                <div className="glass-panel" style={{ padding: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>论述得分</span>
                  <div style={{ fontSize: '1.05rem', fontWeight: 'bold', marginTop: '0.15rem' }}>
                    {selectedAttempt.full_score !== null ? `${parseFloat(selectedAttempt.full_score).toFixed(0)} / 10` : '--'}
                  </div>
                </div>
                <div className="glass-panel" style={{ padding: '0.5rem', borderColor: getScoreColor(selectedAttempt.total_score) }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>综合得分</span>
                  <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: getScoreColor(selectedAttempt.total_score), marginTop: '0.15rem' }}>
                    {parseFloat(selectedAttempt.total_score).toFixed(0)} / 10
                  </div>
                </div>
              </div>

              {/* User answer vs Standard Answer */}
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>✍️ 当时真实默写：</span>
                <div style={{ 
                  padding: '0.75rem 1rem', 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  border: '1px dashed rgba(255, 255, 255, 0.1)', 
                  borderRadius: '6px', 
                  fontSize: '0.85rem', 
                  whiteSpace: 'pre-line', 
                  lineHeight: '1.5',
                  color: 'var(--text-secondary)',
                  marginTop: '0.3rem'
                }}>
                  {selectedAttempt.full_answer_input ? selectedAttempt.full_answer_input.trim() : '（未作答论述部分）'}
                </div>
              </div>

              {/* Standard Answer */}
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>📋 大纲参考标准答案：</span>
                <div style={{ 
                  padding: '0.75rem 1rem', 
                  background: 'rgba(0, 210, 255, 0.04)', 
                  border: '1px solid rgba(0, 210, 255, 0.15)',
                  borderRadius: '6px', 
                  fontSize: '0.85rem', 
                  whiteSpace: 'pre-line', 
                  lineHeight: '1.5',
                  marginTop: '0.3rem'
                }}>
                  {selectedAttempt.full_answer}
                </div>
              </div>

              {/* AI Details if present */}
              {(() => {
                const aiReport = parseAiFeedback(selectedAttempt);
                if (!aiReport) return null;
                return (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>🧠 AI 评阅分析对账单：</span>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="glass-panel" style={{ padding: '0.6rem', background: 'rgba(16, 185, 129, 0.02)', borderColor: 'rgba(16, 185, 129, 0.1)' }}>
                        <span style={{ color: 'var(--success)', fontSize: '0.75rem', fontWeight: 'bold' }}>🟢 阐述充分要点</span>
                        <ul style={{ paddingLeft: '1rem', fontSize: '0.75rem', marginTop: '0.3rem', lineHeight: '1.5' }}>
                          {aiReport.covered_points?.length > 0 ? (
                            aiReport.covered_points.map((p, i) => <li key={i}>{p}</li>)
                          ) : <li style={{ listStyle: 'none', color: 'var(--text-muted)' }}>无</li>}
                        </ul>
                      </div>
                      <div className="glass-panel" style={{ padding: '0.6rem', background: 'rgba(239, 68, 68, 0.02)', borderColor: 'rgba(239, 68, 68, 0.1)' }}>
                        <span style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 'bold' }}>🔴 遗漏或不够要点</span>
                        <ul style={{ paddingLeft: '1rem', fontSize: '0.75rem', marginTop: '0.3rem', lineHeight: '1.5' }}>
                          {aiReport.missing_points?.length > 0 ? (
                            aiReport.missing_points.map((p, i) => <li key={i}>{p}</li>)
                          ) : <li style={{ listStyle: 'none', color: 'var(--success)' }}>无遗漏</li>}
                        </ul>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem', lineHeight: '1.5' }}>
                      <strong>评阅短评：</strong>“ {aiReport.exam_comment || '无'} ”
                      <br />
                      <strong style={{ color: 'var(--primary)', display: 'block', marginTop: '0.3rem' }}>改进方向：{aiReport.suggestion || '无'}</strong>
                    </div>
                  </div>
                );
              })()}

              {/* Closed-loop controls */}
              {(() => {
                const isWeak = reviewsData?.reviews?.errorReinforcement?.some(r => r.id === selectedAttempt.question_id);
                return (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <div>
                      {isWeak ? (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleToggleWeak(selectedAttempt.question_id, false)}
                          className="text-btn"
                          style={{ padding: '0.5rem 1.25rem', fontSize: '0.8rem', color: 'var(--success)', borderColor: 'rgba(16,185,129,0.3)' }}
                        >
                          🟢 移出错题回炉
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleToggleWeak(selectedAttempt.question_id, true)}
                          className="text-btn"
                          style={{ padding: '0.5rem 1.25rem', fontSize: '0.8rem', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }}
                        >
                          🔄 一键加入错题回炉
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      className="text-btn primary-btn"
                      onClick={() => setSelectedAttempt(null)}
                      style={{ padding: '0.5rem 1.5rem', fontSize: '0.8rem' }}
                    >
                      关闭报告
                    </button>
                  </div>
                );
              })()}

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
