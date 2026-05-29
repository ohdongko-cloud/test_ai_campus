"use client";

import { useState, useEffect } from 'react';
import { adminFetch } from '../lib/admin-client';

export default function AdminChatroom() {
  const [url, setUrl] = useState('');
  const [password, setPassword] = useState('');
  const [rules, setRules] = useState('');
  const [androidUrl, setAndroidUrl] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings?keys=chatroom_url,chatroom_password,chatroom_rules,android_app_url');
        if (res.ok) {
          const s = await res.json();
          if (typeof s.chatroom_url === 'string') setUrl(s.chatroom_url);
          if (typeof s.chatroom_password === 'string') setPassword(s.chatroom_password);
          if (typeof s.chatroom_rules === 'string') setRules(s.chatroom_rules);
          if (typeof s.android_app_url === 'string') setAndroidUrl(s.android_app_url);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const saveKey = async (key: string, value: string, okMsg: string) => {
    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) {
        showSuccess('저장에 실패했습니다.');
        return;
      }
      showSuccess(okMsg);
    } catch {
      showSuccess('저장에 실패했습니다.');
    }
  };

  const handleSaveUrl = () => saveKey('chatroom_url', url, '오픈채팅방 링크가 저장되었습니다.');
  const handleSavePassword = () => saveKey('chatroom_password', password, '입장 비밀번호가 저장되었습니다.');
  const handleSaveRules = () => saveKey('chatroom_rules', rules, '이용 규칙이 저장되었습니다.');
  const handleSaveAndroid = () => saveKey('android_app_url', androidUrl, '안드로이드 앱 URL이 저장되었습니다.');

  const inputStyle: React.CSSProperties = {
    width: '100%', border: '1.5px solid #E2E8F0', borderRadius: 6,
    padding: '8px 12px', fontSize: 13, color: '#0F1E33',
    outline: 'none', boxSizing: 'border-box', background: '#fff',
  };

  return (
    <div className="max-w-lg space-y-4">
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded p-3 text-sm">
          {successMsg}
        </div>
      )}

      {/* URL */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-4">오픈채팅방 URL</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">카카오톡 오픈채팅방 URL</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://open.kakao.com/..."
              style={inputStyle}
            />
          </div>
          <p className="text-xs text-gray-400">
            저장 후 입장하기 버튼에 즉시 반영됩니다.
          </p>
          <button
            onClick={handleSaveUrl}
            className="bg-black text-white px-5 py-2 rounded text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            저장
          </button>
        </div>
      </div>

      {/* 안드로이드 앱 URL */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-4">안드로이드 앱 다운로드 URL</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              AI 캠퍼스 안드로이드 앱 링크
            </label>
            <input
              type="url"
              value={androidUrl}
              onChange={e => setAndroidUrl(e.target.value)}
              placeholder="https://play.google.com/store/apps/details?id=... 또는 APK URL"
              style={inputStyle}
            />
          </div>
          <p className="text-xs text-gray-400">
            우측 하단 플로팅 버튼 &quot;안드로이드 앱&quot; 클릭 시 이 URL로 새 탭이 열립니다.
            비워두면 버튼이 표시되지 않습니다.
          </p>
          <button
            onClick={handleSaveAndroid}
            className="bg-black text-white px-5 py-2 rounded text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            저장
          </button>
        </div>
      </div>

      {/* 입장 비밀번호 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-4">입장 비밀번호</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input
              type="text"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="채팅방 입장 비밀번호 (없으면 비워두세요)"
              style={inputStyle}
            />
          </div>
          <p className="text-xs text-gray-400">
            설정 시 팝업에서 복사 버튼과 함께 표시됩니다.
          </p>
          <button
            onClick={handleSavePassword}
            className="bg-black text-white px-5 py-2 rounded text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            저장
          </button>
        </div>
      </div>

      {/* 이용 규칙 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-4">이용 규칙</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">규칙 내용</label>
            <textarea
              rows={7}
              value={rules}
              onChange={e => setRules(e.target.value)}
              placeholder="이용 규칙을 입력하세요. 줄바꿈이 그대로 표시됩니다."
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
          <p className="text-xs text-gray-400">
            입력 내용이 입장 팝업의 &quot;이용 규칙&quot; 섹션에 그대로 표시됩니다.
          </p>
          <button
            onClick={handleSaveRules}
            className="bg-black text-white px-5 py-2 rounded text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            저장
          </button>
        </div>
      </div>

      {/* 미리보기 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-xs text-gray-500 mb-1">현재 채팅방 URL</p>
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
