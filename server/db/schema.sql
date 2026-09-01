-- ============================================================================
-- FlakeSecure Server - PostgreSQL Database Schema v2.0.0
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    language VARCHAR(5) DEFAULT 'en',
    share_mode VARCHAR(20) DEFAULT 'whitelist',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure newly added columns exist if updating from older schema
ALTER TABLE users ADD COLUMN IF NOT EXISTS share_mode VARCHAR(20) DEFAULT 'whitelist';
ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(5) DEFAULT 'en';

CREATE TABLE IF NOT EXISTS allowed_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(owner_id, recipient_id)
);

CREATE TABLE IF NOT EXISTS login_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    city VARCHAR(100),
    region VARCHAR(100),
    country VARCHAR(100),
    isp VARCHAR(200),
    device_info TEXT,
    action VARCHAR(50) NOT NULL,
    domain VARCHAR(255),
    target_username VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS target_username VARCHAR(100);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_allowed_recipients_owner ON allowed_recipients(owner_id);

CREATE TABLE IF NOT EXISTS shared_payloads (
    sid VARCHAR(32) PRIMARY KEY,
    payload TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS received_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    sender_username VARCHAR(100) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    encrypted_data TEXT NOT NULL,
    is_hidden BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_received_creds_recipient ON received_credentials(recipient_id);

CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    type VARCHAR(10) NOT NULL DEFAULT 'popup',
    display VARCHAR(10) NOT NULL DEFAULT 'once',
    active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS maintenance (
    id SERIAL PRIMARY KEY,
    active BOOLEAN DEFAULT false,
    message TEXT,
    started_at TIMESTAMPTZ,
    until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO maintenance (id, active, message) VALUES (1, false, null) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    purpose VARCHAR(20) NOT NULL DEFAULT 'register',
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);

CREATE TABLE IF NOT EXISTS vault (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    encrypted_blob TEXT NOT NULL,
    blob_version INTEGER DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    expo_token VARCHAR(255) NOT NULL,
    device_info TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, expo_token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);

CREATE TABLE IF NOT EXISTS dismissed_announcements (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
    dismissed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, announcement_id)
);
