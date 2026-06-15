import React, { useState } from 'react';

export default function Settings({ theme, setTheme }) {
  const [message, setMessage] = useState('');

  const handleResetApp = async () => {
    if (!(await window.customConfirm('🚨 危险警告：这会删除服务器上的所有题目和学习记录，重置为出厂状态！请问真的要执行重置操作吗？'))) return;
    try {
      const res = await fetch('/api/questions/clear', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMessage('✅ 题库已成功重置！');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      await window.customAlert('重置失败: ' + err.message);
    }
  };

  return (
    <div className="settings-container animate-fade" style={{ maxWidth: '750px', margin: '0 auto' }}>
      <div className="section-title">
        <span>⚙️ 系统配置说明</span>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {message && (
          <div className="glass-panel" style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--success)', borderColor: 'var(--success)', backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>
            {message}
          </div>
        )}

        {/* Theme settings */}
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--accent)', marginBottom: '1rem', fontFamily: 'var(--font-display)' }}>
            🎨 系统个性化主题
          </h3>
          <div className="theme-selectors-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`theme-selector-card ${theme === 'misty-rose' ? 'active' : ''}`}
              onClick={() => {
                setTheme('misty-rose');
                localStorage.setItem('gis_review_theme', 'misty-rose');
              }}
              style={{
                flex: 1,
                minWidth: '200px',
                padding: '1rem',
                borderRadius: '12px',
                background: theme === 'misty-rose' ? 'rgba(255, 174, 185, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                border: theme === 'misty-rose' ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                color: 'var(--text-primary)'
              }}
            >
              <div style={{ fontWeight: '700', marginBottom: '0.25rem' }}>Misty Rose (浅色柔和)</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>优雅粉色天空与雾蓝雪丘渐变</div>
            </button>

            <button
              type="button"
              className={`theme-selector-card ${theme === 'orderly' ? 'active' : ''}`}
              onClick={() => {
                setTheme('orderly');
                localStorage.setItem('gis_review_theme', 'orderly');
              }}
              style={{
                flex: 1,
                minWidth: '200px',
                padding: '1rem',
                borderRadius: '12px',
                background: theme === 'orderly' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                border: theme === 'orderly' ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                color: 'var(--text-primary)'
              }}
            >
              <div style={{ fontWeight: '700', marginBottom: '0.25rem' }}>Orderly (深色专注)</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>立体微格纹黑色质感与高亮蓝色</div>
            </button>
          </div>
        </div>

        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>
            🛡️ 安全性与模型配置
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
            根据考研背诵系统优化安全指标，<strong>大模型 API Key 及 API 端点现已安全托管于后端服务器的 <code>.env</code> 配置文件中</strong>。
            前台不保存任何隐私凭证，有效防范泄密。
          </p>
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            提示：如需修改大模型参数，请在服务器端的 <code>.env</code> 文件中修改 <code>AI_API_KEY</code>、<code>AI_API_URL</code> 和 <code>AI_API_MODEL</code>。
          </div>
        </div>

        {/* Leitner rules info */}
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--secondary)', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>
            🧠 Spaced Repetition (间隔重复) 调度机制
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '0.5rem' }}>
            系统整合了“主动回忆测试打分”与“卡片自评”双重复习时间计算模型：
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.8rem' }}>
            <div style={{ padding: '0.75rem', background: 'rgba(0,d2,ff,0.03)', border: '1px solid rgba(0,d2,ff,0.1)', borderRadius: '6px' }}>
              <strong style={{ color: 'var(--primary)', display: 'block', marginBottom: '0.3rem' }}>📝 主动回忆打分触发规则：</strong>
              <ul style={{ paddingLeft: '1.2rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                <li>低于 5 分：<strong>第 1 天复习</strong>，掌握度下降</li>
                <li>5 - 7 分：<strong>第 3 天复习</strong></li>
                <li>8 - 9 分：<strong>第 7 天复习</strong></li>
                <li>10 分：<strong>第 15 天复习</strong></li>
              </ul>
            </div>
            <div style={{ padding: '0.75rem', background: 'rgba(139,92,246,0.03)', border: '1px solid rgba(139,92,246,0.1)', borderRadius: '6px' }}>
              <strong style={{ color: 'var(--secondary)', display: 'block', marginBottom: '0.3rem' }}>📖 卡片自评触发规则：</strong>
              <ul style={{ paddingLeft: '1.2rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                <li>忘记：<strong>第 1 天复习</strong></li>
                <li>困难：<strong>第 2 天复习</strong></li>
                <li>良好：<strong>第 5 天复习</strong></li>
                <li>简单：<strong>第 12 天复习</strong></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Sync concept description */}
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--success)', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>
            ☁️ 多端数据实时同步
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
            当前系统已完成以<strong>数据库为主数据源</strong>的重构。
            所有端（PC 浏览器、iPad/手机浏览器）均实时通过后端 API 查询并更新数据库。
            无论在哪个设备上作答，数据均能保持秒级同步。
          </p>
        </div>

        {/* Dangerous tools */}
        <div>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--danger)', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>
            ⚠️ 数据维护与重置
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            如果您需要将数据库清空，或重新导入全部资料大纲，可使用重置工具：
          </p>
          <button 
            type="button" 
            className="text-btn" 
            onClick={handleResetApp}
            style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)', padding: '0.5rem 1.5rem', fontSize: '0.85rem' }}
          >
            🚨 彻底清空并重置整个系统
          </button>
        </div>

      </div>
    </div>
  );
}
