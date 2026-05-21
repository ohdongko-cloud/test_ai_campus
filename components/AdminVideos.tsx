"use client";

import { useState, useEffect } from 'react';
import { Video } from '../lib/types';
import { getVideos, setVideos, extractVideoId, generateId } from '../lib/utils';

const LEVELS = ['기초', '중급', '고급', '응용'] as const;

export default function AdminVideos() {
  const [videos, setVideosState] = useState<Video[]>([]);
  const [title, setTitle] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [level, setLevel] = useState<Video['level']>('기초');
  const [desc, setDesc] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const load = () => setVideosState(getVideos());

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const detectedId = extractVideoId(youtubeUrl);

  const handleAdd = () => {
    if (!title || !youtubeUrl) return;
    const newVideo: Video = {
      id: generateId(),
      title,
      level,
      description: desc,
      youtubeUrl,
      viewCount: 0,
    };
    const updated = [...videos, newVideo];
    setVideos(updated);
    setVideosState(updated);
    setSuccessMsg(`${title} 영상이 추가되었습니다.`);
    setTimeout(() => setSuccessMsg(''), 3000);
    setTitle('');
    setYoutubeUrl('');
    setDesc('');
    setLevel('기초');
    window.dispatchEvent(new Event('storage'));
  };

  const handleDelete = (id: string) => {
    const updated = videos.filter(v => v.id !== id);
    setVideos(updated);
    setVideosState(updated);
    window.dispatchEvent(new Event('storage'));
  };

  const handleLevelChange = (id: string, newLevel: Video['level']) => {
    const updated = videos.map(v => v.id === id ? { ...v, level: newLevel } : v);
    setVideos(updated);
    setVideosState(updated);
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded p-3 text-sm">
          {successMsg}
        </div>
      )}

      {/* 영상 추가 폼 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-4">영상 추가</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">영상 제목 <span className="text-red-500">*</span></label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">유튜브 URL <span className="text-red-500">*</span></label>
            <input type="text" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
            {youtubeUrl && (
              <p className="text-xs text-gray-500 mt-1">
                감지된 videoId: <span className="font-mono text-blue-600">{detectedId || '(인식 불가)'}</span>
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">레벨 선택</label>
            <select value={level} onChange={e => setLevel(e.target.value as Video['level'])}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500">
              {LEVELS.map(lv => <option key={lv} value={lv}>{lv}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
            <textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500 resize-none" />
          </div>
        </div>
        <button
          onClick={handleAdd}
          disabled={!title || !youtubeUrl}
          className={`mt-4 px-5 py-2 rounded text-sm font-medium transition-colors ${
            title && youtubeUrl
              ? 'bg-black text-white hover:bg-gray-800'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          영상 추가
        </button>
      </div>

      {/* 등록된 영상 목록 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-4">등록된 영상 목록</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" style={{ minWidth: '600px' }}>
            <thead>
              <tr className="bg-gray-50">
                {['레벨', '영상 제목', '설명', '조회수', '삭제'].map(col => (
                  <th key={col} className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 font-semibold">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {videos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                    등록된 영상이 없습니다.
                  </td>
                </tr>
              ) : (
                videos.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2">
                      <select
                        value={v.level}
                        onChange={e => handleLevelChange(v.id, e.target.value as Video['level'])}
                        className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none"
                      >
                        {LEVELS.map(lv => <option key={lv} value={lv}>{lv}</option>)}
                      </select>
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-xs text-gray-800 max-w-xs">
                      <span className="line-clamp-2">{v.title}</span>
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-xs text-gray-500 max-w-xs">
                      <span className="line-clamp-2">{v.description}</span>
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-xs text-gray-700">{v.viewCount}회</td>
                    <td className="border border-gray-200 px-3 py-2">
                      <button onClick={() => handleDelete(v.id)} className="text-red-500 text-xs hover:text-red-700">
                        삭제
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
