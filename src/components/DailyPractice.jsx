import React, { useState, useEffect } from 'react';
import { Target, RefreshCw, Layers, Sparkles, HelpCircle, FileText, ChevronRight, Search, RotateCcw } from 'lucide-react';

export default function DailyPractice({ onStartPractice, reviewsData }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('channels'); // 'channels', 'search'

  // Search/Filter states
  const [searchQuestion, setSearchQuestion] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  // Practice Config states
  const [randomCount, setRandomCount] = useState(5);

  useEffect(() => {
    fetchQuestions();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuestion, searchKeyword]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/questions');
      const data = await res.json();
      if (data.success) {
        setQuestions(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch questions for practice:', err);
    } finally {
      setLoading(false);
    }
  };

  // Chapter特训已移除

  // 2. Mock errors practice trigger
  const handleStartMockErrors = () => {
    const errorList = reviewsData?.reviews?.errorReinforcement || [];
    if (errorList.length === 0) {
      window.customAlert('恭喜！您当前没有多次答错或低于5分的弱点卡片，无需错题回炉。');
      return;
    }
    onStartPractice('错题回炉模拟', errorList);
  };

  // 3. Random practice trigger
  const handleStartRandomPractice = () => {
    if (questions.length === 0) return;
    const shuffled = [...questions].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(randomCount, questions.length));
    onStartPractice(`随机抽取 (${selected.length} 题)`, selected);
  };

  // 4. Pre-exam Mock trigger (Draws 10 random questions)
  const handleStartPreExamMock = () => {
    if (questions.length < 5) {
      window.customAlert('题库中题目较少，无法生成完整的模拟试卷，请至少导入 5 道题以上。');
      return;
    }
    const shuffled = [...questions].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(10, questions.length));
    onStartPractice('考前冲刺全真模拟', selected);
  };

  // 5. Deep test (practices all questions, labeled as Deep Test)
  const handleStartDeepTest = () => {
    if (questions.length === 0) return;
    onStartPractice('深度自测练习', questions);
  };

  // Client-side searchable filtering
  const filteredQuestions = questions.filter(q => {
    if (searchQuestion.trim()) {
      const term = searchQuestion.toLowerCase().trim();
      if (!(q.question || '').toLowerCase().includes(term)) return false;
    }
    if (searchKeyword.trim()) {
      const term = searchKeyword.toLowerCase().trim();
      const matchesClozeKeyword = (q.cloze_keywords || []).some(kw => 
        (typeof kw === 'string' ? kw : '').toLowerCase().includes(term)
      );
      const matchesClozeAnswer = (q.cloze_answer || '').toLowerCase().includes(term);
      const matchesFullScorePoint = (q.full_score_points || []).some(pt => 
        (typeof pt === 'string' ? pt : '').toLowerCase().includes(term)
      );
      if (!matchesClozeKeyword && !matchesClozeAnswer && !matchesFullScorePoint) return false;
    }
    // Chapter filter removed
    return true;
  });

  const totalQuestionsCount = filteredQuestions.length;
  const totalPages = Math.ceil(totalQuestionsCount / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const displayedQuestions = filteredQuestions.slice(startIndex, startIndex + pageSize);

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>正在同步大纲与章节数据...</p>
      </div>
    );
  }

  return (
    <div className="daily-practice-container animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header Info */}
      <div className="glass-panel" style={{ padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: '800' }}>🎯 专业课专项训练区</h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '0.9rem' }}>
          独立于日常 Learn/Review 的提分训练场。提供章节专练、弱点回炉、真题模拟及全量搜索演练。
        </p>
      </div>

      {/* Sub-tab selectors */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveSubTab('channels')}
          className={`nav-tab ${activeSubTab === 'channels' ? 'active' : ''}`}
          style={{ fontSize: '0.85rem', padding: '0.4rem 1.2rem' }}
        >
          🧩 专项训练通道
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('search')}
          className={`nav-tab ${activeSubTab === 'search' ? 'active' : ''}`}
          style={{ fontSize: '0.85rem', padding: '0.4rem 1.2rem' }}
        >
          🔍 考点检索自测
        </button>
      </div>

      {/* Tab Content 1: Channels */}
      {activeSubTab === 'channels' && (
        <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            


            {/* Mock errors card */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifySpace: 'between', minHeight: '210px', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', fontWeight: 'bold' }}>
                  <RotateCcw size={18} />
                  <span>错题强化回炉</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.4rem', lineHeight: '1.4' }}>
                  集中提取近期答错频次最高、评分最低的盲点概念进行针对性多重复习。
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyEnd: 'true', marginTop: 'auto' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  当前待强化盲点：<strong>{reviewsData?.reviews?.errorReinforcement?.length || 0}</strong> 个
                </div>
                <button
                  type="button"
                  onClick={handleStartMockErrors}
                  disabled={(reviewsData?.reviews?.errorReinforcement?.length || 0) === 0}
                  className="text-btn"
                  style={{ padding: '0.5rem', fontSize: '0.85rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                >
                  开启错题回炉
                </button>
              </div>
            </div>

            {/* Random Practice card */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifySpace: 'between', minHeight: '210px', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--warning)', fontWeight: 'bold' }}>
                  <HelpCircle size={18} />
                  <span>随机抽题测验</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.4rem', lineHeight: '1.4' }}>
                  从全库中随机抽取指定数量的卡片进行快速测验，打破章节顺序依赖，测试真实检索速度。
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>抽取数量:</span>
                  <input
                    type="number"
                    min="3"
                    max="30"
                    value={randomCount}
                    onChange={(e) => setRandomCount(parseInt(e.target.value) || 5)}
                    className="form-input-text"
                    style={{ padding: '0.3rem', fontSize: '0.85rem', width: '70px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', height: 'auto' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleStartRandomPractice}
                  className="text-btn"
                  style={{ padding: '0.5rem', fontSize: '0.85rem', borderColor: 'var(--warning)', color: 'var(--warning)' }}
                >
                  随机抽取并开始
                </button>
              </div>
            </div>

            {/* Pre-exam Mock card */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifySpace: 'between', minHeight: '210px', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)', fontWeight: 'bold' }}>
                  <FileText size={18} />
                  <span>📝 考前全真模拟</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.4rem', lineHeight: '1.4' }}>
                  模拟真实考试场景。随机抽取 10 道典型专业课题目，禁止中途查看标准答案，完后生成卷面总评分。
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyEnd: 'true', marginTop: 'auto' }}>
                <button
                  type="button"
                  onClick={handleStartPreExamMock}
                  className="text-btn primary-btn"
                  style={{ padding: '0.5rem', fontSize: '0.85rem', background: 'var(--accent)', color: 'var(--bg-dark)' }}
                >
                  生成模拟卷并开始
                </button>
              </div>
            </div>

          </div>

          {/* Large Quick Access Card */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>⚡ 全量考点深度自测</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                不进行任何筛选，对整个题库的所有 {questions.length} 个考点按序进行完整的闭环回忆测试。
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartDeepTest}
              className="text-btn"
              style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem' }}
            >
              开始全量测试 ➔
            </button>
          </div>

        </div>
      )}

      {/* Tab Content 2: Search */}
      {activeSubTab === 'search' && (
        <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Search filters */}
          <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>题目关键词</label>
                <input
                  type="text"
                  className="form-input-text"
                  placeholder="搜索题目..."
                  value={searchQuestion}
                  onChange={e => setSearchQuestion(e.target.value)}
                  style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>知识点 / 核心词</label>
                <input
                  type="text"
                  className="form-input-text"
                  placeholder="搜索答案关键字..."
                  value={searchKeyword}
                  onChange={e => setSearchKeyword(e.target.value)}
                  style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {(searchQuestion || searchKeyword) && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setSearchQuestion('');
                    setSearchKeyword('');
                  }}
                  className="text-btn"
                  style={{ padding: '0.4rem 1.2rem', fontSize: '0.8rem', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }}
                >
                  🔄 清空筛选
                </button>
              </div>
            )}
          </div>

          {/* Search results list */}
          {displayedQuestions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
                {displayedQuestions.map(q => (
                  <div
                    key={q.id}
                    className="glass-panel"
                    style={{
                      padding: '1.25rem 1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '190px',
                      transition: 'transform 0.2s',
                      cursor: 'default'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                          Box {q.mastery_level || 0}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: '700', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {q.question}
                      </h4>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        重要度: {'★'.repeat(q.importance || 3)}
                      </span>
                      <button
                        onClick={() => onStartPractice(`单题练习: ${q.question.slice(0, 10)}...`, [q])}
                        className="text-btn"
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', borderColor: 'rgba(0, 210, 255, 0.2)' }}
                      >
                        自测 🚀
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <button 
                    type="button"
                    className="text-btn" 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
                  >
                    ◀️ 上一页
                  </button>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    第 {currentPage} / {totalPages} 页 (共 {totalQuestionsCount} 题)
                  </span>
                  <button 
                    type="button"
                    className="text-btn" 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
                  >
                    下一页 ▶️
                  </button>
                </div>
              )}

            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              暂无符合检索条件的考点。
            </div>
          )}

        </div>
      )}

    </div>
  );
}
