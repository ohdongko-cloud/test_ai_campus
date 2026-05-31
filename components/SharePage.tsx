"use client";

// AI 서비스 공유 페이지.
// 레이아웃:
//   1) 헤더/안내 + (비로그인 시) 안내 박스 + (성공/오류) 토스트
//   2) "공유된 서비스 목록" — 페이지 진입 시 가장 먼저 노출 (영감 우선)
//   3) 하단 CTA 카드 "+ 서비스 공유하기" — 클릭 시 ShareRegisterModal 오픈
//      (비로그인 시에는 안내 메시지만, 모달 안 띄움)

import { useState, useEffect } from 'react';
import { SharedService } from '../lib/types';
import ShareRegisterModal from './ShareRegisterModal';

export default function SharePage() {
  const [services, setServicesState] = useState<SharedService[]>([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = async () => {
    try {
      // /api/services GET 은 Vercel edge 에서 s-maxage=60 으로 캐시됨.
      // 등록 직후 본인이 옛 목록을 보지 않도록 cache-busting query + no-store 로
      // CDN/브라우저 캐시를 모두 우회한다 (share 페이지는 트래픽 적어 비용 무시 가능).
      const res = await fetch(`/api/services?_=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) setServicesState(await res.json());
    } catch { /* ignore */ }
  };

  // 로그인 상태 확인 — 비로그인 시 CTA 비활성화 안내
  useEffect(() => {
    fetch('/api/users/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { user: null })
      .then(d => setIsLoggedIn(!!d?.user))
      .catch(() => setIsLoggedIn(false));
  }, []);

  useEffect(() => {
    load();
  }, []);

  const flashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleOpenModal = () => {
    if (!isLoggedIn) {
      flashSuccess('서비스 공유는 로그인 후 이용 가능합니다.');
      return;
    }
    setModalOpen(true);
  };

  const handleSubmitted = async (serviceName: string) => {
    flashSuccess(`${serviceName} 서비스가 공유되었습니다.`);
    await load();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-3">AI 서비스 공유하기</h1>

      {/* 공유 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-900 font-medium">
          🎉 내가 만든 AI 서비스를 동료들에게 자랑해보세요!
        </p>
        <p className="text-xs text-blue-700 mt-1">
          회원 누구나 자유롭게 등록할 수 있습니다. 회사 기밀이나 외부 공개 불가 정보는 등록하지 말아주세요.
        </p>
      </div>

      {/* 비로그인 안내 */}
      {isLoggedIn === false && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-900 font-medium">
            🔒 서비스 공유는 <strong>로그인 후</strong> 이용할 수 있습니다.
          </p>
          <p className="text-xs text-amber-700 mt-1">
            상단 메뉴를 통해 로그인하거나 회원가입 후 다시 시도해주세요.
          </p>
        </div>
      )}

      {/* 토스트 메시지 (success / 비로그인 안내) */}
      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 rounded p-3 text-sm">
          {successMsg}
        </div>
      )}

      {/* ── 공유된 서비스 목록 (페이지 메인) ── */}
      <h2 className="text-lg font-semibold text-gray-800 mb-4">공유된 서비스 목록</h2>
      {services.length === 0 ? (
        <p className="text-sm text-gray-500 py-10 text-center border border-dashed border-gray-200 rounded-lg">
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

      {/* ── 하단 CTA: 서비스 공유하기 ── */}
      <div className="mt-10">
        <button
          onClick={handleOpenModal}
          aria-label="AI 서비스 공유하기 모달 열기"
          className={`w-full rounded-xl border-2 border-dashed py-8 px-6 transition-colors flex flex-col items-center gap-3 ${
            isLoggedIn === false
              ? 'border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100'
              : 'border-blue-300 bg-blue-50/40 cursor-pointer hover:bg-blue-50 hover:border-blue-400'
          }`}
        >
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl font-light ${
              isLoggedIn === false ? 'bg-gray-200 text-gray-500' : 'bg-blue-600 text-white'
            }`}
          >
            +
          </div>
          <div className="text-base font-bold text-gray-900">
            {isLoggedIn === false ? '로그인 후 공유 가능' : '서비스 공유하기'}
          </div>
          <div className="text-xs text-gray-500 leading-relaxed text-center max-w-md">
            내가 만든 AI 서비스를 동료들과 공유해보세요. 클릭하면 등록 양식이 열립니다.
          </div>
        </button>
      </div>

      {/* 등록 모달 */}
      <ShareRegisterModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmitted={handleSubmitted}
      />
    </div>
  );
}
