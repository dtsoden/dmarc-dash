PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS report (
  id INTEGER PRIMARY KEY,
  org_name TEXT NOT NULL,
  reporter_email TEXT,
  extra_contact_info TEXT,
  report_id TEXT NOT NULL,
  date_begin INTEGER NOT NULL,
  date_end INTEGER NOT NULL,
  error TEXT,
  generator TEXT,
  schema_namespace TEXT,
  source_filename TEXT,
  raw_xml TEXT,
  ingested_at INTEGER NOT NULL,
  UNIQUE (org_name, report_id, date_begin, date_end)
);

CREATE TABLE IF NOT EXISTS policy_published (
  report_id INTEGER PRIMARY KEY REFERENCES report(id) ON DELETE CASCADE,
  domain TEXT, p TEXT, sp TEXT, np TEXT, adkim TEXT, aspf TEXT,
  pct INTEGER, fo TEXT, discovery_method TEXT, testing TEXT
);

CREATE TABLE IF NOT EXISTS record (
  id INTEGER PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES report(id) ON DELETE CASCADE,
  source_ip TEXT, source_ip_norm TEXT, count INTEGER NOT NULL DEFAULT 0,
  disposition TEXT, dkim_aligned TEXT, spf_aligned TEXT,
  header_from TEXT, envelope_from TEXT, envelope_to TEXT
);

CREATE TABLE IF NOT EXISTS auth_result_dkim (
  id INTEGER PRIMARY KEY,
  record_id INTEGER NOT NULL REFERENCES record(id) ON DELETE CASCADE,
  domain TEXT, selector TEXT, result TEXT, human_result TEXT
);

CREATE TABLE IF NOT EXISTS auth_result_spf (
  id INTEGER PRIMARY KEY,
  record_id INTEGER NOT NULL REFERENCES record(id) ON DELETE CASCADE,
  domain TEXT, scope TEXT, result TEXT, human_result TEXT
);

CREATE TABLE IF NOT EXISTS policy_override_reason (
  id INTEGER PRIMARY KEY,
  record_id INTEGER NOT NULL REFERENCES record(id) ON DELETE CASCADE,
  type TEXT, comment TEXT
);

CREATE TABLE IF NOT EXISTS report_extension (
  id INTEGER PRIMARY KEY,
  report_id INTEGER REFERENCES report(id) ON DELETE CASCADE,
  record_id INTEGER REFERENCES record(id) ON DELETE CASCADE,
  namespace TEXT, element_name TEXT, raw_xml TEXT
);

CREATE TABLE IF NOT EXISTS ingest_log (
  id INTEGER PRIMARY KEY,
  filename TEXT, reporter TEXT, status TEXT NOT NULL,
  records_ingested INTEGER DEFAULT 0,
  dropped_fields TEXT, message_id TEXT, error_detail TEXT,
  processed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS setting (
  key TEXT PRIMARY KEY,
  value TEXT,
  type TEXT NOT NULL DEFAULT 'string',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_user (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  is_active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS password_reset (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

-- Mailbox sources: one row per monitored domain (Graph or IMAP). Secrets encrypted.
CREATE TABLE IF NOT EXISTS mailbox_source (
  id INTEGER PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,                  -- graph | imap
  graph_tenant_id TEXT, graph_client_id TEXT, graph_client_secret TEXT, mailbox_upn TEXT,
  imap_host TEXT, imap_port INTEGER DEFAULT 993, imap_username TEXT, imap_password TEXT,
  imap_tls INTEGER DEFAULT 1, imap_folder TEXT DEFAULT 'INBOX',
  is_active INTEGER NOT NULL DEFAULT 1,
  last_poll_at INTEGER, last_poll_status TEXT, last_poll_detail TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_record_report ON record(report_id);
CREATE INDEX IF NOT EXISTS idx_record_srcip ON record(source_ip_norm);
CREATE INDEX IF NOT EXISTS idx_record_headerfrom ON record(header_from);
CREATE INDEX IF NOT EXISTS idx_report_dates ON report(date_begin, date_end);
CREATE INDEX IF NOT EXISTS idx_pp_domain ON policy_published(domain);
CREATE INDEX IF NOT EXISTS idx_user_email ON app_user(email);
CREATE INDEX IF NOT EXISTS idx_reset_token ON password_reset(token_hash);
