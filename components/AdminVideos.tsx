"use client";

import { useState, useEffect } from 'react';
import { Video, VideoLevel, VideoStage } from '../lib/types';
import { getVideos, setVideos, extractVideoId, generateId, getVideoLevels, setVideoLevels } from '../lib/utils';

const iStyle = {
  width: '100%', border: '1.5px solid #E2E8F0', borderRadius: 6,
  padding: '7px 10px', fontSize: 13, color: '#0F1E33',
  outline: 'none', boxSizing: 'border-box' as const, background: '#fff',
};

function LevelEditRow({ level, onSave, onCancel }: {
  level: VideoLevel;
  onSave: (id: string, name: string, desc: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(level.name);
  const [desc, setDesc] = useState(level.description);
  return (
    <div className="flex items-center gap-2 flex-1">
      <input value={name} onChange={e => setName(e.target.value)}
        className="border border-gray-300 rounded px-2 py-1 text-xs flex-1 focus:outline-none" placeholder="레벨명" />
      <input value={desc} onChange={e => setDesc(e.target.value)}
        className="border border-gray-300 rounded px-2 py-1 text-xs flex-1 focus:outline-none" placeholder="설명" />
      <button onClick={() => onSave(level.id, name, desc)}
        className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1">저장</button>
      <button onClick={onCancel} className="text-xs text-gray-500 px-2 py-1">취소</button>
    </div>
  );
}

function StageEditor({ videoId, initialStages, onSave }: {
  videoId: string;
  initialStages: VideoStage[];
  onSave: (id: string, stages: VideoStage[]) => void;
}) {
  const [list, setList] = useState<VideoStage[]>(initialStages);
  const [saved, setSaved] = useState(false);

  const add = () => setList(s => [...s, { id: generateId(), title: '', description: '' }]);
  const remove = (id: string) => setList(s => s.filter(x => x.id !== id));
  const update = (id: string, f: 'title' | 'description', v: string) =>
    setList(s => s.map(x => x.id === id ? { ...x, [f]: v } : x));
  const move = (idx: number, dir: -1 | 1) => {
    const ni = idx + dir;
    if (ni < 0 || ni >= list.length) return;
    const next = [...list]; [next[idx], next[ni]] = [next[ni], next[idx]]; setList(next);
  };
  const save = () => { onSave(videoId, list); setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="p-4 bg-blue-50 border-t border-blue-100 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-blue-700">스테이지 편집</span>
        {saved && <span className="text-xs text-green-600 font-semibold">✓ 저장됨</span>}
      </div>
      <div className="space-y-2">
        {list.map((s, si) => (
          <div key={s.id} className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1">
                <button onClick={() => move(si, -1)} disabled={si === 0}
                  className="w-5 h-5 text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs">▲</button>
                <button onClick={() => move(si, 1)} disabled={si === list.length - 1}
                  className="w-5 h-5 text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs">▼</button>
                <span className="text-xs font-bold text-blue-600 ml-1">Step {si + 1}</span>
              </div>
              <button onClick={() => remove(s.id)} className="text-xs text-red-400 hover:text-red-600">✕ 삭제</button>
            </div>
            <input value={s.title} onChange={e => update(s.id, 'title', e.target.value)}
              placeholder="스테이지 제목" style={{ ...iStyle, marginBottom: 6 }} />
            <textarea rows={3} value={s.description}
              onChange={e => update(s.id, 'description', e.target.value)}
              placeholder="세부 설명, 프롬프트, 단계별 가이드"
              style={{ ...iStyle, resize: 'vertical' }} />
          </div>
        ))}
        {list.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-3">스테이지가 없습니다.</p>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={add}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 border border-blue-200 rounded hover:bg-blue-100">
          + 스테이지 추가
        </button>
        <button onClick={save}
          className="text-xs font-semibold px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700">
          저장
        </button>
      </div>
    </div>
  );
}

export default function AdminVideos() {
  const [videos, setVideosState] = useState<Video[]>([]);
  const [levels, setLevelsState] = useState<VideoLevel[]>([]);
  const [msg, setMsg] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editStagesId, setEditStagesId] = useState<string | null>(null);
  const [editLevelId, setEditLevelId] = useState<string | null>(null);

  // Add form
  const [title, setTitle] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selLevel, setSelLevel] = useState('');
  const [desc, setDesc] = useState('');
  const [newStages, setNewStages] = useState<VideoStage[]>([]);

  // Level form
  const [newLvName, setNewLvName] = useState('');
  const [newLvDesc, setNewLvDesc] = useState('');

  const load = () => {
    const vids = getVideos();
    const lvls = getVideoLevels();
    setVideosState(vids);
    setLevelsState(lvls);
    if (!selLevel && lvls.length > 0) setSelLevel(lvls[0].name);
  };

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  }, []);

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 3000); };
  const persist = (next: Video[]) => { setVideos(next); setVideosState(next); window.dispatchEvent(new Event('storage')); };
  const persistLvl = (next: VideoLevel[]) => { setVideoLevels(next); setLevelsState(next); window.dispatchEvent(new Event('storage')); };

  // ── Video ops ──
  const handleAdd = () => {
    if (!title || !youtubeUrl) return;
    const v: Video = {
      id: generateId(), title, level: selLevel || levels[0]?.name || '기초',
      description: desc, youtubeUrl, viewCount: 0,
      stages: newStages.filter(s => s.title.trim()),
      order: videos.length,
    };
    persist([...videos, v]);
    flash('영상이 추가되었습니다.');
    setTitle(''); setYoutubeUrl(''); setDesc('');
    setSelLevel(levels[0]?.name || '기초'); setNewStages([]);
  };

  const handleDelete = (id: string) => {
    persist(videos.filter(v => v.id !== id));
    setConfirmDeleteId(null);
  };

  const moveVideo = (idx: number, dir: -1 | 1) => {
    const ni = idx + dir;
    if (ni < 0 || ni >= videos.length) return;
    const next = [...videos]; [next[idx], next[ni]] = [next[ni], next[idx]];
    persist(next);
  };

  const handleLevelChange = (id: string, lv: string) =>
    persist(videos.map(v => v.id === id ? { ...v, level: lv } : v));

  const updateVideoStages = (id: string, stages: VideoStage[]) =>
    persist(videos.map(v => v.id === id ? { ...v, stages } : v));

  // ── Level ops ──
  const handleAddLevel = () => {
    if (!newLvName.trim()) return;
    const lv: VideoLevel = { id: generateId(), name: newLvName.trim(), description: newLvDesc.trim() };
    persistLvl([...levels, lv]);
    setNewLvName(''); setNewLvDesc('');
    flash('레벨이 추가되었습니다.');
  };

  const handleDeleteLevel = (lvId: string) => {
    if (levels.length <= 1) { flash('레벨은 최소 1개 이상 있어야 합니다.'); return; }
    const del = levels.find(l => l.id === lvId);
    const fallback = levels.find(l => l.id !== lvId)?.name || '기초';
    const updVids = videos.map(v => v.level === del?.name ? { ...v, level: fallback } : v);
    persist(updVids);
    persistLvl(levels.filter(l => l.id !== lvId));
    flash(`레벨 삭제됨. 해당 레벨 영상은 "${fallback}"으로 이동됩니다.`);
  };

  const handleSaveLevel = (lvId: string, name: string, desc: string) => {
    const oldName = levels.find(l => l.id === lvId)?.name;
    persistLvl(levels.map(l => l.id === lvId ? { ...l, name, description: desc } : l));
    if (oldName && oldName !== name) persist(videos.map(v => v.level === oldName ? { ...v, level: name } : v));
    setEditLevelId(null);
    flash('레벨이 수정되었습니다.');
  };

  // ── Stage helpers for add form ──
  const addNewStage = () => setNewStages(s => [...s, { id: generateId(), title: '', description: '' }]);
  const removeNewStage = (id: string) => setNewStages(s => s.filter(x => x.id !== id));
  const updateNewStage = (id: string, f: 'title' | 'description', v: string) =>
    setNewStages(s => s.map(x => x.id === id ? { ...x, [f]: v } : x));

  return (
    <div className="space-y-6">
      {msg && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded p-3 text-sm">{msg}</div>
      )}

      {/* 삭제 확인 팝업 */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-2xl shadow-2xl p-7 w-80 text-center">
            <div className="text-2xl mb-3">🗑️</div>
            <p className="text-sm font-bold text-gray-800 mb-1">영상을 삭제하시겠습니까?</p>
            <p className="text-xs text-gray-500 mb-6">삭제 후에는 복구할 수 없습니다.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(confirmDeleteId)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors">
                삭제
              </button>
              <button onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 레벨 관리 ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 mb-4">레벨 관리</h3>
        <div className="space-y-2 mb-4">
          {levels.map(lv => (
            <div key={lv.id} className="flex items-center gap-2 p-2.5 border border-gray-100 rounded-lg bg-gray-50">
              {editLevelId === lv.id ? (
                <LevelEditRow level={lv} onSave={handleSaveLevel} onCancel={() => setEditLevelId(null)} />
              ) : (
                <>
                  <span className="text-xs font-bold text-gray-800 w-16 shrink-0">{lv.name}</span>
                  <span className="text-xs text-gray-400 flex-1">{lv.description}</span>
                  <button onClick={() => setEditLevelId(lv.id)}
                    className="text-xs text-blue-600 hover:text-blue-800 px-2 py-0.5 rounded border border-blue-100 hover:bg-blue-50">수정</button>
                  <button onClick={() => handleDeleteLevel(lv.id)}
                    className="text-xs text-red-500 hover:text-red-700 px-2 py-0.5 rounded border border-red-100 hover:bg-red-50">삭제</button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">레벨명</label>
            <input value={newLvName} onChange={e => setNewLvName(e.target.value)} placeholder="예: 심화" style={iStyle} />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">설명</label>
            <input value={newLvDesc} onChange={e => setNewLvDesc(e.target.value)} placeholder="레벨 설명" style={iStyle} />
          </div>
          <button onClick={handleAddLevel}
            className="px-4 py-2 rounded text-xs font-semibold bg-gray-900 text-white hover:bg-black transition-colors whitespace-nowrap">
            + 추가
          </button>
        </div>
      </div>

      {/* ── 영상 추가 ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 mb-4">영상 추가</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">영상 제목 *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={iStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">유튜브 URL *</label>
            <input value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..." style={iStyle} />
            {youtubeUrl && (
              <p className="text-xs text-gray-400 mt-1">
                videoId: <span className="font-mono text-blue-500">{extractVideoId(youtubeUrl) || '인식 불가'}</span>
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">레벨</label>
            <select value={selLevel} onChange={e => setSelLevel(e.target.value)}
              style={{ ...iStyle, width: 'auto' }}>
              {levels.map(lv => <option key={lv.id} value={lv.name}>{lv.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">설명</label>
            <textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)}
              style={{ ...iStyle, resize: 'vertical' }} />
          </div>
          {/* 스테이지 편집 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700">단계별 스테이지</label>
              <button onClick={addNewStage} className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ 스테이지 추가</button>
            </div>
            <div className="space-y-2">
              {newStages.map((s, si) => (
                <div key={s.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-blue-600">Step {si + 1}</span>
                    <button onClick={() => removeNewStage(s.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                  </div>
                  <input value={s.title} onChange={e => updateNewStage(s.id, 'title', e.target.value)}
                    placeholder="스테이지 제목" style={{ ...iStyle, marginBottom: 4 }} />
                  <textarea rows={2} value={s.description}
                    onChange={e => updateNewStage(s.id, 'description', e.target.value)}
                    placeholder="세부 설명 및 프롬프트" style={{ ...iStyle, resize: 'vertical' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <button onClick={handleAdd} disabled={!title || !youtubeUrl}
          className={`mt-4 px-5 py-2 rounded text-sm font-semibold transition-colors ${
            title && youtubeUrl ? 'bg-black text-white hover:bg-gray-800' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}>
          영상 추가
        </button>
      </div>

      {/* ── 영상 목록 ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 mb-4">등록된 영상 목록 ({videos.length}개)</h3>
        <div className="space-y-2">
          {videos.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">등록된 영상이 없습니다.</p>
          )}
          {videos.map((v, idx) => (
            <div key={v.id} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors">
                {/* 순서 변경 */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => moveVideo(idx, -1)} disabled={idx === 0}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs leading-none">▲</button>
                  <button onClick={() => moveVideo(idx, 1)} disabled={idx === videos.length - 1}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs leading-none">▼</button>
                </div>
                <span className="text-xs text-gray-400 font-mono w-5 shrink-0 text-center">{idx + 1}</span>
                {/* 레벨 */}
                <select value={v.level} onChange={e => handleLevelChange(v.id, e.target.value)}
                  className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none shrink-0">
                  {levels.map(lv => <option key={lv.id} value={lv.name}>{lv.name}</option>)}
                </select>
                {/* 제목 */}
                <span className="text-xs font-semibold text-gray-700 flex-1 truncate">{v.title}</span>
                <span className="text-xs text-gray-400 shrink-0">{v.viewCount}회</span>
                {/* 스테이지 토글 */}
                <button onClick={() => setEditStagesId(editStagesId === v.id ? null : v.id)}
                  className="text-xs text-blue-600 hover:text-blue-800 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-50 whitespace-nowrap shrink-0">
                  스테이지{v.stages?.length ? ` (${v.stages.length})` : ''}
                </button>
                {/* 삭제 */}
                <button onClick={() => setConfirmDeleteId(v.id)}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-0.5 rounded border border-red-200 hover:bg-red-50 shrink-0">
                  삭제
                </button>
              </div>
              {/* 스테이지 편집 패널 */}
              {editStagesId === v.id && (
                <StageEditor videoId={v.id} initialStages={v.stages || []} onSave={updateVideoStages} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
