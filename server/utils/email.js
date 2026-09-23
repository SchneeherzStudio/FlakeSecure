/**
 * ============================================================================
 * FlakeSecure Server - Centralized Email Utility & Templates v2.0.3
 * ============================================================================
 * 
 * Clean, technical email templates with Logo Gold branding,
 * zero purple gradients, zero emojis, and zero em dashes.
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
    otpSubject: (purpose) => purpose === 'register' ? 'FlakeSecure: Email Verification Code' : 'FlakeSecure: Confirm Account Deletion',
    otpHeading: 'FlakeSecure Verification',
    otpDesc: (purpose) => purpose === 'register' 
      ? 'Use the verification code below to complete your FlakeSecure registration. This code expires in 10 minutes.'
      : 'Use the code below to confirm the permanent deletion of your account. This code expires in 10 minutes.',
    otpIgnore: "If you did not request this code, you can safely ignore this email.",
    
    welcomeSubject: 'Welcome to FlakeSecure',
    welcomeHeading: 'Welcome to FlakeSecure',
    welcomeDesc: (username) => `Hello <strong>${username}</strong>,<br><br>Your FlakeSecure account has been successfully created. Your zero-knowledge biometric vault is now active and ready to protect your credentials across all your devices.`,
    welcomeTip: 'Tip: Install our mobile app and browser extension to experience instant 1-tap biometric logins.',
    
    deletionSubject: 'FlakeSecure: Account Deletion Notice & 30-Day Retention Period',
    deletionHeading: 'Account Deactivation Confirmed',
    deletionDesc: (username, dateStr) => `Hello <strong>${username}</strong>,<br><br>We have received and processed your request to delete your FlakeSecure account.<br><br><strong>Security & Compliance Retention Period:</strong><br>In accordance with security guidelines and compliance regulations, your account has been immediately deactivated and all active login sessions have been terminated. Your data is scheduled for final, permanent deletion on <strong>${dateStr}</strong> (30 days from now).`,
    deletionNote: 'If this deletion request was made in error or without your authorization, please contact our support team immediately.',
    
    footer: '© 2026 FlakeSecure by SchneeherzStudio. Zero-Knowledge Biometric Security.',
    resetSubject: 'FlakeSecure: Password Reset Link',
    resetHeading: 'Reset Your Password',
    resetDesc: (username) => `Hello <strong>${username}</strong>,<br><br>We received a request to reset your FlakeSecure password. This link is valid for <strong>30 minutes</strong>.<br><br><strong>Zero-Knowledge Security Note:</strong><br>Your cloud vault is encrypted client-side with a key derived from your master password. Resetting your account password requires unlocking your local app to re-encrypt and synchronize your cloud vault.`,
    resetButton: 'Reset Password',
    resetIgnore: 'If you did not request a password reset, you can safely ignore this email. Your account remains secure.'
  },
  de: {
    otpSubject: (purpose) => purpose === 'register' ? 'FlakeSecure: Bestätigungscode für Registrierung' : 'FlakeSecure: Bestätigung zur Account-Löschung',
    otpHeading: 'FlakeSecure Verifizierung',
    otpDesc: (purpose) => purpose === 'register'
      ? 'Nutze den folgenden Bestätigungscode, um deine Registrierung bei FlakeSecure abzuschließen. Der Code ist 10 Minuten gültig.'
      : 'Nutze den folgenden Code, um die Löschung deines Kontos zu bestätigen. Der Code ist 10 Minuten gültig.',
    otpIgnore: 'Falls du diesen Code nicht angefordert hast, kannst du diese E-Mail ignorieren.',
    
    welcomeSubject: 'Willkommen bei FlakeSecure',
    welcomeHeading: 'Willkommen bei FlakeSecure',
    welcomeDesc: (username) => `Hallo <strong>${username}</strong>,<br><br>dein FlakeSecure Account wurde erfolgreich erstellt. Dein Zero-Knowledge-Tresor ist ab sofort aktiv und schützt deine Zugangsdaten sicher auf deinen Geräten.`,
    welcomeTip: 'Tipp: Installiere die Mobile App und die Browser-Erweiterung, um blitzschnelle biometrische Logins zu nutzen.',
    
    deletionSubject: 'FlakeSecure: Bestätigung der Kontolöschung & 30 Tage Aufbewahrungsfrist',
    deletionHeading: 'Konto-Deaktivierung bestätigt',
    deletionDesc: (username, dateStr) => `Hallo <strong>${username}</strong>,<br><br>wir haben deine Anfrage zur Löschung deines FlakeSecure Accounts erhalten und bestätigt.<br><br><strong>30-tägige Sicherheits- und Compliance-Aufbewahrungsfrist:</strong><br>Gemäß gesetzlichen Sicherheitsvorschriften wurde dein Account sofort deaktiviert und alle aktiven Sitzungen wurden beendet. Deine Daten werden für 30 Tage im Soft-Delete-Status gesichert und am <strong>${dateStr}</strong> endgültig und unwiderruflich von unseren Servern gelöscht.`,
    deletionNote: 'Falls du diese Löschung nicht selbst veranlasst hast, kontaktiere bitte umgehend unseren Support.',
    
    footer: '© 2026 FlakeSecure von SchneeherzStudio. Zero-Knowledge Biometrische Sicherheit.',
    resetSubject: 'FlakeSecure: Passwort zurücksetzen',
    resetHeading: 'Passwort zurücksetzen',
    resetDesc: (username) => `Hallo <strong>${username}</strong>,<br><br>wir haben eine Anfrage zum Zurücksetzen deines FlakeSecure Passworts erhalten. Dieser Link ist <strong>30 Minuten</strong> gültig.<br><br><strong>Zero-Knowledge Sicherheitshinweis:</strong><br>Dein Cloud-Tresor ist Ende-zu-Ende mit deinem bisherigen Master-Passwort verschlüsselt. Nach dem Zurücksetzen musst du deine Mobile App öffnen, um deinen Tresor mit dem neuen Passwort neu zu verschlüsseln und zu synchronisieren.`,
    resetButton: 'Passwort jetzt zurücksetzen',
    resetIgnore: 'Falls du diese Anfrage nicht gestellt hast, ignoriere bitte diese E-Mail. Dein Konto bleibt geschützt.'
  },
  fr: {
    otpSubject: (purpose) => purpose === 'register' ? 'FlakeSecure: Code de vérification d\'e-mail' : 'FlakeSecure: Confirmer la suppression du compte',
    otpHeading: 'Vérification FlakeSecure',
    otpDesc: (purpose) => purpose === 'register'
      ? 'Utilisez le code de vérification ci-dessous pour finaliser votre inscription. Ce code expire dans 10 minutes.'
      : 'Utilisez le code ci-dessous pour confirmer la suppression de votre compte. Ce code expire dans 10 minutes.',
    otpIgnore: 'Si vous n\'avez pas demandé ce code, vous pouvez ignorer cet e-mail en toute sécurité.',
    
    welcomeSubject: 'Bienvenue sur FlakeSecure',
    welcomeHeading: 'Bienvenue sur FlakeSecure',
    welcomeDesc: (username) => `Bonjour <strong>${username}</strong>,<br><br>Votre compte FlakeSecure a été créé avec succès. Votre coffre-fort biométrique Zero-Knowledge est désormais actif.`,
    welcomeTip: 'Conseil: Installez notre application mobile et l\'extension navigateur pour des connexions biométriques instantanées.',
    
    deletionSubject: 'FlakeSecure: Avis de suppression et période de rétention de 30 jours',
    deletionHeading: 'Désactivation du compte confirmée',
    deletionDesc: (username, dateStr) => `Bonjour <strong>${username}</strong>,<br><br>Nous avons bien reçu votre demande de suppression de compte FlakeSecure.<br><br><strong>Période de rétention de sécurité (30 jours):</strong><br>Conformément aux normes de conformité et de sécurité, votre compte a été immédiatement désactivé. Vos données seront définitivement effacées le <strong>${dateStr}</strong>.`,
    deletionNote: 'Si vous n\'êtes pas à l\'origine de cette demande, veuillez contacter immédiatement notre support.',
    
    footer: '© 2026 FlakeSecure par SchneeherzStudio. Sécurité Biométrique Zero-Knowledge.',
    resetSubject: 'FlakeSecure: Réinitialisation du mot de passe',
    resetHeading: 'Réinitialiser votre mot de passe',
    resetDesc: (username) => `Bonjour <strong>${username}</strong>,<br><br>Nous avons reçu une demande de réinitialisation de votre mot de passe FlakeSecure. Ce lien est valide pendant <strong>30 minutes</strong>.<br><br><strong>Remarque de sécurité Zero-Knowledge:</strong><br>Votre coffre est chiffré de bout en bout. Après réinitialisation, vous devrez déverrouiller votre application mobile pour ré-encrypter vos données.`,
    resetButton: 'Réinitialiser le mot de passe',
    resetIgnore: 'Si vous n\'avez pas fait cette demande, ignorez cet e-mail en toute sécurité.'
  },
  es: {
    otpSubject: (purpose) => purpose === 'register' ? 'FlakeSecure: Código de verificación de correo' : 'FlakeSecure: Confirmar eliminación de cuenta',
    otpHeading: 'Verificación de FlakeSecure',
    otpDesc: (purpose) => purpose === 'register'
      ? 'Usa el código de verificación a continuación para completar tu registro. Este código caduca en 10 minutos.'
      : 'Usa el código a continuación para confirmar la eliminación de tu cuenta. Este código caduca en 10 minutos.',
    otpIgnore: 'Si no solicitaste este código, puedes ignorar este mensaje.',
    
    welcomeSubject: 'Bienvenido a FlakeSecure',
    welcomeHeading: 'Bienvenido a FlakeSecure',
    welcomeDesc: (username) => `Hola <strong>${username}</strong>,<br><br>Tu cuenta de FlakeSecure ha sido creada con éxito. Tu bóveda biométrica Zero-Knowledge ya está lista para proteger tus contraseñas.`,
    welcomeTip: 'Consejo: Instala nuestra aplicación móvil y la extensión del navegador para iniciar sesión con biometría al instante.',
    
    deletionSubject: 'FlakeSecure: Aviso de eliminación y periodo de retención de 30 días',
    deletionHeading: 'Desactivación de cuenta confirmada',
    deletionDesc: (username, dateStr) => `Hola <strong>${username}</strong>,<br><br>Hemos recibido y procesado tu solicitud para eliminar tu cuenta de FlakeSecure.<br><br><strong>Periodo de retención de seguridad (30 días):</strong><br>Conforme a las normativas de seguridad y cumplimiento, tu cuenta ha sido desactivada de inmediato y todas las sesiones cerradas. Tus datos se eliminarán permanentemente el <strong>${dateStr}</strong>.`,
    deletionNote: 'Si no realizaste esta solicitud, por favor ponte en contacto con nuestro equipo de soporte de inmediato.',
    
    footer: '© 2026 FlakeSecure por SchneeherzStudio. Seguridad Biométrica Zero-Knowledge.',
    resetSubject: 'FlakeSecure: Restablecer contraseña',
    resetHeading: 'Restablecer contraseña',
    resetDesc: (username) => `Hola <strong>${username}</strong>,<br><br>Hemos recibido una solicitud para restablecer tu contraseña de FlakeSecure. Este enlace es válido por <strong>30 minutos</strong>.<br><br><strong>Nota de seguridad Zero-Knowledge:</strong><br>Tu bóveda está cifrada en tu dispositivo. Deberás desbloquear tu app móvil para re-sincronizarla.`,
    resetButton: 'Restablecer contraseña',
    resetIgnore: 'Si no hiciste esta solicitud, ignora este mensaje.'
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0f1422;border:1px solid #1e293b;border-radius:8px;padding:36px 30px;box-shadow:0 12px 32px rgba(0,0,0,0.5);">
          <tr>
            <td align="center" style="padding-bottom:16px;">
              <div style="display:inline-block;width:44px;height:44px;background:rgba(232,176,32,0.12);border:1px solid rgba(232,176,32,0.35);border-radius:6px;line-height:44px;text-align:center;color:#E8B020;font-weight:800;font-size:16px;font-family:monospace;">FS</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.3px;padding-bottom:14px;">
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
    <div style="display:inline-block;background:#E8B020;border:1px solid #C9930A;border-radius:6px;padding:14px 32px;font-size:28px;font-weight:800;color:#07090e;letter-spacing:8px;font-family:monospace;">
      ${escapeHtml(code)}
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
    <div style="background:rgba(232,176,32,0.08);border:1px solid rgba(232,176,32,0.25);border-radius:6px;padding:14px 18px;text-align:left;color:#E8B020;font-size:13px;line-height:1.5;">
      <strong>${t.welcomeTip}</strong>
    </div>
  `;

  const html = buildHtmlTemplate({
    heading: t.welcomeHeading,
    bodyContent: t.welcomeDesc(escapeHtml(username)),
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
    <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:6px;padding:14px 18px;text-align:left;color:#EF4444;font-size:13px;line-height:1.5;">
      <strong>Final Purge Date:</strong> ${dateStr}
    </div>
  `;

  const html = buildHtmlTemplate({
    heading: t.deletionHeading,
    bodyContent: t.deletionDesc(escapeHtml(username), dateStr),
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

async function sendPasswordResetEmail(email, username, resetUrl, lang = 'en') {
  const t = EMAIL_I18N[lang] || EMAIL_I18N.en;
  const from = process.env.SMTP_FROM || 'FlakeSecure <snowy@snowystudio.dev>';

  const highlightBox = `
    <div style="text-align:center;">
      <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#E8B020;color:#07090e;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:700;font-size:14px;border:1px solid #C9930A;">
        ${t.resetButton}
      </a>
      <p style="color:rgba(255,255,255,0.35);font-size:11px;margin-top:12px;word-break:break-all;font-family:monospace;">
        ${escapeHtml(resetUrl)}
      </p>
    </div>
  `;

  const html = buildHtmlTemplate({
    heading: t.resetHeading,
    bodyContent: t.resetDesc(escapeHtml(username)),
    highlightBox,
    note: t.resetIgnore,
    footerText: t.footer,
  });

  const mailOptions = {
    from,
    to: email,
    subject: t.resetSubject,
    html,
  };

  const client = getTransporter();
  return client.sendMail(mailOptions);
}

module.exports = {
  sendOtpEmail,
  sendWelcomeEmail,
  sendDeletionNoticeEmail,
  sendPasswordResetEmail,
};
