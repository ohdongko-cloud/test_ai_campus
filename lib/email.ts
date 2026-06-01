// 이메일 발송 헬퍼 (Nodemailer + Gmail SMTP).
// EMAIL_SMTP_USER / EMAIL_SMTP_PASS 미설정 시 개발 모드 — 콘솔 출력만.

import nodemailer from 'nodemailer';

const SMTP_USER = process.env.EMAIL_SMTP_USER || '';
const SMTP_PASS = process.env.EMAIL_SMTP_PASS || '';
const HAS_SMTP  = !!(SMTP_USER && SMTP_PASS);

// FROM 표시명. 미설정 시 Gmail 주소 그대로 사용.
const FROM = process.env.EMAIL_FROM
  ? `${process.env.EMAIL_FROM} <${SMTP_USER}>`
  : SMTP_USER;

function createTransport() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendVerificationEmail(
  to: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const subject = '[이랜드 AI 캠퍼스] 회원가입 인증 코드';

  const text = `이랜드 AI 캠퍼스 회원가입 인증 코드입니다.

인증 코드: ${code}

이 코드는 10분 동안만 유효합니다.
본인이 요청하지 않았다면 이 메일을 무시해주세요.`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #0F1E33;">
      <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 700;">이랜드 AI 캠퍼스</h2>
      <p style="margin: 0 0 24px; color: #6B7A91; font-size: 14px; line-height: 1.6;">
        아래 인증 코드를 회원가입 페이지에 입력해주세요.
      </p>
      <div style="background: #F5F7FA; border: 1px solid #E5EAF1; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1647A8;">${code}</div>
      </div>
      <p style="margin: 0; font-size: 12px; color: #9BA7BC; line-height: 1.6;">
        이 코드는 <strong>10분 동안</strong>만 유효합니다.<br/>
        본인이 요청하지 않았다면 이 메일을 무시해주세요.
      </p>
    </div>`;

  if (!HAS_SMTP) {
    console.warn('[email] EMAIL_SMTP_USER/PASS 미설정 — 개발 모드. 발송 대상:', to, 'code:', code);
    return { ok: true };
  }

  const transport = createTransport();
  try {
    await transport.sendMail({ from: FROM, to, subject, text, html });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  } finally {
    transport.close();
  }
}
