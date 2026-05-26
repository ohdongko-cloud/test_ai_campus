"use client";

import { useState } from 'react';
import { adminFetch, AdminAuthError } from '../lib/admin-client';

const KEYS = {
  VIDEOS: 'axtf_videos',
  VIDEO_LEVELS: 'axtf_video_levels',
  RESERVATIONS: 'axtf_reservations',
  SERVICES: 'axtf_services',
  CHATROOM_URL: 'axtf_chatroom_url',
  CHATROOM_PASSWORD: 'axtf_chatroom_password',
  CHATROOM_RULES: 'axtf_chatroom_rules',
  GUIDE_GROUPS: 'axtf_guide_groups',
  NOA_URL: 'axtf_noa_url',
  BLOCKED_SLOTS: 'axtf_blocked_slots',
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch { return fallback; }
}

function readString(key: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const v = localStorage.getItem(key);
  return v ?? undefined;
}

interface VideoLS { id: string; title: string; level: string; description?: string; youtubeUrl: string; stages?: { id: string; title: string; description: string }[]; order?: number; viewCount?: number }
interface LevelLS { id: string; name: string; description?: string }
interface ServiceLS { id?: string; serviceName: string; description?: string; url: string; testAccount?: string }
interface GuideItemLS { id: string; name: string; description?: string; cost?: string; url?: string; recommended?: boolean }
interface GuideGroupLS { id: string; name: string; description?: string; items: GuideItemLS[] }
interface ReservationLS { id?: string; name: string; role: string; taskSummary: string; inquiry?: string; email: string; phone?: string; date: string; startTime: string; endTime: string; status?: string }
interface BlockedSlotLS { id?: string; date?: string; dayOfWeek?: number; startTime: string; endTime?: string; reason?: string; recurring: boolean }

interface Props { onClose: () => void }

