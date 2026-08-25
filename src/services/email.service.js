const nodemailer = require('nodemailer');

let transporter;

const EMAIL_LOGO_URL = 'https://ik.imagekit.io/jn3xsoxdy/Screenshot%202026-08-24%20133352.png';
const EMAIL_ART_URL = 'https://ik.imagekit.io/jn3xsoxdy/download%20(12).jpg';

function isTrue(value) {
  return String(value || '').toLowerCase() === 'true';
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildTransportConfig() {
  const host = process.env.MAIL_HOST;
  const service = process.env.MAIL_SERVICE;
  const rawUser = process.env.MAIL_USER || process.env.EMAIL_USER;
  const rawPass = process.env.MAIL_PASS || process.env.EMAIL_PASS;
  const user = String(rawUser || '').trim();
  let pass = String(rawPass || '').trim();

  // Gmail app passwords are often copied with spaces (xxxx xxxx xxxx xxxx).
  // Nodemailer expects the compact value.
  const resolvedService = String(service || '').toLowerCase();
  const usingGmailHost = String(host || '').toLowerCase().includes('gmail');
  if (resolvedService === 'gmail' || usingGmailHost) {
    pass = pass.replace(/\s+/g, '');
  }

  if (host) {
    return {
      host,
      port: toNumber(process.env.MAIL_PORT, 587),
      secure: isTrue(process.env.MAIL_SECURE),
      auth: { user, pass },
    };
  }

  return {
    service: service || 'gmail',
    auth: { user, pass },
  };
}

function getTransporter() {
  if (!transporter) {
    const emailUser = process.env.MAIL_USER || process.env.EMAIL_USER;
    const emailFrom = process.env.MAIL_FROM || process.env.EMAIL_FROM || emailUser;
    if (emailUser && emailFrom && emailUser.toLowerCase() !== emailFrom.toLowerCase()) {
      console.warn('[MAIL CONFIG] MAIL_USER and MAIL_FROM do not match. Gmail App Passwords are account-specific. Use the same Gmail account in both values.');
    }

    if (process.env.EMAIL_USER && process.env.MAIL_USER && process.env.EMAIL_USER.toLowerCase() !== process.env.MAIL_USER.toLowerCase()) {
      console.warn('[MAIL CONFIG] EMAIL_USER and MAIL_USER do not match. Gmail requires the same sender account for SMTP auth and sender address.');
    }

    transporter = nodemailer.createTransport(buildTransportConfig());
  }
  return transporter;
}

async function verifyMailTransport() {
  const user = process.env.MAIL_USER || process.env.EMAIL_USER;
  const pass = process.env.MAIL_PASS || process.env.EMAIL_PASS;
  const from = getFromAddress();

  if (!user || !pass || !from) {
    throw new Error('Missing MAIL_USER, MAIL_PASS, or MAIL_FROM in backend .env');
  }

  if (user.trim().toLowerCase() !== from.trim().toLowerCase()) {
    throw new Error('MAIL_USER and MAIL_FROM must be the same Gmail address');
  }

  await getTransporter().verify();
  console.info(`[MAIL READY] SMTP authenticated as ${user.trim()}`);
}

function logMailFailure(context, err, meta = {}) {
  console.error('[MAIL ERROR]', context, {
    message: err?.message,
    code: err?.code,
    response: err?.response,
    name: err?.name,
    ...meta,
  });
}

function logMailAccepted(context, info, meta = {}) {
  console.info('[MAIL ACCEPTED BY SMTP]', context, {
    messageId: info?.messageId,
    accepted: info?.accepted,
    rejected: info?.rejected,
    response: info?.response,
    ...meta,
  });

  if (!info?.accepted?.length) {
    console.error('[MAIL NOT ACCEPTED]', context, {
      rejected: info?.rejected,
      response: info?.response,
      ...meta,
    });
  }
}

function getFromAddress() {
  return process.env.MAIL_FROM || process.env.EMAIL_FROM || process.env.MAIL_USER || process.env.EMAIL_USER;
}

function transactionalHeaders() {
  return {
    'Auto-Submitted': 'auto-generated',
    'X-Auto-Response-Suppress': 'All',
  };
}

function parseEmailList(value) {
  if (!value) return [];
  return String(value)
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function emailShell(bodyHtml) {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;background:#0d0d12;color:#f4f4f6;border-radius:22px;overflow:hidden;border:1px solid rgba(255,90,31,0.25);box-shadow:0 18px 40px rgba(0,0,0,0.35);">
      <div style="background:linear-gradient(135deg,#281814,#121116);padding:28px 28px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align:middle;padding-right:12px;">
              <img src="${EMAIL_LOGO_URL}" alt="Sound Pulse logo" width="40" height="40" style="display:block;width:40px;height:40px;object-fit:contain;border-radius:50%;" />
            </td>
            <td style="vertical-align:middle;font-size:32px;font-weight:700;letter-spacing:-1px;color:#ffffff;">
              Sound Pulse
            </td>
          </tr>
        </table>
      </div>
      <div style="padding:18px 28px 30px;">
        <div style="margin-bottom:22px;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);background:#17171d;">
          <img src="${EMAIL_ART_URL}" alt="Sound Pulse artist artwork" style="display: block; width: 100%; height: auto; border-radius: 12px;" />
        </div>
        ${bodyHtml}
      </div>
      <div style="border-top:1px solid rgba(255,255,255,0.1);padding:24px 28px 20px;background:#111116;color:#9090a8;font-size:12px;line-height:1.7;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="vertical-align:top;padding:0 18px 18px 0;width:25%;">
              <strong style="display:block;color:#ffffff;font-size:13px;margin-bottom:8px;">Company</strong>
              About<br />Sound Pulse
            </td>
            <td style="vertical-align:top;padding:0 18px 18px 0;width:25%;">
              <strong style="display:block;color:#ffffff;font-size:13px;margin-bottom:8px;">Communities</strong>
              For artists<br />Listeners<br />Creators
            </td>
            <td style="vertical-align:top;padding:0 18px 18px 0;width:25%;">
              <strong style="display:block;color:#ffffff;font-size:13px;margin-bottom:8px;">Useful links</strong>
              Support<br />Help center<br />Privacy
            </td>
            <td style="vertical-align:top;padding:0 0 18px;width:25%;">
              <strong style="display:block;color:#ffffff;font-size:13px;margin-bottom:8px;">Contact us</strong>
              <a href="mailto:soundpulse05@gmail.com" style="color:#ff8a62;text-decoration:none;">soundpulse05@gmail.com</a><br />
              <a href="tel:03164414945" style="color:#ff8a62;text-decoration:none;">03164414945</a>
            </td>
          </tr>
        </table>
        <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:16px;color:#666678;">© 2026 Sound Pulse. Music, made simple.</div>
      </div>
    </div>
  `;
}

async function sendMagicLinkEmail(email, username, token) {
  const url = `${process.env.CLIENT_URL}/auth/verify?token=${token}`;
  const from = getFromAddress();
  try {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Invalid recipient email: ${email || '(empty)'}`);
    }
    if (!from) throw new Error('Missing MAIL_FROM/EMAIL_USER in environment');

    const info = await getTransporter().sendMail({
      from: `"Sound Pulse" <${from}>`,
      to: email,
      envelope: { from, to: [email] },
      replyTo: from,
      headers: transactionalHeaders(),
      subject: 'Your sign-in link for Sound Pulse',
      html: emailShell(`
        <h2 style="font-size:20px;margin-bottom:8px;">Hey ${username} 👋</h2>
        <p style="color:#9090a8;line-height:1.6;margin-bottom:28px;">
          Click below to sign in to Sound Pulse. This link works once and expires in 15 minutes.
        </p>
        <a href="${url}" style="display:block;background:#FF5A1F;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;text-align:center;font-size:15px;box-shadow:0 10px 22px rgba(255,90,31,0.25);">
          Continue to Sound Pulse
        </a>
        <p style="color:#55556a;font-size:12px;margin-top:24px;text-align:center;">
          If you didn't request this, you can safely ignore this email — no account changes will be made.
        </p>
      `),
    });
    logMailAccepted('sendMagicLinkEmail', info, { to: email, from });
  } catch (err) {
    logMailFailure('sendMagicLinkEmail', err, {
      to: email,
      from,
      url,
    });
    throw err;
  }
}

