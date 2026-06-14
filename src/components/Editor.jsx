import React, { useState, useEffect } from 'react';

export default function Editor({ recitationData, onSaveRecitation }) {
  const [selectedItemPath, setSelectedItemPath] = useState('');
  const [editedGroupIndex, setEditedGroupIndex] = useState(-1);
  const [editedItemIndex, setEditedItemIndex] = useState(-1);
  
  // Form state
  const [itemTitle, setItemTitle] = useState('');
  const [points, setPoints] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Gather items for sidebar
  const sidebarItems = [];
  recitationData.forEach((group, gIdx) => {
    group.items.forEach((item, iIdx) => {
      sidebarItems.push({
        path: `${gIdx}_${iIdx}`,
        groupIndex: gIdx,
        itemIndex: iIdx,
        date: group.date,
        title: item.title,
        id: item.id
      });
    });
  });

  // Load selected item into form
  useEffect(() => {
    if (selectedItemPath) {
      const [gIdx, iIdx] = selectedItemPath.split('_').map(Number);
      const item = recitationData[gIdx]?.items[iIdx];
      if (item) {
        setEditedGroupIndex(gIdx);
        setEditedItemIndex(iIdx);
        setItemTitle(item.title);
        // Deep clone points to prevent direct mutation before save
        setPoints(item.points ? JSON.parse(JSON.stringify(item.points)) : []);
        setMessage({ type: '', text: '' });
      }
    } else if (sidebarItems.length > 0) {
      setSelectedItemPath(sidebarItems[0].path);
    }
  }, [selectedItemPath, recitationData]);

  // Handle saving
  const handleSave = async (e) => {
    e.preventDefault();
    if (editedGroupIndex === -1 || editedItemIndex === -1) return;

    setIsSaving(true);
    setMessage({ type: '', text: '' });

    // Create a copy of the entire recitation data to modify
    const updatedData = JSON.parse(JSON.stringify(recitationData));
    
    // Update the edited item
    const targetItem = updatedData[editedGroupIndex].items[editedItemIndex];
    targetItem.title = itemTitle;
    
    // Process points and rebuild rawContent for simplicity (backend will use points)
    targetItem.points = points.map(p => {
      // Re-extract keywords on save based on ** markers
      const keywords = [];
      const regex = /\*\*(.*?)\*\*/g;
      let kwMatch;
      while ((kwMatch = regex.exec(p.description)) !== null) {
        const kw = kwMatch[1].trim();
        if (kw && !keywords.includes(kw)) {
          keywords.push(kw);
        }
      }
      return { ...p, keywords };
    });

    try {
      await onSaveRecitation(updatedData);
      setMessage({ type: 'success', text: '修改保存成功！本地 Markdown 文件已完成同步与备份。' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: `保存失败: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePointChange = (idx, field, value) => {
    const updatedPoints = [...points];
    updatedPoints[idx][field] = value;
    setPoints(updatedPoints);
  };

  const addPoint = () => {
    if (editedGroupIndex === -1 || editedItemIndex === -1) return;
    const item = recitationData[editedGroupIndex].items[editedItemIndex];
    const newId = `${item.id}_${points.length + 1}`;
    setPoints([
      ...points,
      {
        id: newId,
        concept: '新核心概念',
        description: '请在这里输入描述，加粗核心词，例如：使用**加粗符号**包裹。',
        keywords: []
      }
    ]);
  };

  const removePoint = (idx) => {
    const updatedPoints = points.filter((_, i) => i !== idx);
    setPoints(updatedPoints);
  };

  return (
    <div className="editor-container animate-fade">
      {/* Sidebar List */}
      <div className="editor-sidebar glass-panel" style={{ padding: '1rem' }}>
        <div className="section-title" style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
          <span>📚 知识库大纲</span>
        </div>
        <div className="sidebar-list">
          {sidebarItems.map(item => (
            <button
              key={item.path}
              className={`sidebar-item ${selectedItemPath === item.path ? 'active' : ''}`}
              onClick={() => setSelectedItemPath(item.path)}
            >
              <div className="sidebar-item-date">{item.date.split('：')[0]}</div>
              <div className="sidebar-item-title">{item.id}. {item.title}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Edit Form */}
      <div className="editor-main-pane glass-panel">
        {editedGroupIndex !== -1 && editedItemIndex !== -1 ? (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card-content-header" style={{ marginBottom: '0' }}>
              <span>✏️ 编辑背诵条目</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                所属日期: {recitationData[editedGroupIndex].date}
              </span>
            </div>

            {/* Message Alert */}
            {message.text && (
              <div 
                className="glass-panel" 
                style={{ 
                  padding: '0.75rem 1rem', 
                  fontSize: '0.85rem',
                  backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  borderColor: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
                  color: message.type === 'success' ? 'var(--success)' : 'var(--danger)'
                }}
              >
                {message.type === 'success' ? '✅' : '❌'} {message.text}
              </div>
            )}

            {/* Item Title */}
            <div className="form-group">
              <label htmlFor="item-title">条目标题</label>
              <input
                id="item-title"
                className="form-input-text"
                type="text"
                value={itemTitle}
                onChange={(e) => setItemTitle(e.target.value)}
                required
              />
            </div>

            {/* List of points inside the item */}
            <div className="form-group" style={{ gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>📋 核心考点明细</label>
                <button 
                  type="button" 
                  className="text-btn" 
                  onClick={addPoint}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                >
                  ➕ 添加概念
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {points.map((point, idx) => (
                  <div 
                    key={point.id || idx} 
                    className="glass-panel" 
                    style={{ padding: '1rem', background: 'rgba(0, 0, 0, 0.15)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                        考点 #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePoint(idx)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.85rem' }}
                        title="删除此考点"
                      >
                        🗑️ 删除
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                      {/* Concept Name */}
                      <div className="form-group">
                        <label>核心概念名词</label>
                        <input
                          className="form-input-text"
                          type="text"
                          value={point.concept}
                          onChange={(e) => handlePointChange(idx, 'concept', e.target.value)}
                          required
                        />
                      </div>

                      {/* Description */}
                      <div className="form-group">
                        <label>标准释义描述 (使用 **核心词** 来加粗，作为测试重点)</label>
                        <textarea
                          className="form-input-text"
                          value={point.description}
                          onChange={(e) => handlePointChange(idx, 'description', e.target.value)}
                          style={{ resize: 'vertical', minHeight: '80px', fontFamily: 'var(--font-sans)', fontSize: '0.9rem', lineHeight: '1.5' }}
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
              <button 
                type="submit" 
                className="text-btn primary-btn"
                disabled={isSaving}
              >
                {isSaving ? '正在保存...' : '💾 保存修改'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
            请在左侧选择需要编辑的背诵条目
          </div>
        )}
      </div>
    </div>
  );
}
