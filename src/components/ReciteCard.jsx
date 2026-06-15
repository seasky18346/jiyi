import React, { useState, useEffect, useRef } from 'react';

export default function ReciteCard({ recitationData, onRateCard }) {
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedChapter, setSelectedChapter] = useState('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [maskKeywords, setMaskKeywords] = useState(true);
  const [revealedKeywords, setRevealedKeywords] = useState({});
  
  // Extract unique subjects and chapters from flat questions list
  const subjects = [...new Set(recitationData.map(q => q.subject).filter(Boolean))];
  const chapters = [...new Set(recitationData.map(q => q.chapter).filter(Boolean))];

  // Filter cards based on subject and chapter
  const filteredCards = recitationData.filter(q => {
    const subjectMatch = selectedSubject === 'all' || q.subject === selectedSubject;
    const chapterMatch = selectedChapter === 'all' || q.chapter === selectedChapter;
    return subjectMatch && chapterMatch;
  });

  const currentCard = filteredCards[currentIndex];

  // Reset when filters change
  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [selectedSubject, selectedChapter]);

  // Reset flip when card changes
  useEffect(() => {
    setIsFlipped(false);
    setRevealedKeywords({});
  }, [currentIndex]);

  const handleFlip = (e) => {
    if (
      e.target.classList.contains('keyword-masked') || 
      e.target.closest('.eval-btn') || 
      e.target.closest('.nav-buttons-row') ||
      e.target.closest('.custom-select') ||
      e.target.closest('.switch')
    ) {
      return;
    }
    setIsFlipped(!isFlipped);
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < filteredCards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleRate = async (rating) => {
    if (currentCard) {
      await onRateCard(currentCard.id, rating);
      // Automatically advance to next card after rating
      if (currentIndex < filteredCards.length - 1) {
        setTimeout(() => {
          setCurrentIndex(currentIndex + 1);
        }, 300);
      } else {
        await window.customAlert('这是本分类的最后一张卡片啦！已完成本轮自评。');
      }
    }
  };

  const toggleKeyword = (kw, index) => {
    const key = `${kw}_${index}`;
    setRevealedKeywords(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };



  const renderDescription = (description) => {
    const parts = description.split(/(\*\*.*?\*\*)/);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const kw = part.slice(2, -2);
        const isRevealed = !maskKeywords || revealedKeywords[`${kw}_${index}`];
        return (
          <span 
            key={index} 
            className={`keyword ${maskKeywords ? 'keyword-masked' : ''} ${isRevealed ? 'revealed' : ''}`}
            onClick={() => toggleKeyword(kw, index)}
            title={maskKeywords ? "点击显现/遮罩" : ""}
          >
            {kw}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };



  if (!currentCard) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
        <h3>暂无背诵卡片</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>请尝试调整分类筛选，或前往“编辑题库”新增内容。</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
          <select className="custom-select" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
            <option value="all">所有科目</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="custom-select" value={selectedChapter} onChange={(e) => setSelectedChapter(e.target.value)}>
            <option value="all">所有章节</option>
            {chapters.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="recite-container animate-fade">
      {/* Recite Toolbar */}
      <div className="recite-toolbar" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <select className="custom-select" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
            <option value="all">所有科目</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="custom-select" value={selectedChapter} onChange={(e) => setSelectedChapter(e.target.value)}>
            <option value="all">所有章节</option>
            {chapters.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="toolbar-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>核心词隐藏</span>
          <label className="switch">
            <input type="checkbox" checked={maskKeywords} onChange={(e) => setMaskKeywords(e.target.checked)} />
            <span className="slider"></span>
          </label>
        </div>
      </div>

      {/* Spaced Repetition Card Box */}
      <div className={`flashcard-wrapper ${isFlipped ? 'flipped' : ''}`} onClick={handleFlip}>
        <div className="flashcard-inner">
          
          {/* Card Front */}
          <div className="flashcard-face glass-panel flashcard-front">
            <div className="card-index">
              {currentCard.chapter} • {currentIndex + 1} / {filteredCards.length}
            </div>
            
            <div className="card-title" style={{ fontSize: '1.6rem', padding: '0 1rem' }}>
              {currentCard.question}
            </div>
            
            <div className="card-hint">
              <span>🖱️ 点击卡片翻面显示释义</span>
            </div>
          </div>
          
          {/* Card Back */}
          <div className="flashcard-face glass-panel flashcard-back" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-content-header" style={{ marginBottom: '0.5rem' }}>
              <span>{currentCard.question}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {currentCard.chapter} • 双合一复习卡
              </span>
            </div>
            
            <div className="card-points-list" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
              
              {/* Cloze section */}
              <div className="card-point-item" style={{ fontSize: '0.95rem', lineHeight: '1.6', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <span className="point-concept" style={{ color: 'var(--primary)', fontWeight: '600', marginRight: '0.5rem', display: 'block', marginBottom: '0.25rem' }}>
                  🧩 填空背诵要点
                </span>
                <div style={{ color: 'var(--text-primary)' }}>
                  {renderDescription(currentCard.cloze_answer)}
                </div>
              </div>

              {/* Essay section */}
              <div className="card-point-item" style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                <span className="point-concept" style={{ color: 'var(--success)', fontWeight: '600', marginRight: '0.5rem', display: 'block', marginBottom: '0.25rem' }}>
                  📝 论述展开细节
                </span>
                <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-line', marginBottom: '0.5rem' }}>
                  {currentCard.full_answer}
                </div>
                {currentCard.full_score_points && currentCard.full_score_points.length > 0 && (
                  <div style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '4px' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>详细得分点：</strong>
                    <ul style={{ paddingLeft: '1.2rem', marginTop: '0.25rem', color: 'var(--text-muted)', textAlign: 'left' }}>
                      {currentCard.full_score_points.map((pt, idx) => <li key={idx}>{pt}</li>)}
                    </ul>
                  </div>
                )}
              </div>

            </div>
          </div>
          
        </div>
      </div>

      {/* Actions & Leitner Self Assessment (Show only when flipped) */}
      {isFlipped ? (
        <div className="evaluation-bar-container animate-fade">
          <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            评估记忆程度，自动安排下次复习：
          </div>
          <div className="evaluation-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
            <button className="eval-btn forgot" onClick={() => handleRate('forgot')}>
              <span>❌ 忘记</span>
              <span className="eval-interval">1天后复习</span>
            </button>
            <button className="eval-btn hard" onClick={() => handleRate('hard')}>
              <span>⚠️ 困难</span>
              <span className="eval-interval">2天后复习</span>
            </button>
            <button className="eval-btn good" onClick={() => handleRate('good')}>
              <span>👍 良好</span>
              <span className="eval-interval">5天后复习</span>
            </button>
            <button className="eval-btn easy" onClick={() => handleRate('easy')}>
              <span>✨ 简单</span>
              <span className="eval-interval">12天后复习</span>
            </button>
          </div>
        </div>
      ) : (
        <div style={{ height: '74px' }}></div>
      )}

      {/* Footer Navigation Buttons */}
      <div className="nav-buttons-row">
        <button className="text-btn" onClick={handlePrev} disabled={currentIndex === 0}>
          ◀️ 上一张
        </button>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
          进度: {currentIndex + 1} / {filteredCards.length}
        </span>
        <button className="text-btn" onClick={handleNext} disabled={currentIndex === filteredCards.length - 1}>
          下一张 ▶️
        </button>
      </div>
    </div>
  );
}