async function sendPasswordActionEmail(email, username, token, action = 'verify') {
  const from = getFromAddress();
  const path = action === 'reset' ? '/auth/reset-password' : '/auth/verify';
  const url = `${process.env.CLIENT_URL}${path}?token=${token}`;
  const subject = action === 'reset' ? 'Reset your Sound Pulse password' : 'Verify your Sound Pulse account';
  const title = action === 'reset' ? 'Reset your password' : 'Verify your account';
  try {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Invalid recipient email: ${email || '(empty)'}`);
    if (!from) throw new Error('Missing MAIL_FROM/EMAIL_USER in environment');
    const info = await getTransporter().sendMail({
      from: `"Sound Pulse" <${from}>`,
      to: email,
      envelope: { from, to: [email] },
      replyTo: from,
      headers: transactionalHeaders(),
      subject,
      html: emailShell(`
        <h2 style="font-size:20px;margin-bottom:8px;">${title}</h2>
        <p style="color:#9090a8;line-height:1.6;margin-bottom:28px;">
          ${action === 'reset' ? 'Use the button below to choose a new password. This link expires in 15 minutes.' : 'Use the button below to verify your email and start using Sound Pulse. This link expires in 15 minutes.'}
        </p>
        <a href="${url}" style="display:block;background:#FF5A1F;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;text-align:center;font-size:15px;">${action === 'reset' ? 'Choose a new password' : 'Verify my account'}</a>
      `),
    });
    logMailAccepted('sendPasswordActionEmail', info, { to: email, from, action });
  } catch (err) {
    logMailFailure('sendPasswordActionEmail', err, { to: email, from, action });
    throw err;
  }
}

async function sendArtistApplicationEmail(adminEmails, username, reason, applicantEmail) {
  const from = getFromAddress();
  const recipients = parseEmailList(adminEmails);
  try {
    if (recipients.length === 0) return;

    if (!from) throw new Error('Missing MAIL_FROM/EMAIL_USER in environment');

    const info = await getTransporter().sendMail({
      from: `"Sound Pulse" <${from}>`,
      to: recipients,
      replyTo: from,
      headers: transactionalHeaders(),
      subject: `New Artist Application — ${username}`,
      html: emailShell(`
        <h2 style="color:#c8ff00;">New Artist Application</h2>
        <p><strong>Username:</strong> ${username}</p>
        <p><strong>Email:</strong> ${applicantEmail || 'Not provided'}</p>
        <p><strong>Reason:</strong></p>
        <blockquote style="border-left:3px solid #c8ff00;padding-left:16px;color:#9090a8;">${reason}</blockquote>
        <p style="margin-top:24px;">Sign in to the admin panel to approve or reject.</p>
      `),
    });
    logMailAccepted('sendArtistApplicationEmail', info, { to: recipients, from });
  } catch (err) {
    logMailFailure('sendArtistApplicationEmail', err, { recipients, from: getFromAddress() });
  }
}

async function sendArtistApplicationReceivedEmail(email, username) {
  const from = getFromAddress();
  try {
    if (!email) return;

    if (!from) throw new Error('Missing MAIL_FROM/EMAIL_USER in environment');

    const info = await getTransporter().sendMail({
      from: `"Sound Pulse" <${from}>`,
      to: email,
      replyTo: from,
      headers: transactionalHeaders(),
      subject: 'We received your artist application',
      html: emailShell(`
        <h2 style="font-size:20px;margin-bottom:8px;">Thanks ${username} 🎤</h2>
        <p style="color:#9090a8;line-height:1.6;">
          Your artist application is now in review. Our team usually responds within 24-48 hours.
          We will email you once it is approved or if we need more details.
        </p>
      `),
    });
    logMailAccepted('sendArtistApplicationReceivedEmail', info, { to: email, from });
  } catch (err) {
    logMailFailure('sendArtistApplicationReceivedEmail', err, { to: email, from: getFromAddress() });
  }
}

async function sendArtistApplicationReviewEmail(email, username, action, adminNote = '') {
  const from = getFromAddress();
  try {
    if (!email) return;

    if (!from) throw new Error('Missing MAIL_FROM/EMAIL_USER in environment');

    const approved = action === 'approve';
    const subject = approved
      ? 'Your artist application was approved'
      : 'Update on your artist application';

    const title = approved
      ? `Great news, ${username}!`
      : `Hi ${username}, thanks for applying`;

    const body = approved
      ? `<p style="color:#9090a8;line-height:1.6;">
           Your artist application has been approved. You can now upload tracks,
           create albums, and grow your audience on Sound Pulse.
         </p>`
      : `<p style="color:#9090a8;line-height:1.6;">
           Your latest artist application was not approved this time.
           You can improve your profile/music details and apply again.
         </p>`;

    const noteBlock = adminNote
      ? `<p style="margin-top:18px;"><strong>Admin note:</strong></p>
         <blockquote style="border-left:3px solid #c8ff00;padding-left:16px;color:#9090a8;">${adminNote}</blockquote>`
      : '';

    const info = await getTransporter().sendMail({
      from: `"Sound Pulse" <${from}>`,
      to: email,
      replyTo: from,
      headers: transactionalHeaders(),
      subject,
      html: emailShell(`
        <h2 style="font-size:20px;margin-bottom:8px;">${title}</h2>
        ${body}
        ${noteBlock}
      `),
    });
    logMailAccepted('sendArtistApplicationReviewEmail', info, { to: email, from, action });
  } catch (err) {
    logMailFailure('sendArtistApplicationReviewEmail', err, { to: email, from: getFromAddress(), action });
  }
}

module.exports = {
  verifyMailTransport,
  sendMagicLinkEmail,
  sendPasswordActionEmail,
  sendArtistApplicationEmail,
  sendArtistApplicationReceivedEmail,
  sendArtistApplicationReviewEmail,
};
