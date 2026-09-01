/**
 * ============================================================================
 * FlakeSecure Server - Centralized Email Utility & Templates v2.0.0
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. TRANSPORTER:
 *    - Creates and caches a nodemailer SMTP transporter using environment variables.
 * 
 * 2. TRANSACTIONAL EMAILS:
 *    - sendOtpEmail(email, code, purpose, lang): Sends 6-digit OTP verification email.
 *    - sendWelcomeEmail(email, username, lang): Sends welcome confirmation email upon registration.
 *    - sendDeletionNoticeEmail(email, username, scheduledPurgeDate, lang): Sends account deletion confirmation & 30-day security retention disclosure.
 * 
 * 3. MULTILINGUAL TEMPLATES (EN, DE, FR, ES):
 *    - Modern, responsive dark-theme HTML email templates (#090b14, #6391ff).
 * ============================================================================
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ionos.de',
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: parseInt(process.env.SMTP_PORT, 10) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

const EMAIL_I18N = {
  en: {
    otpSubject: (purpose) => purpose === 'register' ? '❄️ FlakeSecure - Email Verification Code' : '⚠️ FlakeSecure - Confirm Account Deletion',
    otpHeading: 'FlakeSecure Verification',
    otpDesc: (purpose) => purpose === 'register' 
      ? 'Use the verification code below to complete your FlakeSecure registration. This code expires in 10 minutes.'
      : 'Use the code below to confirm the permanent deletion of your account. This code expires in 10 minutes.',
    otpIgnore: "If you didn't request this code, you can safely ignore this email.",
    
    welcomeSubject: '❄️ Welcome to FlakeSecure!',
    welcomeHeading: 'Welcome to FlakeSecure!',
    welcomeDesc: (username) => `Hello <strong>${username}</strong>,<br><br>Your FlakeSecure account has been successfully created. Your zero-knowledge biometric vault is now active and ready to protect your credentials across all your devices.`,
    welcomeTip: 'Tip: Install our mobile app and browser extension to experience instant 1-tap biometric logins.',
    
    deletionSubject: '⚠️ FlakeSecure - Account Deletion Notice & 30-Day Retention Period',
    deletionHeading: 'Account Deactivation Confirmed',
    deletionDesc: (username, dateStr) => `Hello <strong>${username}</strong>,<br><br>We have received and processed your request to delete your FlakeSecure account.<br><br><strong>Security & Compliance Retention Period:</strong><br>In accordance with security guidelines and compliance regulations, your account has been immediately deactivated and all active login sessions have been terminated. Your data is scheduled for final, permanent deletion on <strong>${dateStr}</strong> (30 days from now).`,
    deletionNote: 'If this deletion request was made in error or without your authorization, please contact our support team immediately.',
    
    footer: '© 2026 FlakeSecure by SchneeherzStudio. Zero-Knowledge Biometric Security.'
  },
  de: {
    otpSubject: (purpose) => purpose === 'register' ? '❄️ FlakeSecure - Bestätigungscode für Registrierung' : '⚠️ FlakeSecure - Bestätigung zur Account-Löschung',
    otpHeading: 'FlakeSecure Verifizierung',
    otpDesc: (purpose) => purpose === 'register'
      ? 'Nutze den folgenden Bestätigungscode, um deine Registrierung bei FlakeSecure abzuschließen. Der Code ist 10 Minuten gültig.'
      : 'Nutze den folgenden Code, um die Löschung deines Kontos zu bestätigen. Der Code ist 10 Minuten gültig.',
    otpIgnore: 'Falls du diesen Code nicht angefordert hast, kannst du diese E-Mail ignorieren.',
    
    welcomeSubject: '❄️ Willkommen bei FlakeSecure!',
    welcomeHeading: 'Willkommen bei FlakeSecure!',
    welcomeDesc: (username) => `Hallo <strong>${username}</strong>,<br><br>dein FlakeSecure Account wurde erfolgreich erstellt. Dein Zero-Knowledge-Tresor ist ab sofort aktiv und schützt deine Zugangsdaten sicher auf deinen Geräten.`,
    welcomeTip: 'Tipp: Installiere die Mobile App und die Browser-Erweiterung, um blitzschnelle biometrische Logins zu nutzen.',
    
    deletionSubject: '⚠️ FlakeSecure - Bestätigung der Kontolöschung & 30 Tage Aufbewahrungsfrist',
    deletionHeading: 'Konto-Deaktivierung bestätigt',
    deletionDesc: (username, dateStr) => `Hallo <strong>${username}</strong>,<br><br>wir haben deine Anfrage zur Löschung deines FlakeSecure Accounts erhalten und bestätigt.<br><br><strong>30-tägige Sicherheits- und Compliance-Aufbewahrungsfrist:</strong><br>Gemäß gesetzlichen Sicherheitsvorschriften wurde dein Account sofort deaktiviert und alle aktiven Sitzungen wurden beendet. Deine Daten werden für 30 Tage im Soft-Delete-Status gesichert und am <strong>${dateStr}</strong> endgültig und unwiderruflich von unseren Servern gelöscht.`,
    deletionNote: 'Falls du diese Löschung nicht selbst veranlasst hast, kontaktiere bitte umgehend unseren Support.',
    
    footer: '© 2026 FlakeSecure von SchneeherzStudio. Zero-Knowledge Biometrische Sicherheit.'
  },
  fr: {
    otpSubject: (purpose) => purpose === 'register' ? '❄️ FlakeSecure - Code de vérification d\'e-mail' : '⚠️ FlakeSecure - Confirmer la suppression du compte',
    otpHeading: 'Vérification FlakeSecure',
    otpDesc: (purpose) => purpose === 'register'
      ? 'Utilisez le code de vérification ci-dessous pour finaliser votre inscription. Ce code expire dans 10 minutes.'
      : 'Utilisez le code ci-dessous pour confirmer la suppression de votre compte. Ce code expire dans 10 minutes.',
    otpIgnore: 'Si vous n\'avez pas demandé ce code, vous pouvez ignorer cet e-mail en toute sécurité.',
    
    welcomeSubject: '❄️ Bienvenue sur FlakeSecure !',
    welcomeHeading: 'Bienvenue sur FlakeSecure !',
    welcomeDesc: (username) => `Bonjour <strong>${username}</strong>,<br><br>Votre compte FlakeSecure a été créé avec succès. Votre coffre-fort biométrique Zero-Knowledge est désormais actif.`,
    welcomeTip: 'Conseil : Installez notre application mobile et l\'extension navigateur pour des connexions biométriques instantanées.',
    
    deletionSubject: '⚠️ FlakeSecure - Avis de suppression et période de rétention de 30 jours',
    deletionHeading: 'Désactivation du compte confirmée',
    deletionDesc: (username, dateStr) => `Bonjour <strong>${username}</strong>,<br><br>Nous avons bien reçu votre demande de suppression de compte FlakeSecure.<br><br><strong>Période de rétention de sécurité (30 jours) :</strong><br>Conformément aux normes de conformité et de sécurité, votre compte a été immédiatement désactivé. Vos données seront définitivement effacées le <strong>${dateStr}</strong>.`,
    deletionNote: 'Si vous n\'êtes pas à l\'origine de cette demande, veuillez contacter immédiatement notre support.',
    
    footer: '© 2026 FlakeSecure par SchneeherzStudio. Sécurité Biométrique Zero-Knowledge.'
  },
  es: {
    otpSubject: (purpose) => purpose === 'register' ? '❄️ FlakeSecure - Código de verificación de correo' : '⚠️ FlakeSecure - Confirmar eliminación de cuenta',
    otpHeading: 'Verificación de FlakeSecure',
    otpDesc: (purpose) => purpose === 'register'
      ? 'Usa el código de verificación a continuación para completar tu registro. Este código caduca en 10 minutos.'
      : 'Usa el código a continuación para confirmar la eliminación de tu cuenta. Este código caduca en 10 minutos.',
    otpIgnore: 'Si no solicitaste este código, puedes ignorar este mensaje.',
    
    welcomeSubject: '❄️ ¡Bienvenido a FlakeSecure!',
    welcomeHeading: '¡Bienvenido a FlakeSecure!',
    welcomeDesc: (username) => `Hola <strong>${username}</strong>,<br><br>Tu cuenta de FlakeSecure ha sido creada con éxito. Tu bóveda biométrica Zero-Knowledge ya está lista para proteger tus contraseñas.`,
    welcomeTip: 'Consejo: Instala nuestra aplicación móvil y la extensión del navegador para iniciar sesión con biometría al instante.',
    
    deletionSubject: '⚠️ FlakeSecure - Aviso de eliminación y periodo de retención de 30 días',
    deletionHeading: 'Desactivación de cuenta confirmada',
    deletionDesc: (username, dateStr) => `Hola <strong>${username}</strong>,<br><br>Hemos recibido y procesado tu solicitud para eliminar tu cuenta de FlakeSecure.<br><br><strong>Periodo de retención de seguridad (30 días):</strong><br>Conforme a las normativas de seguridad y cumplimiento, tu cuenta ha sido desactivada de inmediato y todas las sesiones cerradas. Tus datos se eliminarán permanentemente el <strong>${dateStr}</strong>.`,
    deletionNote: 'Si no realizaste esta solicitud, por favor ponte en contacto con nuestro equipo de soporte de inmediato.',
    
    footer: '© 2026 FlakeSecure por SchneeherzStudio. Seguridad Biométrica Zero-Knowledge.'
  }
};

function buildHtmlTemplate({ heading, bodyContent, highlightBox, note, footerText }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#090b14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#090b14;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:40px 32px;box-shadow:0 12px 32px rgba(0,0,0,0.5);">
          <tr>
            <td align="center" style="padding-bottom:16px;">
              <span style="font-size:44px;">❄️</span>
            </td>
          </tr>
          <tr>
            <td align="center" style="color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.3px;padding-bottom:14px;">
              ${heading}
            </td>
          </tr>
          <tr>
            <td align="left" style="color:rgba(255,255,255,0.75);font-size:14px;line-height:1.6;padding-bottom:24px;">
              ${bodyContent}
            </td>
          </tr>
          ${highlightBox ? `
          <tr>
            <td align="center" style="padding-bottom:24px;">
              ${highlightBox}
            </td>
          </tr>
          ` : ''}
          ${note ? `
          <tr>
            <td align="left" style="color:rgba(255,255,255,0.45);font-size:12px;line-height:1.5;padding-bottom:24px;border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;">
              ${note}
            </td>
          </tr>
          ` : ''}
          <tr>
            <td align="center" style="color:rgba(255,255,255,0.25);font-size:11px;line-height:1.4;padding-top:12px;border-top:1px solid rgba(255,255,255,0.06);">
              ${footerText}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendOtpEmail(email, code, purpose = 'register', lang = 'en') {
  const t = EMAIL_I18N[lang] || EMAIL_I18N.en;
  const from = process.env.SMTP_FROM || 'FlakeSecure <snowy@snowystudio.dev>';
  
  const highlightBox = `
    <div style="display:inline-block;background:linear-gradient(135deg,#6391ff,#7c6aff);border-radius:14px;padding:16px 36px;font-size:32px;font-weight:800;color:#ffffff;letter-spacing:8px;box-shadow:0 4px 16px rgba(99,145,255,0.35);">
      ${code}
    </div>
  `;

  const html = buildHtmlTemplate({
    heading: t.otpHeading,
    bodyContent: t.otpDesc(purpose),
    highlightBox,
    note: t.otpIgnore,
    footerText: t.footer,
  });

  const mailOptions = {
    from,
    to: email,
    subject: t.otpSubject(purpose),
    html,
  };

  const client = getTransporter();
  return client.sendMail(mailOptions);
}

async function sendWelcomeEmail(email, username, lang = 'en') {
  const t = EMAIL_I18N[lang] || EMAIL_I18N.en;
  const from = process.env.SMTP_FROM || 'FlakeSecure <snowy@snowystudio.dev>';

  const highlightBox = `
    <div style="background:rgba(99,145,255,0.08);border:1px solid rgba(99,145,255,0.25);border-radius:12px;padding:16px 20px;text-align:left;color:#8eb0ff;font-size:13px;line-height:1.5;">
      💡 <strong>${t.welcomeTip}</strong>
    </div>
  `;

  const html = buildHtmlTemplate({
    heading: t.welcomeHeading,
    bodyContent: t.welcomeDesc(username),
    highlightBox,
    note: null,
    footerText: t.footer,
  });

  const mailOptions = {
    from,
    to: email,
    subject: t.welcomeSubject,
    html,
  };

  const client = getTransporter();
  return client.sendMail(mailOptions);
}

async function sendDeletionNoticeEmail(email, username, scheduledPurgeDate, lang = 'en') {
  const t = EMAIL_I18N[lang] || EMAIL_I18N.en;
  const from = process.env.SMTP_FROM || 'FlakeSecure <snowy@snowystudio.dev>';

  const dateStr = new Date(scheduledPurgeDate).toLocaleDateString(lang === 'de' ? 'de-DE' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const highlightBox = `
    <div style="background:rgba(255,77,79,0.08);border:1px solid rgba(255,77,79,0.25);border-radius:12px;padding:16px 20px;text-align:left;color:#ff7875;font-size:13px;line-height:1.5;">
      🗓️ <strong>Final Purge Date:</strong> ${dateStr}
    </div>
  `;

  const html = buildHtmlTemplate({
    heading: t.deletionHeading,
    bodyContent: t.deletionDesc(username, dateStr),
    highlightBox,
    note: t.deletionNote,
    footerText: t.footer,
  });

  const mailOptions = {
    from,
    to: email,
    subject: t.deletionSubject,
    html,
  };

  const client = getTransporter();
  return client.sendMail(mailOptions);
}

module.exports = {
  sendOtpEmail,
  sendWelcomeEmail,
  sendDeletionNoticeEmail,
};
