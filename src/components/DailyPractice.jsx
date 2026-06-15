import React, { useState, useEffect } from 'react';

export default function DailyPractice({ onStartPractice }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuestion, setSearchQuestion] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchChapter, setSearchChapter] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  useEffect(() => {
    fetchQuestions();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuestion, searchKeyword, searchChapter]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/questions');
      const data = await res.json();
      if (data.success) {
        // The API returns questions ordered by ID DESC
        setQuestions(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch questions for daily practice:', err);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic client-side filtering by multiple conditions
  const filteredQuestions = questions.filter(q => {
    // 1. Filter by 题目 (Question)
    if (searchQuestion.trim()) {
      const term = searchQuestion.toLowerCase().trim();
      if (!(q.question || '').toLowerCase().includes(term)) {
        return false;
      }
    }

    // 2. Filter by 知识点 (Knowledge points / Keywords)
    if (searchKeyword.trim()) {
      const term = searchKeyword.toLowerCase().trim();
      // Match inside cloze_keywords array
      const matchesClozeKeyword = (q.cloze_keywords || []).some(kw => 
        (typeof kw === 'string' ? kw : '').toLowerCase().includes(term)
      );
      // Match inside cloze_answer text
      const matchesClozeAnswer = (q.cloze_answer || '').toLowerCase().includes(term);
      // Match inside full_score_points array
      const matchesFullScorePoint = (q.full_score_points || []).some(pt => 
        (typeof pt === 'string' ? pt : '').toLowerCase().includes(term)
      );
      
      if (!matchesClozeKeyword && !matchesClozeAnswer && !matchesFullScorePoint) {
        return false;
      }
    }

    // 3. Filter by 章节 (Chapter)
    if (searchChapter) {
      const term = searchChapter.toLowerCase().trim();
      if (!(q.chapter || '').toLowerCase().includes(term)) {
        return false;
      }
    }

    return true;
  });

  const totalQuestionsCount = filteredQuestions.length;
  const totalPages = Math.ceil(totalQuestionsCount / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const displayedQuestions = filteredQuestions.slice(startIndex, startIndex + pageSize);

  const handleStartAll = () => {
    if (questions.length === 0) return;
    onStartPractice('全量自测', questions);
  };

  const handleStartFiltered = () => {
    if (filteredQuestions.length === 0) return;
    const activeFilters = [];
    if (searchQuestion.trim()) activeFilters.push(`题目:"${searchQuestion.trim()}"`);
    if (searchKeyword.trim()) activeFilters.push(`知识点:"${searchKeyword.trim()}"`);
    if (searchChapter) activeFilters.push(`章节:"${searchChapter}"`);
    const name = activeFilters.length > 0 ? `筛选自测: ${activeFilters.join(' & ')}` : '筛选自测';
    onStartPractice(name, filteredQuestions);
  };

  const uniqueChapters = [...new Set(questions.map(q => q.chapter).filter(Boolean))];

  const handleResetFilters = () => {
    setSearchQuestion('');
    setSearchKeyword('');
    setSearchChapter('');
  };

  const handleStartSingle = (q) => {
    onStartPractice(`单题测试: ${q.question.slice(0, 15)}...`, [q]);
  };

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>正在加载题库大纲...</p>
      </div>
    );
  }

  return (
    <div className="daily-practice-container animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="section-title">
        <span>🎯 每日自主自测</span>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: '700', background: 'linear-gradient(135deg, #fff, var(--text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.25rem' }}>
          做题与背诵冲刺
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
          在这里，您可以快速检索题库中的所有题目并自主发起测试练习。系统支持条件组合检索，做题将依次进行“填空自测”与“论述自测”两阶段核对，自测结果会直接计入您每日的学习历史并调度下一次复习时间。
        </p>

        {/* Multi-Condition Search Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1rem', 
          width: '100%',
          marginBottom: '0.5rem'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>❓ 题目关键词</label>
            <input
              type="text"
              className="form-input-text"
              placeholder="搜索题目关键词..."
              value={searchQuestion}
              onChange={e => setSearchQuestion(e.target.value)}
              style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.85rem' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>🔑 知识点 / 核心词</label>
            <input
              type="text"
              className="form-input-text"
              placeholder="搜索填空/论述背诵要点..."
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.85rem' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>📂 所属章节</label>
            <select
              className="form-input-text"
              value={searchChapter}
              onChange={e => setSearchChapter(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '0.6rem 0.8rem', 
                fontSize: '0.85rem',
                height: 'auto',
                cursor: 'pointer'
              }}
            >
              <option value="">全部章节</option>
              {uniqueChapters.map(ch => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          {(searchQuestion || searchKeyword || searchChapter) && (
            <button
              onClick={handleResetFilters}
              className="text-btn"
              style={{
                padding: '0.65rem 1.25rem',
                fontSize: '0.9rem',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                cursor: 'pointer'
              }}
            >
              🔄 重置条件
            </button>
          )}
          <button
            onClick={handleStartAll}
            className="text-btn primary-btn"
            disabled={questions.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              background: 'linear-gradient(135deg, var(--primary), #00b4d8)',
              border: 'none',
              color: '#030712',
              fontWeight: '600',
              cursor: questions.length === 0 ? 'not-allowed' : 'pointer',
              opacity: questions.length === 0 ? 0.6 : 1
            }}
          >
            ⚡ 开始全量自测 ({questions.length} 题)
          </button>
          <button
            onClick={handleStartFiltered}
            disabled={filteredQuestions.length === 0}
            className="text-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              fontSize: '0.9rem',
              borderColor: 'rgba(0, 210, 255, 0.3)',
              cursor: filteredQuestions.length === 0 ? 'not-allowed' : 'pointer',
              opacity: filteredQuestions.length === 0 ? 0.5 : 1
            }}
          >
            🔍 筛选自测 ({filteredQuestions.length} 题)
          </button>
        </div>
      </div>

      {displayedQuestions.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {displayedQuestions.map(q => (
              <div
                key={q.id}
                className="glass-panel"
                style={{
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '210px',
                  transition: 'transform var(--transition-fast), border-color var(--transition-fast)',
                  cursor: 'default'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'rgba(0, 210, 255, 0.3)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              >
                <div>
                  {/* Meta Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    <span style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${q.subject} · ${q.chapter}`}>
                      {q.subject} · {q.chapter || '未分类'}
                    </span>
                    <span style={{
                      color: q.mastery_level >= 4 ? 'var(--success)' : q.mastery_level >= 2 ? 'var(--warning)' : 'var(--text-muted)',
                      fontWeight: '600'
                    }}>
                      Box {q.mastery_level || 0}
                    </span>
                  </div>

                  {/* Question title */}
                  <h3 style={{
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    lineHeight: '1.5',
                    color: 'var(--text-primary)',
                    marginBottom: '1rem',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {q.question}
                  </h3>
                </div>

                {/* Card footer details & trigger */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{ display: 'flex', gap: '2px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      重要度: {Array.from({ length: q.importance || 3 }).map((_, i) => <span key={i} style={{ color: 'var(--warning)' }}>★</span>)}
                    </div>
                    <div style={{ display: 'flex', gap: '2px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      难度: {Array.from({ length: q.difficulty || 3 }).map((_, i) => <span key={i} style={{ color: 'var(--info)' }}>★</span>)}
                    </div>
                  </div>

                  <button
                    onClick={() => handleStartSingle(q)}
                    className="text-btn"
                    style={{
                      padding: '0.35rem 0.8rem',
                      fontSize: '0.8rem',
                      borderColor: 'rgba(0, 210, 255, 0.3)',
                      background: 'rgba(0, 210, 255, 0.04)',
                      color: 'var(--primary)',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      transition: 'all var(--transition-fast)'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--primary)';
                      e.currentTarget.style.color = '#030712';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(0, 210, 255, 0.04)';
                      e.currentTarget.style.color = 'var(--primary)';
                    }}
                  >
                    开始自测 🚀
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: '1.5rem', 
              marginTop: '0.5rem',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '1rem'
            }}>
              <button 
                type="button"
                className="text-btn" 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                ◀️ 上一页
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                第 {currentPage} / {totalPages} 页 (当前显示 {startIndex + 1} - {Math.min(startIndex + pageSize, totalQuestionsCount)} 题，共 {totalQuestionsCount} 题)
              </span>
              <button 
                type="button"
                className="text-btn" 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
              >
                下一页 ▶️
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '0.95rem' }}>没有找到符合搜索条件的题目。</p>
          <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>您可以尝试更换搜索词，或前往“题库管理”页面添加新题目。</p>
        </div>
      )}
    </div>
  );
}
