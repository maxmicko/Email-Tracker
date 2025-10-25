CREATE TABLE messages (
  id UUID PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT,
  sent_at TIMESTAMP,
  message_id TEXT,
  metadata JSONB
);
CREATE TABLE opens (
  id UUID PRIMARY KEY,
  message_id UUID REFERENCES messages(id),
  opened_at TIMESTAMP DEFAULT now(),
  ip TEXT,
  ua TEXT,
  referer TEXT
);
CREATE TABLE clicks (
  id UUID PRIMARY KEY,
  message_id UUID REFERENCES messages(id),
  url TEXT,
  clicked_at TIMESTAMP DEFAULT now(),
  ip TEXT,
  ua TEXT
);
CREATE INDEX ON opens(message_id);
CREATE INDEX ON clicks(message_id);