export default function AdminImport({ onClose }: Props) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  // 미리보기 카운트
  const videos = readJson<VideoLS[]>(KEYS.VIDEOS, []);
  const levels = readJson<LevelLS[]>(KEYS.VIDEO_LEVELS, []);
  const services = readJson<ServiceLS[]>(KEYS.SERVICES, []);
  const guideGroups = readJson<GuideGroupLS[]>(KEYS.GUIDE_GROUPS, []);
  const reservations = readJson<ReservationLS[]>(KEYS.RESERVATIONS, []);
  const blockedSlots = readJson<BlockedSlotLS[]>(KEYS.BLOCKED_SLOTS, []);
  const chatroomUrl = readString(KEYS.CHATROOM_URL);
  const chatroomPassword = readString(KEYS.CHATROOM_PASSWORD);
  const chatroomRules = readString(KEYS.CHATROOM_RULES);
  const noaUrl = readString(KEYS.NOA_URL);

  const totalGuideItems = guideGroups.reduce((s, g) => s + (g.items?.length || 0), 0);
  const settingsCount = [chatroomUrl, chatroomPassword, chatroomRules, noaUrl].filter(v => typeof v === 'string').length;
  const totalItems = videos.length + levels.length + services.length + guideGroups.length + totalGuideItems + settingsCount + reservations.length + blockedSlots.length;

  const handleImport = async () => {
    setBusy(true);
    setResult(null);

    const payload = {
      videoLevels: levels,
      videos,
      services,
      guideGroups,
      settings: {
        ...(typeof chatroomUrl === 'string' ? { chatroom_url: chatroomUrl } : {}),
        ...(typeof chatroomPassword === 'string' ? { chatroom_password: chatroomPassword } : {}),
        ...(typeof chatroomRules === 'string' ? { chatroom_rules: chatroomRules } : {}),
        ...(typeof noaUrl === 'string' ? { noa_url: noaUrl } : {}),
      },
      reservations,
      blockedSlots,
    };

    try {
      const res = await adminFetch('/api/admin/import', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        const s = data.summary;
        setResult({
          ok: true,
          text: `완료. 영상 ${s.videos} / 레벨 ${s.videoLevels} / 공유 ${s.services} / 가이드 그룹 ${s.guideGroups} (아이템 ${s.guideItems}) / 설정 ${s.settings} / 예약 ${s.reservations} / 차단 ${s.blockedSlots}\n\n3초 후 새로고침합니다...`,
        });
        setTimeout(() => window.location.reload(), 3000);
      } else {
        setResult({
          ok: false,
          text: `실패: ${data.error || '알 수 없는 에러'}\n완료된 단계: ${(data.completed || []).join(', ') || '없음'}${data.failedAt ? `\n실패 지점: ${data.failedAt}` : ''}`,
        });
      }
    } catch (e) {
      if (e instanceof AdminAuthError) {
        setResult({ ok: false, text: '관리자 인증이 만료되었습니다. 다시 로그인해주세요.' });
      } else {
        setResult({ ok: false, text: '서버에 연결할 수 없습니다.' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(15,30,51,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={busy ? undefined : onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, padding: 24,
        width: '100%', maxWidth: 520, maxHeight: 'calc(100vh - 32px)',
        overflowY: 'auto', boxShadow: '0 16px 40px rgba(15,30,51,0.18)',
      }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700, color: '#0F1E33' }}>
          로컬 데이터 서버로 올리기
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#6B7A91', lineHeight: 1.5 }}>
          현재 이 브라우저의 localStorage에 저장된 데이터를 서버 DB로 업로드합니다.
          동일 ID를 가진 기존 DB 데이터는 <strong>덮어쓰입니다</strong>.
        </p>

        <div style={{
          background: '#F5F7FA', border: '1px solid #E5EAF1', borderRadius: 8,
          padding: 14, marginBottom: 14,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1E33', marginBottom: 8 }}>
            업로드 미리보기 ({totalItems}개 항목)
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 13, color: '#3B4A63', lineHeight: 1.8 }}>
            <li>· 영상: <strong>{videos.length}</strong>개</li>
            <li>· 영상 레벨: <strong>{levels.length}</strong>개</li>
            <li>· 공유 서비스: <strong>{services.length}</strong>개</li>
            <li>· 가이드 그룹: <strong>{guideGroups.length}</strong>개 (아이템 {totalGuideItems}개)</li>
            <li>· 채팅방·NOA 설정: <strong>{settingsCount}</strong>개</li>
            <li>· 예약: <strong>{reservations.length}</strong>개</li>
            <li>· 예약 차단 시간: <strong>{blockedSlots.length}</strong>개</li>
          </ul>
        </div>

        {totalItems === 0 ? (
          <div style={{
            background: '#FCE6EA', border: '1px solid #FBCBD2', borderRadius: 8,
            padding: 12, marginBottom: 14, fontSize: 13, color: '#D8364C',
          }}>
            업로드할 로컬 데이터가 없습니다. 다른 PC에서 시도해주세요.
          </div>
        ) : (
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            background: '#FFF6DB', border: '1px solid #F0E5B0', borderRadius: 8,
            padding: 12, marginBottom: 14, cursor: 'pointer',
          }}>
            <input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)}
              style={{ marginTop: 3, width: 16, height: 16, accentColor: '#9C7100' }} />
            <span style={{ fontSize: 13, color: '#5B4400', lineHeight: 1.5 }}>
              기존 서버 데이터 중 동일 ID는 덮어쓰입니다. 진행을 확인합니다.
            </span>
          </label>
        )}

        {result && (
          <div style={{
            background: result.ok ? '#E6F6EE' : '#FCE6EA',
            border: `1px solid ${result.ok ? '#B2E0C5' : '#FBCBD2'}`,
            borderRadius: 8, padding: 12, marginBottom: 14,
            fontSize: 13, color: result.ok ? '#1E9E6A' : '#D8364C',
            whiteSpace: 'pre-wrap', lineHeight: 1.5,
          }}>
            {result.text}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={busy}
            style={{
              padding: '9px 18px', borderRadius: 6,
              border: '1px solid #D4DBE6', background: '#fff',
              color: '#3B4A63', fontSize: 13, fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}>
            {result?.ok ? '닫기' : '취소'}
          </button>
          {!result?.ok && (
            <button onClick={handleImport}
              disabled={busy || !acknowledged || totalItems === 0}
              style={{
                padding: '9px 22px', borderRadius: 6, border: 'none',
                background: (busy || !acknowledged || totalItems === 0) ? '#D4DBE6' : '#004A99',
                color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: (busy || !acknowledged || totalItems === 0) ? 'not-allowed' : 'pointer',
              }}>
              {busy ? '업로드 중...' : '업로드 시작'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
