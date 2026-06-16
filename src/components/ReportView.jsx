import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Search, Filter, Calendar, BookOpen, AlertTriangle, ArrowRight, Eye, RefreshCcw, Sparkles, CheckCircle2, Zap, ChevronRight } from 'lucide-react';

// --- Smart Cloze keyword filter ---
const shouldDigKeyword = (kw, questionTitle, clozeAnswer) => {
  if (!kw || typeof kw !== 'string') return false;
  const cleanStr = (s) => (s || '').toLowerCase().replace(/[\s\(\)（）\-\_\,\.\?\!\，\。等是：\:：；;\s]/g, '');
  const cleanKw = cleanStr(kw);
  const cleanTitle = cleanStr(questionTitle);
  
  if (cleanKw.length < 2) return false;
  if (cleanTitle.includes(cleanKw) || cleanKw.includes(cleanTitle)) {
    return false;
  }
  const kwIndex = clozeAnswer.toLowerCase().indexOf(kw.toLowerCase());
  if (kwIndex !== -1 && kwIndex < 20) {
    let commonChars = 0;
    for (const char of cleanKw) {
      if (cleanTitle.includes(char)) commonChars++;
    }
    if (commonChars / cleanKw.length > 0.5) {
      return false;
    }
  }
  if (kwIndex !== -1) {
    const startIdx = Math.max(0, kwIndex - 20);
    const precedingText = clozeAnswer.substring(startIdx, kwIndex);
    const hintRegex = /(核心定义|基本本质|主要包括|是指|概念|定义|本质|包括|即为|称为|简述)[：:\s是]*$/i;
    if (hintRegex.test(precedingText.trim())) {
      let commonChars = 0;
      for (const char of cleanKw) {
        if (cleanTitle.includes(char)) commonChars++;
      }
      if (commonChars / cleanKw.length > 0.4) {
        return false;
      }
    }
  }
  return true;
};

// --- Lenient grading verification ---
const isClozeAnswerCorrect = (userAns, standardKw) => {
  if (!userAns || !standardKw) return false;
  const cleanStr = (s) => s.toLowerCase().replace(/[\s\(\)（）\-\_\,\.\?\!\，\。等是：\:：；;\"\'“”‘’]/g, '');
  const u = cleanStr(userAns);
  const s = cleanStr(standardKw);
  if (!u || !s) return false;
  if (u === s) return true;
  if (u.length >= 2 && (s.includes(u) || u.includes(s))) {
    return true;
  }
  const SYNONYMS = [
    ["gis", "地理信息系统"],
    ["gps", "全球定位系统"],
    ["rs", "遥感"],
    ["空间", "地理空间"],
    ["属性", "非几何"],
    ["矢量", "向量"],
    ["栅格", "网格", "象元"],
    ["拓扑", "空间拓扑"],
    ["元数据", "metadata"],
    ["客户端", "client"],
    ["服务端", "server"],
    ["数据库", "db"]
  ];
  for (const group of SYNONYMS) {
    const stdMatches = group.some(item => s.includes(cleanStr(item)) || cleanStr(item).includes(s));
    const userMatches = group.some(item => u.includes(cleanStr(item)) || cleanStr(item).includes(u));
    if (stdMatches && userMatches) return true;
  }
  if (s.length >= 3) {
    let matchCount = 0;
    const sChars = s.split('');
    const uChars = u.split('');
    const matchedIndices = new Set();
    uChars.forEach(char => {
      const idx = sChars.findIndex((sChar, index) => sChar === char && !matchedIndices.has(index));
      if (idx !== -1) {
        matchCount++;
        matchedIndices.add(idx);
      }
    });
    const maxLen = Math.max(s.length, u.length);
    if (matchCount / maxLen >= 0.7) return true;
  }
  return false;
};

const getFilteredClozeParts = (questionTitle, clozeAnswer) => {
  const parts = (clozeAnswer || '').split(/(\*\*.*?\*\*)/);
  const processedParts = [];
  let dugCount = 0;
  
  parts.forEach((part) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const kw = part.slice(2, -2);
      const isValid = shouldDigKeyword(kw, questionTitle, clozeAnswer);
      if (isValid && dugCount < 5) {
        processedParts.push({
          type: 'blank',
          text: kw,
          inputKey: `kw_${dugCount}`
        });
        dugCount++;
      } else {
        processedParts.push({
          type: 'text',
          text: kw,
          isBold: true
        });
      }
    } else {
      processedParts.push({
        type: 'text',
        text: part,
        isBold: false
      });
    }
  });
  return { processedParts, dugCount };
};

