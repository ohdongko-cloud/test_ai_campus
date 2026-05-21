"use client";

import { useState, useEffect } from 'react';
import { GuideGroup, GuideServiceItem } from '../lib/types';
import { getGuideGroups, setGuideGroups, getNoaUrl, setNoaUrl, generateId } from '../lib/utils';

const EMPTY_ITEM = (): GuideServiceItem => ({
  id: generateId(), name: '', description: '', cost: '', url: '', recommended: false,
});

const EMPTY_GROUP = (): GuideGroup => ({
  id: generateId(), name: '', description: '', items: [],
});

export default function AdminGuide() {
  const [groups, setGroupsState] = useState<GuideGroup[]>([]);
  const [noaUrl, setNoaUrlState] = useState('');
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    setGroupsState(getGuideGroups());
    setNoaUrlState(getNoaUrl());
  }, []);

  const save = (next: GuideGroup[]) => {
    setGuideGroups(next);
    setGroupsState(next);
    window.dispatchEvent(new Event('storage'));
    setSavedMsg('저장되었습니다.');
    setTimeout(() => setSavedMsg(''), 2000);
  };

  const saveNoa = () => {
    // URL 검증: http(s):// 로 시작해야 함
    try {
      const u = new URL(noaUrl);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
    } catch {
      setSavedMsg('올바른 URL을 입력해주세요. (https://...)');
      setTimeout(() => setSavedMsg(''), 3000);
      return;
    }
    setNoaUrl(noaUrl);
    window.dispatchEvent(new Event('storage'));
    setSavedMsg('NOA URL이 저장되었습니다.');
    setTimeout(() => setSavedMsg(''), 2000);
  };

  // 그룹 추가
  const addGroup = () => {
    const ng = EMPTY_GROUP();
    const next = [...groups, ng];
    save(next);
    setOpenGroupId(ng.id);
  };

  // 그룹 삭제
  const removeGroup = (gid: string) => {
    save(groups.filter(g => g.id !== gid));
    if (openGroupId === gid) setOpenGroupId(null);
  };

  // 그룹 필드 수정
  const updateGroup = (gid: string, field: 'name' | 'description', value: string) => {
    const next = groups.map(g => g.id === gid ? { ...g, [field]: value } : g);
    setGroupsState(next);
  };

  // 그룹 저장 (blur 또는 버튼)
  const saveGroup = (gid: string) => {
    save(groups);
    // 명시적 저장 호출이므로 현재 state 기준
    void gid;
  };

  // 아이템 추가
  const addItem = (gid: string) => {
    const next = groups.map(g => g.id === gid ? { ...g, items: [...g.items, EMPTY_ITEM()] } : g);
    save(next);
  };

  // 아이템 삭제
  const removeItem = (gid: string, iid: string) => {
    const next = groups.map(g => g.id === gid ? { ...g, items: g.items.filter(i => i.id !== iid) } : g);
    save(next);
  };

  // 아이템 필드 수정 (즉시 저장)
  const updateItem = (gid: string, iid: string, field: keyof GuideServiceItem, value: string | boolean) => {
    const next = groups.map(g =>
      g.id === gid
        ? { ...g, items: g.items.map(i => i.id === iid ? { ...i, [field]: value } : i) }
        : g
    );
    setGroupsState(next);
  };

  const saveItems = (gid: string) => {
    save(groups);
    void gid;
  };

  const inputStyle = {
    width: '100%', border: '1.5px solid #E2E8F0', borderRadius: 6,
    padding: '7px 10px', fontSize: 13, color: '#0F1E33',
    outline: 'none', boxSizing: 'border-box' as const, background: '#fff',
  };

  return (
    <div className="space-y-6">
      {savedMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded p-3 text-sm">
          {savedMsg}
        </div>
      )}

      {/* NOA URL 설정 */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">NOA 링크 설정</h3>
        <div className="flex gap-3 items-center">
          <input
            value={noaUrl}
            onChange={e => setNoaUrlState(e.target.value)}
            placeholder="https://noa.eland.com"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={saveNoa}
            className="px-4 py-2 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap">
            저장
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">홈 화면 "NOA 사용하기" 카드에서 사용됩니다.</p>
      </div>

      {/* 서비스 그룹 관리 */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800">서비스 그룹 관리</h3>
          <button onClick={addGroup}
            className="px-3 py-1.5 rounded text-xs font-medium bg-gray-900 text-white hover:bg-black transition-colors">
            + 그룹 추가
          </button>
        </div>

        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* 그룹 헤더 (접기/펼치기) */}
              <div
                className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setOpenGroupId(openGroupId === group.id ? null : group.id)}
              >
                <span className="text-sm font-semibold text-gray-800">
                  {group.name || '(그룹명 없음)'} <span className="text-gray-400 font-normal text-xs ml-1">({group.items.length}개)</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); removeGroup(group.id); }}
                    className="text-xs text-red-500 hover:text-red-700 px-2 py-0.5 rounded border border-red-200 hover:bg-red-50 transition-colors"
                  >삭제</button>
                  <span className="text-gray-400 text-sm">{openGroupId === group.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* 그룹 상세 편집 */}
              {openGroupId === group.id && (
                <div className="p-4 space-y-4">
                  {/* 그룹 기본 정보 */}
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">그룹명</label>
                      <input value={group.name} onChange={e => updateGroup(group.id, 'name', e.target.value)}
                        onBlur={() => saveGroup(group.id)} placeholder="예: 개발 환경 및 소스 관리" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">그룹 설명</label>
                      <input value={group.description} onChange={e => updateGroup(group.id, 'description', e.target.value)}
                        onBlur={() => saveGroup(group.id)} placeholder="그룹 역할 설명" style={inputStyle} />
                    </div>
                  </div>

                  {/* 서비스 아이템 목록 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-gray-700">서비스 목록</label>
                      <button onClick={() => addItem(group.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ 서비스 추가</button>
                    </div>
                    <div className="space-y-3">
                      {group.items.map(item => (
                        <div key={item.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50 space-y-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-700">{item.name || '새 서비스'}</span>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox" checked={item.recommended}
                                  onChange={e => {
                                    const checked = e.target.checked;
                                    const next = groups.map(g =>
                                      g.id === group.id
                                        ? { ...g, items: g.items.map(i => i.id === item.id ? { ...i, recommended: checked } : i) }
                                        : g
                                    );
                                    save(next);
                                  }}
                                  className="w-3.5 h-3.5 accent-green-600" />
                                <span className="text-xs text-gray-600">추천</span>
                              </label>
                              <button onClick={() => removeItem(group.id, item.id)}
                                className="text-xs text-red-400 hover:text-red-600">✕ 삭제</button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">서비스명</label>
                              <input value={item.name} onChange={e => updateItem(group.id, item.id, 'name', e.target.value)}
                                onBlur={() => saveItems(group.id)} placeholder="GitHub" style={inputStyle} />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">비용</label>
                              <input value={item.cost} onChange={e => updateItem(group.id, item.id, 'cost', e.target.value)}
                                onBlur={() => saveItems(group.id)} placeholder="무료 / 유료 플랜" style={inputStyle} />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">설명</label>
                            <input value={item.description} onChange={e => updateItem(group.id, item.id, 'description', e.target.value)}
                              onBlur={() => saveItems(group.id)} placeholder="서비스 설명" style={inputStyle} />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">공식 URL</label>
                            <input value={item.url} onChange={e => updateItem(group.id, item.id, 'url', e.target.value)}
                              onBlur={() => saveItems(group.id)} placeholder="https://..." style={inputStyle} />
                          </div>
                        </div>
                      ))}
                      {group.items.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-3">서비스가 없습니다. "+ 서비스 추가"를 눌러 추가하세요.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {groups.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">그룹이 없습니다. "+ 그룹 추가"를 눌러 시작하세요.</p>
          )}
        </div>
      </div>
    </div>
  );
}
