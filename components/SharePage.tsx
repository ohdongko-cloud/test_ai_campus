"use client";

import { useState, useEffect } from 'react';
import { SharedService } from '../lib/types';

export default function SharePage() {
  const [services, setServicesState] = useState<SharedService[]>([]);
  const [serviceName, setServiceName] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [testAccount, setTestAccount] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const load = async () => {
    try {
      const res = await fetch('/api/services');
      if (res.ok) setServicesState(await res.json());
    } catch { /* ignore */ }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async () => {
    if (!serviceName || !description || !url) return;
    // 사용자 측은 인증 없이 등록 가능... 하지만 이 PRD에서 사용자 측은 어드민만 등록.
    // 안내: 사용자 측 공유 페이지에서 직접 등록은 가급적 어드민으로 옮긴다.
    // 단, 현행 UX 유지를 위해 직접 POST를 admin 경로로 보냄(어드민 비번 없으면 401).
    try {
      const res = await fetch('/api/admin/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // sessionStorage 어드민 비번이 있으면 부착, 없으면 401
          ...(typeof window !== 'undefined' && sessionStorage.getItem('_admin_pw')
            ? { 'X-Admin-Password': sessionStorage.getItem('_admin_pw') as string }
            : {}),
        },
        body: JSON.stringify({ serviceName, description, url, testAccount }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          setSuccessMsg('관리자만 서비스를 공유할 수 있습니다.');
        } else {
          setSuccessMsg('등록에 실패했습니다.');
        }
        setTimeout(() => setSuccessMsg(''), 3000);
        return;
      }
      setSuccessMsg(`${serviceName} 서비스가 공유되었습니다.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      setServiceName('');
      setDescription('');
      setUrl('');
      setTestAccount('');
      await load();
    } catch {
      setSuccessMsg('서버 연결에 실패했습니다.');
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-3">AI 서비스 공유하기</h1>

      {/* 준비 중 안내 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-gray-600">서비스 공유 게시판은 준비 중입니다. 곧 오픈됩니다.</p>
      </div>

      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 rounded p-3 text-sm">
          {successMsg}
        </div>
      )}

      {/* 입력 폼 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">서비스 등록</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">서비스 이름 <span className="text-red-500">*</span></label>
            <input type="text" value={serviceName} onChange={e => setServiceName(e.target.value)}
              placeholder="예: 상품 추천 AI"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">간단한 설명 <span className="text-red-500">*</span></label>
            <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="어떤 문제를 해결하는 서비스인지 간단히 설명해주세요."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">서비스 URL <span className="text-red-500">*</span></label>
            <input type="url" value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">테스트 계정 정보 <span className="text-gray-400">(선택)</span></label>
            <input type="text" value={testAccount} onChange={e => setTestAccount(e.target.value)}
              placeholder="ID: test / PW: 1234"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!serviceName || !description || !url}
          className={`mt-5 px-5 py-2 rounded text-sm font-medium transition-colors ${
            serviceName && description && url
              ? 'bg-black text-white hover:bg-gray-800'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          공유하기
        </button>
      </div>

      {/* 공유된 서비스 목록 */}
      <h2 className="text-lg font-semibold text-gray-800 mb-4">공유된 서비스 목록</h2>
      {services.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          아직 공유된 서비스가 없습니다. 첫 번째로 공유해보세요.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map(s => (
            <div key={s.id} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{s.serviceName}</h3>
              <p className="text-sm text-gray-500 mb-3 leading-relaxed">{s.description}</p>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline break-all"
              >
                {s.url}
              </a>
              {s.testAccount && (
                <p className="text-xs text-gray-400 mt-1">테스트 계정: {s.testAccount}</p>
              )}
              <p className="text-xs text-gray-400 mt-2">등록일시: {s.registeredAt}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
