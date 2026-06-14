import React, { useState, useEffect, useRef } from 'react';

export default function ReciteCard({ recitationData, progress, onRateCard }) {
  const [selectedDate, setSelectedDate] = useState('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [maskKeywords, setMaskKeywords] = useState(true);
  const [revealedKeywords, setRevealedKeywords] = useState({});
  
  // TTS State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(-1);
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  
  const synthRef = useRef(window.speechSynthesis);
  const sentencesRef = useRef([]);
  const currentUtteranceRef = useRef(null);
  const currentSentenceIdxRef = useRef(-1);

  // Get active items list
  const allDates = recitationData.map(g => g.date);
  
  const pointsList = [];
  recitationData.forEach(group => {
    if (selectedDate === 'all' || group.date === selectedDate) {
      group.items.forEach(item => {
        if (item.points) {
          item.points.forEach(point => {
            pointsList.push({
              date: group.date,
              itemTitle: item.title,
              ...point
            });
          });
        }
      });
    }
  });

  const currentCard = pointsList[currentIndex];

  // Reset when date change
  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
    stopTTS();
  }, [selectedDate]);

  // Reset flip when card change
  useEffect(() => {
    setIsFlipped(false);
    setRevealedKeywords({});
    stopTTS();
  }, [currentIndex]);

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      stopTTS();
    };
  }, []);

  const handleFlip = (e) => {
    // Avoid flipping if user is clicking a masked keyword or buttons
    if (
      e.target.classList.contains('keyword-masked') || 
      e.target.closest('.eval-btn') || 
      e.target.closest('.tts-controls-panel') ||
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
    if (currentIndex < pointsList.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Leitner rate card wrapper
  const handleRate = (rating) => {
    if (currentCard) {
      onRateCard(currentCard.id, rating);
      // Automatically advance to next card after rating
      if (currentIndex < pointsList.length - 1) {
        setTimeout(() => {
          setCurrentIndex(currentIndex + 1);
        }, 300);
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

  // --- TTS Implementation ---
  // Splits a string into sentences while keeping delimiters
  const splitIntoSentences = (text) => {
    // Strip markdown formatting like ** for speech
    const cleanText = text.replace(/\*\*/g, '');
    // Split by punctuation
    const matches = cleanText.split(/([。！吗？；;!?\n])/);
    const sentences = [];
    for (let i = 0; i < matches.length; i += 2) {
      const sentence = (matches[i] || '') + (matches[i + 1] || '');
      if (sentence.trim()) {
        sentences.push(sentence.trim());
      }
    }
    return sentences;
  };

  const startTTS = () => {
    if (!currentCard) return;
    
    stopTTS();
    
    // Read Concept then standard definition
    const fullText = `概念：${currentCard.concept}。定义是：${currentCard.description}`;
    const sentences = splitIntoSentences(fullText);
    sentencesRef.current = sentences;
    sentencesRef.current = sentences;
    currentSentenceIdxRef.current = 0;
    
    setIsSpeaking(true);
    speakSentence();
  };

  const speakSentence = () => {
    if (!synthRef.current) return;
    
    const idx = currentSentenceIdxRef.current;
    if (idx >= sentencesRef.current.length) {
      stopTTS();
      return;
    }

    setActiveSentenceIndex(idx);
    const text = sentencesRef.current[idx];
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = ttsSpeed;
    
    utterance.onend = () => {
      currentSentenceIdxRef.current += 1;
      speakSentence();
    };

    utterance.onerror = (e) => {
      console.error('TTS Error:', e);
      stopTTS();
    };

    currentUtteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  };

  const stopTTS = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsSpeaking(false);
    setActiveSentenceIndex(-1);
    currentSentenceIdxRef.current = -1;
  };

  const toggleTTS = () => {
    if (isSpeaking) {
      stopTTS();
    } else {
      startTTS();
    }
  };

  // Adjust speed in real-time
  useEffect(() => {
    if (isSpeaking) {
      // Restart current sentence at new speed
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      speakSentence();
    }
  }, [ttsSpeed]);

  // Helper: Render description with masked bold keywords
  const renderDescription = (description) => {
    // Description text e.g. "是关于地理实体性质、特征和运动状态的**原始描述**或**事实记录**"
    // Split by ** to find keywords
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

  // Split card description into sentence elements for visual highlighting during speech
  const renderSentencesHighlight = (description) => {
    const parts = description.split(/([。！吗？；;!?\n])/);
    const sentences = [];
    for (let i = 0; i < parts.length; i += 2) {
      const sentence = (parts[i] || '') + (parts[i + 1] || '');
      if (sentence.trim()) {
        sentences.push(sentence);
      }
    }

    // Determine if we are highlighting. Since we prepended "概念：xxx。定义是：", 
    // the text spoken starts with two extra sentences.
    // So the description sentences map to speaker index minus 2.
    return sentences.map((sentence, index) => {
      const isCurrentSpoken = isSpeaking && (activeSentenceIndex === index + 2);
      return (
        <span key={index} className={isCurrentSpoken ? 'tts-reading-sentence' : ''}>
          {renderDescription(sentence)}
        </span>
      );
    });
  };

  if (!currentCard) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
        <h3>暂无背诵条目</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>请检查您的知识库或选择其他日期。</p>
        <select className="custom-select" style={{ marginTop: '1rem' }} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}>
          <option value="all">所有日期</option>
          {allDates.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div className="recite-container animate-fade">
      {/* Recite Toolbar */}
      <div className="recite-toolbar">
        <div className="toolbar-group">
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>背诵范围:</span>
          <select className="custom-select" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}>
            <option value="all">所有日期</option>
            {allDates.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div className="toolbar-group">
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>关键词隐藏</span>
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
              {currentCard.date} • {currentIndex + 1} / {pointsList.length}
            </div>
            
            <div className="card-title">
              {currentCard.concept}
            </div>
            
            <div className="card-hint">
              <span>🖱️ 点击卡片翻面</span>
            </div>
          </div>
          
          {/* Card Back */}
          <div className="flashcard-face glass-panel flashcard-back">
            <div className="card-content-header">
              <span>{currentCard.concept}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {currentCard.date} • {currentCard.itemTitle}
              </span>
            </div>
            
            <div className="card-points-list" style={{ flex: 1 }}>
              <div className="card-point-item">
                <span className="point-concept">【标准释义】</span>
                {renderSentencesHighlight(currentCard.description)}
              </div>
            </div>
            
            {/* Embedded Audio Guide Controls */}
            <div className="tts-controls-panel glass-panel" style={{ marginTop: '1rem', background: 'rgba(0, 0, 0, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button className="tts-play-btn" onClick={toggleTTS} title={isSpeaking ? "停止" : "朗读带背"}>
                  {isSpeaking ? '⏹️' : '▶️'}
                </button>
                <span style={{ fontSize: '0.8rem', fontWeight: '500' }}>
                  {isSpeaking ? '正在语音带背中...' : '点击语音带背'}
                </span>
              </div>
              
              <div className="tts-speed-slider">
                <span>语速 {ttsSpeed.toFixed(1)}x</span>
                <input 
                  type="range" 
                  min="0.6" 
                  max="1.8" 
                  step="0.1" 
                  value={ttsSpeed} 
                  onChange={(e) => setTtsSpeed(parseFloat(e.target.value))} 
                />
              </div>
            </div>
          </div>
          
        </div>
      </div>

      {/* Actions & Leitner Self Assessment (Show only when flipped) */}
      {isFlipped ? (
        <div className="evaluation-bar-container animate-fade">
          <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            根据您的记忆情况进行评估，系统将自动安排复习周期
          </div>
          <div className="evaluation-bar">
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
              <span className="eval-interval">4天后复习</span>
            </button>
            <button className="eval-btn easy" onClick={() => handleRate('easy')}>
              <span>✨ 简单</span>
              <span className="eval-interval">7天后复习</span>
            </button>
          </div>
        </div>
      ) : (
        <div style={{ height: '74px' }}></div> // Spacer to prevent layout shifts
      )}

      {/* Footer Navigation Buttons */}
      <div className="nav-buttons-row">
        <button className="text-btn" onClick={handlePrev} disabled={currentIndex === 0}>
          ◀️ 上一张
        </button>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
          进度: {currentIndex + 1} / {pointsList.length}
        </span>
        <button className="text-btn" onClick={handleNext} disabled={currentIndex === pointsList.length - 1}>
          下一张 ▶️
        </button>
      </div>
    </div>
  );
}
