import React from 'react';
import { GraduationCap, Target, ClipboardCheck, Archive, ChartLine } from 'lucide-react';

export default function BottomNav({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'home', label: '学习首页', icon: GraduationCap },
    { id: 'practice', label: '专项训练', icon: Target },
    { id: 'report', label: '阅卷分析', icon: ClipboardCheck },
    { id: 'editor', label: '题库管理', icon: Archive },
    { id: 'stats', label: '统计趋势', icon: ChartLine },
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => {
        const IconComponent = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
          >
            <div className="bottom-nav-icon-wrapper">
              <IconComponent size={24} />
            </div>
            <span className="bottom-nav-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
