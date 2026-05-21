import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL 환경변수가 설정되지 않았습니다. .env.local을 확인하세요.');
}

export const sql = neon(process.env.DATABASE_URL);
