import React, { useState, useEffect } from 'react';
import { ArrowLeft, BookOpen, RefreshCw, Layers, ChevronRight, CheckCircle2, AlertTriangle, Calendar, Star, CheckSquare, Square, Sparkles } from 'lucide-react';

export default function TodayReview({ 
  onNavigate, 
  customQueue, 
  customQueueName, 
  practiceMode, 
  onClearCustomQueue, 
  reviewsData,
  dailyNewGoal = 20,
  dailyReviewGoal = 60
}) {
  const [loading, setLoading] = useState(true);
  const [currentPracticeMode, setCurrentPracticeMode] = useState(practiceMode || 'standard');
  const [allQuestions, setAllQuestions] = useState([]);
  const [activeQueue, setActiveQueue] = useState([]);
  const [queueName, setQueueName] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  // Today's Study Pack selection states
  const [packSource, setPackSource] = useState('today'); // 'today', 'recent', 'chapter', 'all'
  const [selectedChapter, setSelectedChapter] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Stepper recall states
  const [step, setStep] = useState(1); // 0: Memorize (Learn only), 1: Cloze (Both), 2: Essay (Both)
  const [clozeAnswers, setClozeAnswers] = useState({});
  const [fullAnswerInput, setFullAnswerInput] = useState('');
  const [clozeScore, setClozeScore] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [gradingResult, setGradingResult] = useState(null);
  const [activeReportTab, setActiveReportTab] = useState('comparison'); // 'comparison', 'ai'

  // Load database questions and sync review state
  useEffect(() => {
    fetchQuestions();
  }, []);

  // Initialize custom queue if passed
  useEffect(() => {
    if (customQueue && customQueue.length > 0) {
      startQueue(customQueueName || '自主练习', customQueue, practiceMode);
    } else if (practiceMode === 'learn') {
      setCurrentPracticeMode('learn');
      setActiveQueue([]);
    }
  }, [customQueue, customQueueName, practiceMode]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/questions');
      const data = await res.json();
      if (data.success) {
        setAllQuestions(data.data);
      }
      if (reviewsData && reviewsData.fetchReviews) {
        await reviewsData.fetchReviews();
      }
    } catch (err) {
      console.error('Failed to fetch questions database:', err);
    } finally {
      setLoading(false);
    }
  };

  // Pre-select questions by default for study pack
  const unlearnedList = allQuestions.filter(q => q.mastery_level === 0 || !q.mastery_level);
  
  const getFilteredPackQuestions = () => {
    if (packSource === 'today') {
      return unlearnedList.filter(q => {
        if (!q.created_at) return false;
        return new Date(q.created_at).toDateString() === new Date().toDateString();
      });
    }
    if (packSource === 'recent') {
      return [...unlearnedList].sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });
    }
    if (packSource === 'chapter') {
      return unlearnedList.filter(q => q.chapter === selectedChapter);
    }
    return unlearnedList;
  };

  const filteredPackQs = getFilteredPackQuestions();

  useEffect(() => {
    if (activeQueue.length === 0 && currentPracticeMode === 'learn' && unlearnedList.length > 0) {
      const hasToday = unlearnedList.some(q => q.created_at && new Date(q.created_at).toDateString() === new Date().toDateString());
      const defaultSource = hasToday ? 'today' : 'recent';
      setPackSource(defaultSource);

      const items = unlearnedList.filter(q => {
        if (defaultSource === 'today') {
          return q.created_at && new Date(q.created_at).toDateString() === new Date().toDateString();
        }
        return true;
      });
      const defaultSelectIds = new Set(
        items.slice(0, defaultSource === 'today' ? items.length : dailyNewGoal).map(q => q.id)
      );
      setSelectedIds(defaultSelectIds);
    }
  }, [allQuestions, activeQueue.length, currentPracticeMode]);

  const handleToggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredPackQs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPackQs.map(q => q.id)));
    }
  };

  const startQueue = (name, list, mode = 'standard') => {
    if (list.length === 0) return;
    setActiveQueue(list);
    setQueueName(name);
    setCurrentIndex(0);
    setCurrentPracticeMode(mode);
    resetStudyState(mode);
  };

  const resetStudyState = (forceMode) => {
    const activeMode = forceMode || currentPracticeMode;
    setStep(activeMode === 'learn' ? 0 : 1);
    setClozeAnswers({});
    setFullAnswerInput('');
    setClozeScore(0);
    setIsSubmitted(false);
    setGradingResult(null);
    setIsGrading(false);
    setActiveReportTab('comparison');
  };

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

  // Step transitions
  const handleClozeNext = () => {
    const currentQ = activeQueue[currentIndex];
    if (!currentQ) return;
    const { processedParts, dugCount } = getFilteredClozeParts(currentQ.question, currentQ.cloze_answer);
    let correctCount = 0;
    processedParts.forEach((part) => {
      if (part.type === 'blank') {
        const ans = (clozeAnswers[part.inputKey] || '').trim();
        if (isClozeAnswerCorrect(ans, part.text)) {
          correctCount++;
        }
      }
    });
    const score = dugCount > 0 ? parseFloat(((correctCount / dugCount) * 10).toFixed(1)) : 10;
    setClozeScore(score);
    setStep(2);
  };

  // Request AI grading and save results
  const handleRequestAiGrading = async () => {
    const currentQ = activeQueue[currentIndex];
    if (!currentQ) return;

    setIsGrading(true);
    try {
      const res = await fetch('/api/ai/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQ.id,
          clozeScore: clozeScore,
          clozeAnswers,
          fullAnswerInput: fullAnswerInput.trim(),
          skipAI: false
        })
      });
      const data = await res.json();
      if (data.success) {
        setGradingResult(data.data);
        setActiveReportTab('ai');
        if (reviewsData && reviewsData.fetchReviews) {
          await reviewsData.fetchReviews();
        }
      } else {
        await window.customAlert('AI 评分失败: ' + data.message);
      }
    } catch (err) {
      console.error(err);
      await window.customAlert('评分接口请求失败，请检查服务器网络。');
    } finally {
      setIsGrading(false);
    }
  };

  // Manual self-rating selection: forgot, hard, good, easy
  const handleLeitnerRating = async (rating) => {
    const currentQ = activeQueue[currentIndex];
    if (!currentQ) return;

    setIsGrading(true);
    try {
      const res = await fetch('/api/cards/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQ.id,
          rating,
          clozeAnswers,
          fullAnswerInput: fullAnswerInput.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        if (reviewsData && reviewsData.fetchReviews) {
          await reviewsData.fetchReviews();
        }
        handleNext();
      } else {
        await window.customAlert('卡片自评保存失败: ' + data.message);
      }
    } catch (err) {
      console.error(err);
      await window.customAlert('保存卡片自测结果出错。');
    } finally {
      setIsGrading(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < activeQueue.length - 1) {
      setCurrentIndex(prev => prev + 1);
      resetStudyState();
    } else {
      window.customAlert('恭喜您已完成本次记忆学习包所有考点的打卡训练！');
      if (currentPracticeMode === 'learn') {
        onClearCustomQueue();
        onNavigate('home');
      } else {
        fetchQuestions();
        setActiveQueue([]);
        setQueueName('');
        onNavigate('home');
      }
    }
  };

  // Render standard answer text with input fields for blanks
  const renderClozeText = (questionTitle, description) => {
    const { processedParts } = getFilteredClozeParts(questionTitle, description);
    return processedParts.map((part, index) => {
      if (part.type === 'blank') {
        const standardKw = part.text;
        const inputKey = part.inputKey;
        const userAnswer = (clozeAnswers[inputKey] || '').trim();
        const isCorrect = isClozeAnswerCorrect(userAnswer, standardKw);
        return (
          <span key={index} style={{ display: 'inline-flex', alignItems: 'center', margin: '0 4px', verticalAlign: 'middle' }}>
            <input
              type="text"
              className={`cloze-input ${isSubmitted ? (isCorrect ? 'correct' : 'incorrect') : ''}`}
              placeholder="请输入"
              value={clozeAnswers[inputKey] || ''}
              onChange={(e) => setClozeAnswers(prev => ({ ...prev, [inputKey]: e.target.value }))}
              disabled={isSubmitted}
              style={{
                width: `${Math.max(standardKw.length * 16, 90)}px`,
                padding: '0.2rem 0.5rem',
                fontSize: '0.95rem',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                background: 'rgba(0,0,0,0.3)',
                color: 'var(--text-primary)',
                textAlign: 'center',
                borderColor: isSubmitted ? (isCorrect ? 'var(--success)' : 'var(--danger)') : 'var(--border-color)'
              }}
            />
            {isSubmitted && !isCorrect && (
              <span style={{ color: 'var(--danger)', fontSize: '0.85rem', marginLeft: '4px', fontWeight: 'bold' }}>
                ({standardKw})
              </span>
            )}
          </span>
        );
      }
      return part.isBold ? <strong key={index} style={{ color: 'var(--accent)' }}>{part.text}</strong> : <span key={index}>{part.text}</span>;
    });
  };

  // Render "今日学习包定制" custom view
  if (activeQueue.length === 0 && currentPracticeMode === 'learn') {
    const chapters = [...new Set(unlearnedList.map(q => q.chapter).filter(Boolean))];
    
    return (
      <div className="study-pack-setup animate-fade" style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: '800' }}>🎯 今日学习包定制</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '0.9rem' }}>
            系统推荐您记忆当天导入和最近上传的内容。自定义选择后，系统将为您生成统一的记忆卡片包。
          </p>
        </div>

        {/* Source selectors */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
          {[
            { id: 'today', label: '📅 今日上传' },
            { id: 'recent', label: '🆕 最近新传' },
            { id: 'chapter', label: '📁 按章筛选' },
            { id: 'all', label: '📚 全部未学' }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => {
                setPackSource(opt.id);
                if (opt.id !== 'chapter') setSelectedChapter('');
              }}
              className="text-btn"
              style={{
                padding: '0.75rem 0.5rem',
                fontSize: '0.85rem',
                fontWeight: '700',
                background: packSource === opt.id ? 'var(--primary-muted)' : 'rgba(0, 0, 0, 0.2)',
                borderColor: packSource === opt.id ? 'var(--primary)' : 'var(--border-color)',
                color: packSource === opt.id ? 'var(--primary)' : 'var(--text-primary)'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Chapter filter selector if active */}
        {packSource === 'chapter' && (
          <div className="glass-panel" style={{ padding: '1rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>选择目标章节</label>
            <select
              className="form-input-text"
              value={selectedChapter}
              onChange={(e) => setSelectedChapter(e.target.value)}
              style={{ padding: '0.5rem', fontSize: '0.9rem' }}
            >
              <option value="">-- 请选择章节 --</option>
              {chapters.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Question checklist table */}
        <div className="glass-panel" style={{ padding: '1rem', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
            <button 
              type="button" 
              onClick={handleToggleSelectAll} 
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              {selectedIds.size === filteredPackQs.length ? <CheckSquare size={16} /> : <Square size={16} />}
              全选 / 反选
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              匹配未学考点：{filteredPackQs.length} 个
            </span>
          </div>

          <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '4px' }}>
            {filteredPackQs.length > 0 ? (
              filteredPackQs.map((q, idx) => {
                const isChecked = selectedIds.has(q.id);
                return (
                  <div
                    key={q.id}
                    onClick={() => handleToggleSelect(q.id)}
                    className="glass-panel"
                    style={{
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      cursor: 'pointer',
                      background: isChecked ? 'rgba(0, 210, 255, 0.05)' : 'rgba(255,255,255,0.01)',
                      borderColor: isChecked ? 'rgba(0, 210, 255, 0.3)' : 'var(--border-color)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div>
                      {isChecked ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} style={{ color: 'var(--text-muted)' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {q.question}
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {q.chapter}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', fontSize: '0.7rem' }}>
                      <span style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}>
                        ★ {q.importance}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                🫙 暂无匹配该条件的新考点。
              </div>
            )}
          </div>
        </div>

        {/* Sticky action bar */}
        <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(10, 15, 30, 0.9)' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              今日学习限额: <strong>{dailyNewGoal}</strong> | 已选中 <strong>{selectedIds.size}</strong> 个考点
            </span>
          </div>
          <button
            type="button"
            className="text-btn primary-btn"
            disabled={selectedIds.size === 0}
            onClick={() => {
              const selectedQs = filteredPackQs.filter(q => selectedIds.has(q.id));
              startQueue('今日学习包', selectedQs, 'learn');
            }}
            style={{ padding: '0.6rem 2rem' }}
          >
            🚀 开始今日学习包 ({selectedIds.size})
          </button>
        </div>
      </div>
    );
  }

  // Fallback to select queue screen if activeQueue is empty for review/other
  if (activeQueue.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '600px', margin: '3rem auto' }}>
        <div className="logo-icon" style={{ margin: '0 auto 1rem' }}>🫙</div>
        <h3>今日无到期学习或复习包</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem', lineHeight: '1.6' }}>
          今日计划任务已经全部做完了！如需继续记忆，可点击底部导航前往【专项训练】模块自选特定章节或进行考前模拟。
        </p>
        <button className="text-btn primary-btn" onClick={() => onNavigate('home')} style={{ marginTop: '1.5rem', padding: '0.5rem 2rem' }}>
          返回首页
        </button>
      </div>
    );
  }

  const currentQ = activeQueue[currentIndex];

  return (
    <div className="active-recall-container animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
      
      {/* Immersive Session Header */}
      <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ color: 'var(--primary)', fontWeight: '700', fontSize: '0.9rem' }}>
            {queueName} ({currentIndex + 1} / {activeQueue.length})
          </span>
          <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            章节: {currentQ.chapter}
          </h4>
        </div>
        <button 
          className="text-btn" 
          style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
          onClick={async () => {
            if (await window.customConfirm('确认退出本次自测学习？进度已打卡的卡片会被记录。')) {
              onClearCustomQueue();
              onNavigate('home');
            }
          }}
        >
          退出
        </button>
      </div>

      {/* Workflow Stepper Indicator Header */}
      {!isSubmitted && (
        <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(16, 22, 42, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '1rem' }}>
            
            {currentPracticeMode === 'learn' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: step >= 0 ? 1 : 0.3 }}>
                  <div className={`stepper-dot ${step === 0 ? 'active' : ''}`} style={{
                    width: '24px', height: '24px', borderRadius: '50%', background: step === 0 ? 'var(--primary)' : 'rgba(0, 210, 255, 0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#fff', fontWeight: 'bold'
                  }}>1</div>
                  <span style={{ fontSize: '0.8rem', fontWeight: step === 0 ? 'bold' : 'normal' }}>核心带背</span>
                </div>
                <div style={{ flexGrow: 1, height: '2px', background: step >= 1 ? 'var(--primary)' : 'var(--border-color)' }}></div>
              </>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: step >= 1 ? 1 : 0.3 }}>
              <div className={`stepper-dot ${step === 1 ? 'active' : ''}`} style={{
                width: '24px', height: '24px', borderRadius: '50%', background: step === 1 ? 'var(--primary)' : 'rgba(0, 210, 255, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#fff', fontWeight: 'bold'
              }}>{currentPracticeMode === 'learn' ? '2' : '1'}</div>
              <span style={{ fontSize: '0.8rem', fontWeight: step === 1 ? 'bold' : 'normal' }}>挖空回忆</span>
            </div>

            <div style={{ flexGrow: 1, height: '2px', background: step >= 2 ? 'var(--primary)' : 'var(--border-color)' }}></div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: step >= 2 ? 1 : 0.3 }}>
              <div className={`stepper-dot ${step === 2 ? 'active' : ''}`} style={{
                width: '24px', height: '24px', borderRadius: '50%', background: step === 2 ? 'var(--primary)' : 'rgba(0, 210, 255, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#fff', fontWeight: 'bold'
              }}>{currentPracticeMode === 'learn' ? '3' : '2'}</div>
              <span style={{ fontSize: '0.8rem', fontWeight: step === 2 ? 'bold' : 'normal' }}>长文默写</span>
            </div>

          </div>
        </div>
      )}

      {/* Main Question Display */}
      <div className="glass-panel" style={{ padding: '1.5rem 2rem', background: 'rgba(16, 22, 42, 0.45)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(0, 210, 255, 0.15)', color: 'var(--primary)', fontWeight: '600' }}>
            {currentQ.question_type || '名词解释'}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            莱特纳盒子: Box {currentQ.mastery_level || 0}
          </span>
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: '700', lineHeight: '1.4' }}>
          {currentQ.question}
        </h2>
      </div>

      {/* Recall Inputs (Active Stepper Views) */}
      {!isSubmitted && (
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Step 0: Memorize (Learn Mode Only) */}
          {step === 0 && currentPracticeMode === 'learn' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--primary)' }}>
                📝 第一步：要点熟记带背（请加深加粗词记忆）
              </span>
              <div style={{ 
                padding: '1.25rem', 
                background: 'rgba(0, 210, 255, 0.05)', 
                border: '1px solid rgba(0, 210, 255, 0.15)',
                borderRadius: '8px', 
                lineHeight: '2.0', 
                fontSize: '0.95rem',
                whiteSpace: 'pre-line'
              }}>
                {currentQ.cloze_answer.split(/(\*\*.*?\*\*)/).map((part, idx) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={idx} style={{ color: 'var(--accent)', fontSize: '1.05rem', textDecoration: 'underline' }}>{part.slice(2, -2)}</strong>;
                  }
                  return <span key={idx}>{part}</span>;
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="text-btn primary-btn" onClick={() => setStep(1)} style={{ padding: '0.6rem 2rem' }}>
                  记下了，去挖空回忆 ➔
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Cloze test (Both Modes) */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                  🧩 {currentPracticeMode === 'learn' ? '第二步：填空回忆验证' : '第一步：挖空回忆验证'}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  挖空数量: {getFilteredClozeParts(currentQ.question, currentQ.cloze_answer).dugCount} 空
                </span>
              </div>
              <div style={{ 
                padding: '1.25rem', 
                background: 'rgba(0, 0, 0, 0.2)', 
                borderRadius: '8px', 
                lineHeight: '2.2', 
                fontSize: '0.95rem',
                border: '1px solid var(--border-color)',
                whiteSpace: 'pre-line'
              }}>
                {renderClozeText(currentQ.question, currentQ.cloze_answer)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <div>
                  {currentPracticeMode === 'learn' && (
                    <button type="button" className="text-btn" onClick={() => setStep(0)} style={{ padding: '0.6rem 1.5rem' }}>
                      ↩️ 返回带背
                    </button>
                  )}
                </div>
                <button type="button" className="text-btn primary-btn" onClick={handleClozeNext} style={{ padding: '0.6rem 2rem' }}>
                  下一步：长答默写 ➔
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Essay textarea (Both Modes) */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <span style={{ fontWeight: '700', fontSize: '0.95rem', display: 'block' }}>
                  ✍️ {currentPracticeMode === 'learn' ? '第三步：长答核心论述' : '第二步：长答核心论述'}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  在下方写下完整的概念描述、性质特征或分点内容（自测核心输出能力）。
                </span>
              </div>
              
              <textarea
                className="form-input-text"
                placeholder="在此尝试手写输入完整的背诵答案。提交后，您既可以点击 AI 进行阅卷，也可以直接对照标准答案进行自评等级判定..."
                value={fullAnswerInput}
                onChange={(e) => setFullAnswerInput(e.target.value)}
                style={{
                  minHeight: '200px',
                  lineHeight: '1.6',
                  fontSize: '0.95rem',
                  resize: 'vertical',
                  padding: '1rem',
                  background: 'rgba(0, 0, 0, 0.2)'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <button type="button" className="text-btn" onClick={() => setStep(1)} style={{ padding: '0.6rem 1.5rem' }}>
                  ↩️ 返回填空
                </button>
                <button type="button" className="text-btn primary-btn" onClick={() => setIsSubmitted(true)} style={{ padding: '0.6rem 2.5rem' }}>
                  查看对照并评分 ➔
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Step 4 / Evaluation Step (IsSubmitted === true) */}
      {isSubmitted && (
        <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* AI grading load spinner */}
          {isGrading ? (
            <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
              <div className="spinner"></div>
              <p style={{ marginTop: '1.5rem', color: 'var(--primary)', fontWeight: '500' }}>
                考研辅导 AI 正在极速对您的卷面细节做精准评分，请稍候...
              </p>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Header Title */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem', marginBottom: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-display)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    ⚡ 记忆强化核对
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    对照本次回忆命中与遗漏情况，背诵强化卡。
                  </p>
                </div>
                {gradingResult && (
                  <div style={{ textAlign: 'right', background: 'rgba(0, 210, 255, 0.08)', padding: '0.4rem 0.8rem', borderRadius: '10px', border: '1px solid rgba(0, 210, 255, 0.15)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>综合评分</span>
                    <span style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>
                      {gradingResult.totalScore}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/10</span>
                  </div>
                )}
              </div>

              {/* Compute Cloze & Essay differences */}
              {(() => {
                const { processedParts } = getFilteredClozeParts(currentQ.question, currentQ.cloze_answer);
                
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

                const essayPoints = currentQ.full_score_points || [];
                const localMatchedEssayPoints = [];
                const cleanInput = (fullAnswerInput || '').toLowerCase().trim();
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

                const missingEssayPoints = gradingResult
                  ? (gradingResult.full_evaluation?.missing_points || [])
                  : essayPoints.filter(p => !localMatchedEssayPoints.includes(p));

                const wrongEssayPoints = gradingResult
                  ? (gradingResult.full_evaluation?.wrong_points || [])
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
                        💡 提示：{gradingResult?.full_evaluation?.suggestion || (clozeMisses.length > 0 || missingEssayPoints.length > 0 ? "下一次复习时，请重点关注以下遗漏的必背词和核心得分要点。" : "本次默写表现完美，直接进入下一个周期！")}
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
                            {renderClozeText(currentQ.question, currentQ.cloze_answer)}
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

              {/* Action Buttons & Rating Panel */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* 1. Show self-evaluation rating buttons if AI result is NOT fetched yet */}
                {!gradingResult && (
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.6rem', fontWeight: 'bold' }}>
                      🎯 对照作答后，请对自己刚才的表现做出等级评定（直接计入复习序列）：
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                      {[
                        { id: 'forgot', color: 'var(--danger)', label: '🔴 忘记', desc: '1天后重现' },
                        { id: 'hard', color: 'var(--warning)', label: '🟡 困难', desc: '2天后重现' },
                        { id: 'good', color: 'var(--info)', label: '🟢 良好', desc: '5天后重现' },
                        { id: 'easy', color: 'var(--success)', label: '🔵 简单', desc: '12天后重现' }
                      ].map(ratingOpt => (
                        <button
                          key={ratingOpt.id}
                          type="button"
                          onClick={() => handleLeitnerRating(ratingOpt.id)}
                          className="text-btn"
                          style={{
                            padding: '0.6rem 0.25rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.2rem',
                            borderWidth: '1px',
                            borderColor: ratingOpt.color,
                            background: 'rgba(255,255,255,0.01)',
                            borderRadius: '8px'
                          }}
                        >
                          <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: ratingOpt.color }}>
                            {ratingOpt.label}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            {ratingOpt.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Top-level action controls (Request AI / Go to Next) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <div>
                    {!gradingResult && (
                      <button
                        type="button"
                        className="text-btn"
                        onClick={handleRequestAiGrading}
                        style={{ padding: '0.6rem 1.5rem', borderColor: 'var(--primary)', color: 'var(--primary)', fontWeight: 'bold' }}
                      >
                        🧠 申请 AI 深度阅卷评语
                      </button>
                    )}
                  </div>
                  <div>
                    {(gradingResult || isSubmitted) && (
                      <button
                        type="button"
                        className="text-btn primary-btn"
                        onClick={handleNext}
                        style={{ padding: '0.6rem 2.5rem' }}
                      >
                        {currentIndex < activeQueue.length - 1 ? '下一题 ➔' : '完成本次学习 ➔'}
                      </button>
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}
