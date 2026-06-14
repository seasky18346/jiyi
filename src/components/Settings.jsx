import React, { useState } from 'react';

export default function Settings({ settings, onSaveSettings, onSyncCloud, isSyncing }) {
  const [apiKey, setApiKey] = useState(settings.apiKey || '');
  const [apiUrl, setApiUrl] = useState(settings.apiUrl || 'https://api.siliconflow.cn/v1');
  const [apiModel, setApiModel] = useState(settings.apiModel || 'Qwen/Qwen2.5-7B-Instruct');

  // WebDAV Configuration
  const [webdavEnabled, setWebdavEnabled] = useState(settings.webdavEnabled || false);
  const [webdavUrl, setWebdavUrl] = useState(settings.webdavUrl || 'https://dav.jianguoyun.com/dav/KaoyanRecitation');
  const [webdavUser, setWebdavUser] = useState(settings.webdavUser || '');
  const [webdavPassword, setWebdavPassword] = useState(settings.webdavPassword || '');

  const [message, setMessage] = useState({ type: '', text: '' });

  const handleSave = (e) => {
    e.preventDefault();
    onSaveSettings({
      apiKey,
      apiUrl,
      apiModel,
      webdavEnabled,
      webdavUrl,
      webdavUser,
      webdavPassword
    });
    setMessage({ type: 'success', text: '设置保存成功！' });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleSync = async (direction) => {
    if (!webdavEnabled || !webdavUrl || !webdavUser || !webdavPassword) {
      setMessage({ type: 'error', text: '请先启用并填写完整的 WebDAV（坚果云）配置！' });
      return;
    }
    
    setMessage({ type: 'info', text: direction === 'pull' ? '正在从云端拉取同步...' : '正在上传同步至云端...' });
    
    try {
      await onSyncCloud(direction);
      setMessage({ 
        type: 'success', 
        text: direction === 'pull' 
          ? '云端数据同步成功！本地背诵内容及遗忘曲线进度已更新。' 
          : '成功同步至云端！现在您可在移动端或其他设备拉取最新进度。' 
      });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: `同步失败: ${err.message}` });
    }
  };

  return (
    <div className="settings-container animate-fade">
      <div className="section-title">
        <span>⚙️ 系统设置与多端同步</span>
      </div>

      <div className="glass-panel settings-panel">
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Message Alert */}
          {message.text && (
            <div 
              className="glass-panel" 
              style={{ 
                padding: '0.75rem 1rem', 
                fontSize: '0.85rem',
                backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : message.type === 'info' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                borderColor: message.type === 'success' ? 'var(--success)' : message.type === 'info' ? 'var(--info)' : 'var(--danger)',
                color: message.type === 'success' ? 'var(--success)' : message.type === 'info' ? 'var(--info)' : 'var(--danger)'
              }}
            >
              {message.type === 'success' ? '✅' : message.type === 'info' ? 'ℹ️' : '❌'} {message.text}
            </div>
          )}

          {/* AI Settings Section */}
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <h4 style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🤖 AI 智能同义词打分配置</span>
            </h4>

            <div className="settings-row">
              <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>API Key</label>
              <input
                className="form-input-text"
                type="password"
                placeholder="请输入您的 OpenAI 兼容 API Key (tp-...)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                您提供的 Token 已预填。如使用小米 Mimo Token Plan 亦使用此配置。
              </span>
            </div>

            <div className="settings-row">
              <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>API 接口地址 (Base URL)</label>
              <input
                className="form-input-text"
                type="text"
                placeholder="https://api.siliconflow.cn/v1"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
              />
            </div>

            <div className="settings-row">
              <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>评分模型名称 (Model Name)</label>
              <input
                className="form-input-text"
                type="text"
                placeholder="Qwen/Qwen2.5-7B-Instruct"
                value={apiModel}
                onChange={(e) => setApiModel(e.target.value)}
              />
            </div>
          </div>

          {/* Cloud Sync Section */}
          <div>
            <div className="settings-row-horizontal">
              <h4 style={{ fontFamily: 'var(--font-display)', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>☁️ 坚果云多端云同步 (WebDAV)</span>
              </h4>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={webdavEnabled} 
                  onChange={(e) => setWebdavEnabled(e.target.checked)} 
                />
                <span className="slider"></span>
              </label>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              启用后，背诵进度与修改后的知识库可通过坚果云同步，使 iPad/iPhone 访问相同网页即可读取最新内容。
            </p>

            {webdavEnabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0, 0, 0, 0.15)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                <div className="settings-row">
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>坚果云 WebDAV 地址</label>
                  <input
                    className="form-input-text"
                    type="text"
                    value={webdavUrl}
                    onChange={(e) => setWebdavUrl(e.target.value)}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    建议在坚果云中创建一个文件夹（例如：KaoyanRecitation）
                  </span>
                </div>

                <div className="settings-row">
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>坚果云账号 (邮箱)</label>
                  <input
                    className="form-input-text"
                    type="email"
                    placeholder="example@email.com"
                    value={webdavUser}
                    onChange={(e) => setWebdavUser(e.target.value)}
                  />
                </div>

                <div className="settings-row">
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>坚果云应用密码 (非登录密码)</label>
                  <input
                    className="form-input-text"
                    type="password"
                    placeholder="请输入坚果云后台生成的 WebDAV 应用密码"
                    value={webdavPassword}
                    onChange={(e) => setWebdavPassword(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => handleSync('pull')}
                    disabled={isSyncing}
                    style={{ flex: 1 }}
                  >
                    ⬇️ 从云端拉取同步
                  </button>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => handleSync('push')}
                    disabled={isSyncing}
                    style={{ flex: 1 }}
                  >
                    ⬆️ 同步保存至云端
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="submit" className="text-btn primary-btn" style={{ width: '120px', display: 'flex', justifyContent: 'center' }}>
              保存设置
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
