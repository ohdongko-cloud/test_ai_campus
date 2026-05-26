"use client";

import { useState, useEffect } from 'react';
import { Video, VideoLevel, VideoStage } from '../lib/types';
import { extractVideoId, generateId } from '../lib/utils';
import { adminFetch, AdminAuthError } from '../lib/admin-client';

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

function VideoEditRow({ video, onSave, onCancel }: {
  video: Video;
  onSave: (id: string, title: string, youtubeUrl: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(video.title);
  const [url, setUrl] = useState(video.youtubeUrl);
  const trimmedTitle = title.trim();
  const vid = extractVideoId(url);
  const canSave = !!trimmedTitle && !!vid;
  return (
    <div className="flex items-center gap-2 flex-1 flex-wrap">
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="영상 제목"
        className="border border-gray-300 rounded px-2 py-1 text-xs flex-1 min-w-[140px] focus:outline-none"
      />
      <div className="flex-1 min-w-[180px]">
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="border border-gray-300 rounded px-2 py-1 text-xs w-full focus:outline-none"
        />
        {url && (
          <p className="text-[10px] text-gray-400 mt-0.5">
            videoId: <span className={`font-mono ${vid ? 'text-blue-500' : 'text-red-500'}`}>{vid || '인식 불가'}</span>
          </p>
        )}
      </div>
      <button
        onClick={() => canSave && onSave(video.id, trimmedTitle, url)}
        disabled={!canSave}
        className={`text-xs px-2 py-1 rounded border ${canSave ? 'text-blue-600 hover:text-blue-800 border-blue-200 hover:bg-blue-50' : 'text-gray-300 border-gray-100 cursor-not-allowed'}`}
      >저장</button>
      <button onClick={onCancel}
        className="text-xs text-gray-500 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">취소</button>
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
  const [editVideoId, setEditVideoId] = useState<string | null>(null);
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

  const load = async () => {
    try {
      const [vRes, lRes] = await Promise.all([
        fetch('/api/videos'),
        fetch('/api/video-levels'),
      ]);
      const vids = vRes.ok ? await vRes.json() : [];
      const lvls = lRes.ok ? await lRes.json() : [];
      setVideosState(vids);
      setLevelsState(lvls);
      if (!selLevel && lvls.length > 0) setSelLevel(lvls[0].name);
    } catch {
      // 네트워크 실패 시 빈 상태
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 3000); };

  // 어드민 호출 공통 에러 처리
  const handleAdminError = async (e: unknown, fallback: string) => {
    if (e instanceof AdminAuthError) {
      flash('관리자 세션이 만료되었습니다. 다시 로그인해주세요.');
    } else {
      flash(fallback);
    }
  };

  // ── Video ops ──
  const handleAdd = async () => {
    if (!title || !youtubeUrl) return;
    try {
      const res = await adminFetch('/api/admin/videos', {
        method: 'POST',
        body: JSON.stringify({
          id: generateId(),
          title,
          level: selLevel || levels[0]?.name || '기초',
          description: desc,
          youtubeUrl,
          stages: newStages.filter(s => s.title.trim()),
          order: videos.length,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      flash('영상이 추가되었습니다.');
      setTitle(''); setYoutubeUrl(''); setDesc('');
      setSelLevel(levels[0]?.name || '기초'); setNewStages([]);
      await load();
    } catch (e) {
      handleAdminError(e, '영상 추가에 실패했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await adminFetch(`/api/admin/videos/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      setConfirmDeleteId(null);
      await load();
    } catch (e) {
      handleAdminError(e, '영상 삭제에 실패했습니다.');
    }
  };

  const moveVideo = async (idx: number, dir: -1 | 1) => {
    const ni = idx + dir;
    if (ni < 0 || ni >= videos.length) return;
    const next = [...videos]; [next[idx], next[ni]] = [next[ni], next[idx]];
    // optimistic
    setVideosState(next);
    try {
      const res = await adminFetch('/api/admin/videos/reorder', {
        method: 'POST',
        body: JSON.stringify({ ids: next.map(v => v.id) }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      handleAdminError(e, '순서 변경에 실패했습니다.');
      await load(); // 롤백
    }
  };

  const handleLevelChange = async (id: string, lv: string) => {
    setVideosState(vs => vs.map(v => v.id === id ? { ...v, level: lv } : v));
    try {
      const res = await adminFetch(`/api/admin/videos/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ level: lv }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      handleAdminError(e, '레벨 변경에 실패했습니다.');
      await load();
    }
  };

  const handleSaveVideo = async (id: string, newTitle: string, newUrl: string) => {
    try {
      const res = await adminFetch(`/api/admin/videos/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: newTitle, youtubeUrl: newUrl }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEditVideoId(null);
      flash('영상 정보가 수정되었습니다.');
      await load();
    } catch (e) {
      handleAdminError(e, '저장에 실패했습니다.');
    }
  };

  const updateVideoStages = async (id: string, stages: VideoStage[]) => {
    try {
      const res = await adminFetch(`/api/admin/videos/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ stages }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      handleAdminError(e, '스테이지 저장에 실패했습니다.');
    }
  };

  // ── Level ops ──
  const handleAddLevel = async () => {
    if (!newLvName.trim()) return;
    try {
      const res = await adminFetch('/api/admin/video-levels', {
        method: 'POST',
        body: JSON.stringify({ name: newLvName.trim(), description: newLvDesc.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || '레벨 추가 실패');
      }
      setNewLvName(''); setNewLvDesc('');
      flash('레벨이 추가되었습니다.');
      await load();
    } catch (e) {
      handleAdminError(e, e instanceof Error ? e.message : '레벨 추가에 실패했습니다.');
    }
  };

  const handleDeleteLevel = async (lvId: string) => {
    if (levels.length <= 1) { flash('레벨은 최소 1개 이상 있어야 합니다.'); return; }
    const fallback = levels.find(l => l.id !== lvId)?.name || '기초';
    try {
      const res = await adminFetch(
        `/api/admin/video-levels/${encodeURIComponent(lvId)}?fallback=${encodeURIComponent(fallback)}`,
        { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      flash(`레벨 삭제됨. 해당 영상은 "${fallback}"으로 이동.`);
      await load();
    } catch (e) {
      handleAdminError(e, '레벨 삭제에 실패했습니다.');
    }
  };

  const handleSaveLevel = async (lvId: string, name: string, desc: string) => {
    try {
      const res = await adminFetch(`/api/admin/video-levels/${encodeURIComponent(lvId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, description: desc }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || '레벨 수정 실패');
      }
      setEditLevelId(null);
      flash('레벨이 수정되었습니다.');
      await load();
    } catch (e) {
      handleAdminError(e, e instanceof Error ? e.message : '레벨 수정에 실패했습니다.');
    }
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
          {videos.map((v, idx) => {
            const isEditing = editVideoId === v.id;
            return (
            <div key={v.id} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors">
                {/* 순서 변경 */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => moveVideo(idx, -1)} disabled={idx === 0 || isEditing}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs leading-none">▲</button>
                  <button onClick={() => moveVideo(idx, 1)} disabled={idx === videos.length - 1 || isEditing}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs leading-none">▼</button>
                </div>
                <span className="text-xs text-gray-400 font-mono w-5 shrink-0 text-center">{idx + 1}</span>
                {/* 레벨 */}
                <select value={v.level} onChange={e => handleLevelChange(v.id, e.target.value)}
                  disabled={isEditing}
                  className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none shrink-0 disabled:opacity-50">
                  {levels.map(lv => <option key={lv.id} value={lv.name}>{lv.name}</option>)}
                </select>
                {isEditing ? (
                  <VideoEditRow
                    video={v}
                    onSave={handleSaveVideo}
                    onCancel={() => setEditVideoId(null)}
                  />
                ) : (
                  <>
                    {/* 제목 */}
                    <span className="text-xs font-semibold text-gray-700 flex-1 truncate">{v.title}</span>
                    <span className="text-xs text-gray-400 shrink-0">{v.viewCount}회</span>
                    {/* 편집 */}
                    <button onClick={() => setEditVideoId(v.id)}
                      className="text-xs text-gray-700 hover:text-black px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-100 whitespace-nowrap shrink-0">
                      편집
                    </button>
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
                  </>
                )}
              </div>
              {/* 스테이지 편집 패널 */}
              {editStagesId === v.id && !isEditing && (
                <StageEditor videoId={v.id} initialStages={v.stages || []} onSave={updateVideoStages} />
              )}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
