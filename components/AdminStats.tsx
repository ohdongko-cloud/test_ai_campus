"use client";

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { getVideos, getReservations, getServices, aggregateClickLog } from '../lib/utils';
import { Video } from '../lib/types';

const PIE_COLORS: Record<string, string> = {
  '기초': '#22C55E', '중급': '#2563EB', '고급': '#F97316', '응용': '#6B7280',
};

export default function AdminStats() {
  const [copied, setCopied] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [reservationCount, setReservationCount] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
  const [clickData, setClickData] = useState<{ name: string; value: number }[]>([]);
  const [totalClicks, setTotalClicks] = useState(0);
  const [levelData, setLevelData] = useState<{ name: string; value: number }[]>([]);

  const load = () => {
    const vids = getVideos();
    const res = getReservations();
    const svc = getServices();
    const clicks = aggregateClickLog();

    setVideos(vids);
    setReservationCount(res.length);
    setServiceCount(svc.length);

    const clickArr = [
      { name: '강의영상', value: clicks['강의영상'] || 0 },
      { name: '게시판', value: clicks['게시판'] || 0 },
      { name: '미팅요청', value: clicks['미팅요청'] || 0 },
      { name: '오픈채팅방', value: clicks['오픈채팅방'] || 0 },
      { name: '서비스공유', value: clicks['서비스공유'] || 0 },
    ];
    setClickData(clickArr);
    setTotalClicks(clickArr.reduce((s, c) => s + c.value, 0));

    const levelMap: Record<string, number> = { '기초': 0, '중급': 0, '고급': 0, '응용': 0 };
    vids.forEach(v => { if (levelMap[v.level] !== undefined) levelMap[v.level]++; });
    setLevelData(Object.entries(levelMap).map(([name, value]) => ({ name, value })));
  };

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const sortedVideos = [...videos].sort((a, b) => b.viewCount - a.viewCount).slice(0, 10);
  const topVideo = sortedVideos[0];

  const handleCopyReport = () => {
    const clicks = aggregateClickLog();
    const today = new Date().toISOString().slice(0, 10);
    const levelMap: Record<string, number> = { '기초': 0, '중급': 0, '고급': 0, '응용': 0 };
    videos.forEach(v => { if (levelMap[v.level] !== undefined) levelMap[v.level]++; });

    const text = `[이랜드리테일 AI 캠퍼스 운영 현황 보고]
기준일: ${today}

■ 전체 미팅 예약 건수: ${reservationCount}건
■ 등록 교육 영상 수: ${videos.length}개 (기초 ${levelMap['기초']} / 중급 ${levelMap['중급']} / 고급 ${levelMap['고급']} / 응용 ${levelMap['응용']})
■ 가장 많이 시청된 영상: ${topVideo ? `${topVideo.title} (${topVideo.viewCount}회)` : '없음'}
■ 공유된 AI 서비스 수: ${serviceCount}개
■ 버튼별 클릭 현황:
  - 강의 영상 시청하기: ${clicks['강의영상'] || 0}회
  - 게시판 작성: ${clicks['게시판'] || 0}회
  - 미팅 요청하기: ${clicks['미팅요청'] || 0}회
  - 오픈채팅방 입장: ${clicks['오픈채팅방'] || 0}회
  - 내 서비스 공유하기: ${clicks['서비스공유'] || 0}회`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const SUMMARY_CARDS = [
    { label: '전체 미팅 예약', value: reservationCount, unit: '건' },
    { label: '등록 영상 수', value: videos.length, unit: '개' },
    { label: '공유 서비스 수', value: serviceCount, unit: '개' },
    { label: '총 버튼 클릭수', value: totalClicks, unit: '회' },
  ];

  return (
    <div className="space-y-8">
      {copied && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded p-3 text-sm">
          보고서가 복사되었습니다.
        </div>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-4">
        {SUMMARY_CARDS.map(c => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <p className="text-sm text-gray-500 mb-2">{c.label}</p>
            <p className="text-3xl font-bold text-gray-900">
              {c.value}<span className="text-base font-normal text-gray-500 ml-1">{c.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* 차트 row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 버튼별 클릭수 막대 차트 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-800 mb-4">버튼별 클릭수</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={clickData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#2563EB" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 레벨별 영상 수 파이 차트 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-800 mb-4">레벨별 영상 수</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={levelData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                {levelData.map((entry, i) => (
                  <Cell key={i} fill={PIE_COLORS[entry.name] || '#ccc'} />
                ))}
              </Pie>
              <Legend formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>} />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 영상별 조회수 순위 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-4">영상별 조회수 순위</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                {['순위', '영상 제목', '레벨', '조회수'].map(col => (
                  <th key={col} className="border border-gray-200 px-4 py-2 text-left text-xs text-gray-600 font-semibold">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedVideos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                    등록된 영상이 없습니다.
                  </td>
                </tr>
              ) : (
                sortedVideos.map((v, i) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="border border-gray-200 px-4 py-2 text-sm text-gray-900 font-medium">{i + 1}</td>
                    <td className="border border-gray-200 px-4 py-2 text-sm text-gray-800">{v.title}</td>
                    <td className="border border-gray-200 px-4 py-2 text-xs text-gray-600">{v.level}</td>
                    <td className="border border-gray-200 px-4 py-2 text-sm text-gray-900">{v.viewCount}회</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <button
        onClick={handleCopyReport}
        className="bg-black text-white px-5 py-2 rounded text-sm font-medium hover:bg-gray-800 transition-colors"
      >
        보고서 복사
      </button>
    </div>
  );
}
