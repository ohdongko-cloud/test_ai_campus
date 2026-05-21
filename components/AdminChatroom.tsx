"use client";

import { useState, useEffect } from 'react';
import { getChatroomUrl, setChatroomUrl } from '../lib/utils';

export default function AdminChatroom() {
  const [url, setUrl] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    setUrl(getChatroomUrl());
  }, []);

  const handleSave = () => {
    setChatroomUrl(url);
    setSuccessMsg('오픈채팅방 링크가 업데이트되었습니다.');
    setTimeout(() => setSuccessMsg(''), 3000);
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <div className="max-w-lg space-y-4">
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded p-3 text-sm">
          {successMsg}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-4">오픈채팅방 URL 관리</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">카카오톡 오픈채팅방 URL</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://open.kakao.com/..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
          <p className="text-sm text-gray-400">
            저장 후 메인 페이지의 오픈채팅방 버튼에 즉시 반영됩니다.
          </p>
          <button
            onClick={handleSave}
            className="bg-black text-white px-5 py-2 rounded text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            저장
          </button>
        </div>
      </div>

      {/* 현재 URL 미리보기 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-xs text-gray-500 mb-1">현재 저장된 URL</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline break-all"
        >
          {url || '(설정되지 않음)'}
        </a>
      </div>
    </div>
  );
}
