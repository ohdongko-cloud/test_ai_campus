"use client";

import { useState, useEffect } from 'react';
import { SharedService } from '../lib/types';
import { adminFetch } from '../lib/admin-client';

export default function AdminServices() {
  const [services, setServicesState] = useState<SharedService[]>([]);

  const load = async () => {
    try {
      const res = await fetch('/api/services');
      if (res.ok) setServicesState(await res.json());
    } catch { /* ignore */ }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    setServicesState(ss => ss.filter(s => s.id !== id));
    try {
      const res = await adminFetch(`/api/admin/services/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      await load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-4">
          공유된 서비스 목록 ({services.length}개)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" style={{ minWidth: '700px' }}>
            <thead>
              <tr className="bg-gray-50">
                {['서비스 이름', '설명', 'URL', '테스트 계정', '등록일시', '삭제'].map(col => (
                  <th key={col} className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 font-semibold">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
                    공유된 서비스가 없습니다.
                  </td>
                </tr>
              ) : (
                services.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 align-top">
                    <td className="border border-gray-200 px-3 py-2 font-medium text-gray-900">{s.serviceName}</td>
                    <td className="border border-gray-200 px-3 py-2 text-gray-600 max-w-xs">
                      <span className="line-clamp-2">{s.description}</span>
                    </td>
                    <td className="border border-gray-200 px-3 py-2">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-xs break-all"
                      >
                        {s.url}
                      </a>
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-xs text-gray-500">
                      {s.testAccount || '-'}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {s.registeredAt}
                    </td>
                    <td className="border border-gray-200 px-3 py-2">
                      <button onClick={() => handleDelete(s.id)} className="text-red-500 text-xs hover:text-red-700">
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
