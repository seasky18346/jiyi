import React, { useState, useEffect } from 'react';

export default function Tester({ recitationData, settings }) {
  const [selectedDate, setSelectedDate] = useState('all');
  const [testMode, setTestMode] = useState('cloze'); // 'cloze' or 'dictation'
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Cloze State
  const [clozeAnswers, setClozeAnswers] = useState({});
  const [isClozeSubmitted, setIsClozeSubmitted] = useState(false);
  
  // Dictation State
  const [dictationInput, setDictationInput] = useState('');
  const [isDictationSubmitted, setIsDictationSubmitted] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  // Get active items list
  const allDates = recitationData.map(g => g.date);
  
  const testList = [];
  recitationData.forEach(group => {
    if (selectedDate === 'all' || group.date === selectedDate) {
      group.items.forEach(item => {
        if (item.points) {
          item.points.forEach(point => {
            testList.push({
              date: group.date,
              itemTitle: item.title,
              ...point
            });
          });
        }
      });
    }
  });

  const currentTest = testList[currentIndex];

  // Reset states when item or mode changes
  useEffect(() => {
    setClozeAnswers({});
    setIsClozeSubmitted(false);
    setDictationInput('');
    setIsDictationSubmitted(false);
    setAiResult(null);
  }, [currentIndex, testMode, selectedDate]);

  const handleNext = () => {
    if (currentIndex < testList.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // --- Cloze Test logic ---
  const handleClozeChange = (key, val) => {
    setClozeAnswers(prev => ({ ...prev, [key]: val }));
  };

  const submitCloze = () => {
    setIsClozeSubmitted(true);
  };

  const renderClozeText = (description) => {
    // Split by bold markdown terms
    const parts = description.split(/(\*\*.*?\*\*)/);
    let keywordIdx = 0;
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const standardKw = part.slice(2, -2);
        const inputKey = `kw_${keywordIdx}`;
        keywordIdx++;
        
        const userAnswer = (clozeAnswers[inputKey] || '').trim();
        const isCorrect = userAnswer.toLowerCase() === standardKw.toLowerCase();
        
        return (
          <span key={index} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <input
              type="text"
              className={`cloze-input ${isClozeSubmitted ? (isCorrect ? 'correct' : 'incorrect') : ''}`}
              placeholder="请输入"
              value={clozeAnswers[inputKey] || ''}
              onChange={(e) => handleClozeChange(inputKey, e.target.value)}
              disabled={isClozeSubmitted}
              style={{ width: `${Math.max(standardKw.length * 16, 80)}px` }}
            />
            {isClozeSubmitted && !isCorrect && (
              <span className="cloze-correction" title="标准答案">
                ({standardKw})
              </span>
            )}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Calculate score for Cloze
  const getClozeScore = () => {
    if (!currentTest) return 0;
    const kwCount = currentTest.keywords.length;
    if (kwCount === 0) return 100;
    
    let correctCount = 0;
    currentTest.keywords.forEach((kw, idx) => {
      const ans = (clozeAnswers[`kw_${idx}`] || '').trim();
      if (ans.toLowerCase() === kw.toLowerCase()) {
        correctCount++;
      }
    });
    
    return Math.round((correctCount / kwCount) * 100);
  };

  // --- Dictation / AI Grading logic ---
  const checkKeywordsLocally = (userInput, keywords) => {
    if (keywords.length === 0) return { score: 100, matches: [], misses: [] };
    
    const matches = [];
    const misses = [];
    const cleanInput = userInput.toLowerCase();
    
    keywords.forEach(kw => {
      const cleanKw = kw.toLowerCase();
      let found = cleanInput.includes(cleanKw);
      
      if (!found) {
        const synonyms = {
          '大地水准面': ['水准面', '等位面'],
          '参考椭球': ['参考椭球体', '旋转椭球', '地球椭球'],
          '地球自转轴': ['自转轴', '地轴'],
          '大地原点': ['大地起算点', '原点'],
          '海水处于完全静止平衡状态': ['静支海平面', '平衡海平面', '海水静止'],
          '物理描述': ['事实记录', '原始描述'],
          '空间位置': ['几何位置', '定位特征', '坐标']
        };
        
        for (const [key, list] of Object.entries(synonyms)) {
          if (cleanKw.includes(key) || key.includes(cleanKw)) {
            found = list.some(syn => cleanInput.includes(syn));
            if (found) break;
          }
        }
      }
      
      if (found) {
        matches.push(kw);
      } else {
        misses.push(kw);
      }
    });

    const score = Math.round((matches.length / keywords.length) * 100);
    return { score, matches, misses };
  };

  const submitDictation = async () => {
    if (!currentTest || !dictationInput.trim()) return;
    
    setIsGrading(true);
    setIsDictationSubmitted(true);

    const apiKey = settings.apiKey;
    const baseUrl = settings.apiUrl || 'https://api.xiaomimimo.com/v1';
    const model = settings.apiModel || 'mimo-v2.5';

    const localGrading = checkKeywordsLocally(dictationInput, currentTest.keywords);

    if (!apiKey) {
      setAiResult({
        score: localGrading.score,
        comments: `[本地打分] 您答出了 ${localGrading.matches.length} 个核心点，遗漏了 ${localGrading.misses.length} 个。请看对照进行自测调整。 (配置 API Key 可开启高级 AI 语义评判)`,
        synonyms: [],
        matches: localGrading.matches,
        misses: localGrading.misses
      });
      setIsGrading(false);
      return;
    }

    try {
      let gradingResult = null;
      let usedProxy = false;

      // 1. Try Proxy first (Express or Vercel serverless function)
      try {
        const proxyUrl = window.location.origin.includes('localhost:') ? 'http://localhost:5000/api/ai/grade' : '/api/ai/grade';
        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            concept: currentTest.concept,
            description: currentTest.description,
            keywords: currentTest.keywords,
            userAnswer: dictationInput,
            apiKey: apiKey,
            apiUrl: baseUrl,
            apiModel: model
          })
        });

        if (response.ok) {
          const res = await response.json();
          if (res.success && res.data) {
            gradingResult = res.data;
            usedProxy = true;
          }
        }
      } catch (err) {
        console.warn("Proxy AI grading failed, attempting direct call:", err);
      }

      // 2. Direct Browser Call fallback if proxy failed
      if (!usedProxy) {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: 'system',
                content: `你是一位专业的测绘地理信息学考研专业课教师。请对比标准答案与学生的默写，进行智能语义评估打分（0-100分）。
请允许同义词、近义词或句式不同的表达（例如把“大地球体”写成“参考地球椭球体”）。
你必须输出且仅输出一个合法的 JSON 格式对象，结构如下：
{
  "score": 85,
  "comments": "简短的中肯评语，说明哪些点答得好，哪些得分核心词遗漏了。字数控制在100字以内。",
  "synonyms": [{"student": "学生用的词", "standard": "对应的标准关键词"}]
}
不要有任何 Markdown 包裹（不要 \`\`\`json），直接输出 JSON 内容。`
              },
              {
                role: 'user',
                content: `名词：${currentTest.concept}\n标准答案：${currentTest.description}\n必须包含的得分核心词：${currentTest.keywords.join(', ')}\n学生的默写回答：${dictationInput}`
              }
            ],
            temperature: 0.2
          })
        });

        if (!response.ok) {
          throw new Error(`Direct API call failed: ${response.status}`);
        }
        gradingResult = await response.json();
      }

      const text = gradingResult.choices[0].message.content.trim();
      const cleanJsonStr = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleanJsonStr);

      setAiResult({
        score: parsed.score ?? localGrading.score,
        comments: parsed.comments ?? "AI 打分完成，语义契合度良好。",
        synonyms: parsed.synonyms ?? [],
        matches: localGrading.matches,
        misses: localGrading.misses
      });
    } catch (error) {
      console.error("AI Grading Error:", error);
      setAiResult({
        score: localGrading.score,
        comments: `[AI 评分失败，使用本地备用评分] 错误信息: ${error.message}。请核实您的设置与 API 额度。`,
        synonyms: [],
        matches: localGrading.matches,
        misses: localGrading.misses
      });
    } finally {
      setIsGrading(false);
    }
  };

  if (!currentTest) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
        <h3>暂无测试条目</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>请检查您的知识库或选择其他日期范围。</p>
        <select className="custom-select" style={{ marginTop: '1rem' }} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}>
          <option value="all">所有日期</option>
          {allDates.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div className="test-container animate-fade">
      {/* Test Toolbar */}
      <div className="glass-panel test-selector-bar" style={{ padding: '0.75rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>范围:</span>
          <select className="custom-select" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}>
            <option value="all">所有日期</option>
            {allDates.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button 
            className={`nav-tab ${testMode === 'cloze' ? 'active' : ''}`}
            onClick={() => setTestMode('cloze')}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
          >
            🧩 挖空填空
          </button>
          <button 
            className={`nav-tab ${testMode === 'dictation' ? 'active' : ''}`}
            onClick={() => setTestMode('dictation')}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
          >
            ✍️ 概念默写
          </button>
        </div>
      </div>

      {/* Main Testing Card */}
      <div className="glass-panel" style={{ minHeight: '320px', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            <span>{currentTest.date} • {currentTest.itemTitle}</span>
            <span>进度: {currentIndex + 1} / {testList.length}</span>
          </div>

          {/* Mode A: Cloze Test */}
          {testMode === 'cloze' && (
            <div style={{ lineHeight: '2', fontSize: '1.05rem', margin: '2rem 0' }}>
              <div style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '1rem', fontFamily: 'var(--font-display)', fontSize: '1.3rem' }}>
                {currentTest.concept}
              </div>
              <div>
                <strong>释义挖空：</strong>
                {renderClozeText(currentTest.description)}
              </div>
            </div>
          )}

          {/* Mode B: Dictation / Writing Test */}
          {testMode === 'dictation' && (
            <div className="dictation-pane">
              <div className="dictation-question-title">
                {currentTest.concept}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                请在下方文本框中默写出该名词的定义与特征（重点关注核心词）：
              </div>
              
              <textarea
                className="dictation-textarea"
                placeholder="在此输入您的默写答案..."
                value={dictationInput}
                onChange={(e) => setDictationInput(e.target.value)}
                disabled={isDictationSubmitted}
              />
            </div>
          )}
        </div>

        {/* Results and Scoring Panels */}
        <div>
          {/* Cloze Score Show */}
          {testMode === 'cloze' && isClozeSubmitted && (
            <div className="glass-panel animate-fade" style={{ padding: '1rem', background: 'rgba(0, 0, 0, 0.2)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div className={`score-badge-large ${getClozeScore() >= 80 ? 'score-high' : getClozeScore() >= 60 ? 'score-mid' : 'score-low'}`}>
                {getClozeScore()}
              </div>
              <div>
                <h4 style={{ color: 'var(--text-primary)' }}>填空测试完成</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  本卡片共有 {currentTest.keywords.length} 个核心词，您答对了其中 {Math.round((getClozeScore() / 100) * currentTest.keywords.length)} 个。
                </p>
              </div>
            </div>
          )}

          {/* Dictation Score Show */}
          {testMode === 'dictation' && isDictationSubmitted && (
            <div className="ai-feedback-container">
              {isGrading ? (
                <div className="loading-overlay">
                  <div className="spinner"></div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>AI 正在分析您的答案，判定近义词表达...</span>
                </div>
              ) : (
                aiResult && (
                  <div className="glass-panel animate-fade" style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1rem' }}>
                      <div className={`score-badge-large ${aiResult.score >= 85 ? 'score-high' : aiResult.score >= 60 ? 'score-mid' : 'score-low'}`}>
                        {aiResult.score}
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                          <span>智能评分完成</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>满分 100</span>
                        </h4>
                        <div className="ai-eval-details" style={{ marginTop: '0.5rem' }}>
                          <p style={{ fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                            <strong>评分意见：</strong>{aiResult.comments}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Keywords Matched Detail */}
                    <div style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                      <div style={{ marginBottom: '0.25rem' }}>标准得分点命中情况：</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {aiResult.matches && aiResult.matches.map(m => (
                          <span key={m} style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--success)', color: 'var(--success)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                            ✓ {m}
                          </span>
                        ))}
                        {aiResult.misses && aiResult.misses.map(m => (
                          <span key={m} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                            ✗ {m}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Synonym mappings */}
                    {aiResult.synonyms && aiResult.synonyms.length > 0 && (
                      <div style={{ marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        ℹ️ <strong>识别到的同义词：</strong>
                        {aiResult.synonyms.map((s, idx) => (
                          <span key={idx} style={{ marginLeft: '0.5rem' }}>
                            “{s.student}” ➔ “{s.standard}”{idx < aiResult.synonyms.length - 1 ? '，' : ''}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Side-by-side comparison */}
                    <div className="comparison-box">
                      <div className="comparison-pane">
                        <h5>您的回答</h5>
                        <div className="comparison-pane-content" style={{ color: 'var(--text-secondary)' }}>
                          {dictationInput}
                        </div>
                      </div>
                      <div className="comparison-pane">
                        <h5>标准释义（重点已加粗）</h5>
                        <div className="comparison-pane-content">
                          {currentTest.description.split(/(\*\*.*?\*\*)/).map((p, idx) => {
                            if (p.startsWith('**') && p.endsWith('**')) {
                              return <strong key={idx} style={{ color: 'var(--primary)' }}>{p.slice(2, -2)}</strong>;
                            }
                            return <span key={idx}>{p}</span>;
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* Trigger button row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            {testMode === 'cloze' && !isClozeSubmitted && (
              <button className="text-btn primary-btn" onClick={submitCloze}>
                提交检查
              </button>
            )}
            
            {testMode === 'dictation' && !isDictationSubmitted && (
              <button className="text-btn primary-btn" onClick={submitDictation} disabled={!dictationInput.trim()}>
                提交 AI 语义评分
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation footer */}
      <div className="nav-buttons-row">
        <button className="text-btn" onClick={handlePrev} disabled={currentIndex === 0}>
          ◀️ 上一条
        </button>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
          进度: {currentIndex + 1} / {testList.length}
        </span>
        <button className="text-btn" onClick={handleNext} disabled={currentIndex === testList.length - 1}>
          下一条 ▶️
        </button>
      </div>
    </div>
  );
}