const renderClozeText = (questionTitle, description, clozeAnswers) => {
  const { processedParts } = getFilteredClozeParts(questionTitle, description);
  return processedParts.map((part, index) => {
    if (part.type === 'blank') {
      const standardKw = part.text;
      const inputKey = part.inputKey;
      const userAnswer = (clozeAnswers[inputKey] || '').trim();
      const isCorrect = isClozeAnswerCorrect(userAnswer, standardKw);
      return (
        <span key={index} style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          margin: '0 4px', 
          padding: '0.15rem 0.4rem',
          borderRadius: '4px',
          background: isCorrect ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          color: isCorrect ? 'var(--success)' : 'var(--danger)',
          border: `1px solid ${isCorrect ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
          fontWeight: 'bold',
          fontSize: '0.85rem'
        }}>
          {userAnswer || '（空）'}
          {!isCorrect && (
            <span style={{ fontSize: '0.75rem', marginLeft: '4px', opacity: 0.85, fontWeight: 'normal' }}>
              ({standardKw})
            </span>
          )}
        </span>
      );
    }
    return part.isBold ? <strong key={index} style={{ color: 'var(--accent)' }}>{part.text}</strong> : <span key={index}>{part.text}</span>;
  });
};

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

              {/* Compute Cloze & Essay differences */}
              {(() => {
                const clozeAnswers = parseClozeAnswers(selectedAttempt);
                const { processedParts } = getFilteredClozeParts(selectedAttempt.question, selectedAttempt.cloze_answer);
                
                const clozeHits = [];
                const clozeMisses = [];
                processedParts.forEach(part => {
                  if (part.type === 'blank') {
                    const standardKw = part.text;
                    const userAnswer = (clozeAnswers[part.inputKey] || '').trim();
                    if (isClozeAnswerCorrect(userAnswer, standardKw)) {
                      clozeHits.push(standardKw);
                    } else {
                      clozeMisses.push(standardKw);
                    }
                  }
                });

                let essayPoints = selectedAttempt.full_score_points || [];
                if (typeof essayPoints === 'string') {
                  try {
                    essayPoints = JSON.parse(essayPoints);
                  } catch (e) {
                    essayPoints = [];
                  }
                }
                const localMatchedEssayPoints = [];
                const fullAnswerInput = selectedAttempt.full_answer_input || '';
                const cleanInput = fullAnswerInput.toLowerCase().trim();
                if (cleanInput) {
                  essayPoints.forEach(point => {
                    const cleanedPoint = point.toLowerCase();
                    const subsegments = cleanedPoint.split(/[,，().（）]/).filter(s => s.trim().length > 3);
                    const matched = subsegments.length > 0 
                      ? subsegments.some(sub => cleanInput.includes(sub.trim())) 
                      : cleanInput.includes(cleanedPoint);
                    if (matched) {
                      localMatchedEssayPoints.push(point);
                    }
                  });
                }

                const aiReport = parseAiFeedback(selectedAttempt);
                const finalReport = aiReport?.full_evaluation || aiReport;

                const missingEssayPoints = finalReport
                  ? (finalReport.missing_points || [])
                  : essayPoints.filter(p => !localMatchedEssayPoints.includes(p));

                const wrongEssayPoints = finalReport
                  ? (finalReport.wrong_points || [])
                  : [];

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Layer 3: 🔥 记忆强化卡 (Highest Visual Priority) */}
                    <div className="glass-panel" style={{ 
                      padding: '1.5rem', 
                      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(0, 210, 255, 0.08) 100%)', 
                      border: '2px solid var(--secondary)',
                      borderRadius: '16px',
                      boxShadow: '0 0 20px rgba(139, 92, 246, 0.15), var(--shadow-glow), var(--shadow-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem'
                    }}>
                      <h4 style={{ 
                        color: 'var(--text-primary)', 
                        fontWeight: '800', 
                        fontSize: '1.05rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.4rem',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        paddingBottom: '0.5rem',
                        margin: 0
                      }}>
                        <Sparkles size={16} style={{ color: 'var(--secondary)' }} />
                        🔥 记忆强化卡
                      </h4>
                      
                      <div style={{ 
                        fontSize: '0.9rem', 
                        fontWeight: '700', 
                        color: 'var(--primary)',
                        padding: '0.4rem 0.8rem',
                        background: 'rgba(0, 210, 255, 0.05)',
                        borderRadius: '8px',
                        borderLeft: '3px solid var(--primary)',
                        lineHeight: '1.4'
                      }}>
                        💡 提示：{finalReport?.suggestion || (clozeMisses.length > 0 || missingEssayPoints.length > 0 ? "下一次复习时，请重点关注以下遗漏的必背词和核心得分要点。" : "本次默写表现完美，继续保持！")}
                      </div>

                      {(clozeMisses.length > 0 || missingEssayPoints.length > 0) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.2rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>⚡ 下次必须记住：</span>
                          <ul style={{ 
                            margin: 0, 
                            paddingLeft: '1.25rem', 
                            fontSize: '0.85rem', 
                            color: 'var(--text-primary)', 
                            lineHeight: '1.6',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem'
                          }}>
                            {clozeMisses.map((kw, i) => (
                              <li key={`miss-kw-${i}`}>
                                核心词：<strong style={{ color: 'var(--danger)' }}>{kw}</strong>
                              </li>
                            ))}
                            {missingEssayPoints.map((pt, i) => (
                              <li key={`miss-pt-${i}`}>
                                得分点：<strong>{pt}</strong>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <CheckCircle2 size={14} style={{ color: 'var(--success)' }} /> 恭喜！您已经完整命中了所有核心要点，没有遗漏。
                        </div>
                      )}
                    </div>

                    {/* Layer 2: 【差异对照】 (Auxiliary Visual Weight) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                      {/* Hits */}
                      <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.01)', borderColor: 'rgba(16, 185, 129, 0.08)' }}>
                        <span style={{ color: 'var(--success)', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem', borderBottom: '1px solid rgba(16, 185, 129, 0.08)', paddingBottom: '0.4rem', marginBottom: '0.5rem' }}>
                          <CheckCircle2 size={14} style={{ color: 'var(--success)' }} /> ✔ 已命中
                        </span>
                        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {clozeHits.map((kw, i) => (
                            <li key={`hit-kw-${i}`} style={{ listStyleType: 'circle' }}>核心词: "{kw}"</li>
                          ))}
                          {localMatchedEssayPoints.map((pt, i) => (
                            <li key={`hit-pt-${i}`} style={{ listStyleType: 'circle' }}>要点: "{pt}"</li>
                          ))}
                          {clozeHits.length === 0 && localMatchedEssayPoints.length === 0 && (
                            <li style={{ listStyle: 'none', color: 'var(--text-muted)', paddingLeft: 0 }}>无命中</li>
                          )}
                        </ul>
                      </div>

                      {/* Reinforcements */}
                      <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.01)', borderColor: 'rgba(239, 68, 68, 0.08)' }}>
                        <span style={{ color: 'var(--warning)', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem', borderBottom: '1px solid rgba(239, 68, 68, 0.08)', paddingBottom: '0.4rem', marginBottom: '0.5rem' }}>
                          <AlertTriangle size={14} style={{ color: 'var(--warning)' }} /> 🔥 必强化
                        </span>
                        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {clozeMisses.map((kw, i) => (
                            <li key={`re-kw-${i}`} style={{ listStyleType: 'circle' }}>核心词: <span style={{ color: 'var(--danger)' }}>"{kw}"</span></li>
                          ))}
                          {missingEssayPoints.map((pt, i) => (
                            <li key={`re-pt-${i}`} style={{ listStyleType: 'circle' }}>得分点: <span style={{ color: 'var(--warning)' }}>"{pt}"</span></li>
                          ))}
                          {wrongEssayPoints.map((pt, i) => (
                            <li key={`re-wrong-${i}`} style={{ listStyleType: 'circle' }}>偏离: <span style={{ color: 'var(--danger)' }}>"{pt}"</span></li>
                          ))}
                          {clozeMisses.length === 0 && missingEssayPoints.length === 0 && wrongEssayPoints.length === 0 && (
                            <li style={{ listStyle: 'none', color: 'var(--success)', paddingLeft: 0 }}>无需强化</li>
                          )}
                        </ul>
                      </div>
                    </div>

                    {/* Layer 1: 【你的回答】 (Minor Visual Weight) */}
                    <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {processedParts.some(p => p.type === 'blank') && (
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>填空核对：</span>
                          <div style={{ 
                            padding: '0.75rem 1rem', 
                            background: 'rgba(0, 0, 0, 0.1)', 
                            borderRadius: '8px', 
                            lineHeight: '1.8', 
                            fontSize: '0.85rem',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-color)',
                            whiteSpace: 'pre-line',
                            marginTop: '0.25rem'
                          }}>
                            {renderClozeText(selectedAttempt.question, selectedAttempt.cloze_answer, clozeAnswers)}
                          </div>
                        </div>
                      )}

                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>你的默写回答：</span>
                        <div style={{ 
                          padding: '0.75rem 1rem', 
                          background: 'rgba(0, 0, 0, 0.1)', 
                          borderRadius: '8px', 
                          fontSize: '0.85rem', 
                          whiteSpace: 'pre-line', 
                          lineHeight: '1.5',
                          color: 'var(--text-secondary)',
                          border: '1px dashed rgba(255, 255, 255, 0.05)',
                          marginTop: '0.25rem'
                        }}>
                          {fullAnswerInput ? fullAnswerInput.trim() : '（未作答论述部分）'}
                        </div>
                      </div>
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
