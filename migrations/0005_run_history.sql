CREATE TABLE IF NOT EXISTS run_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  route_id INTEGER,
  distance_km DOUBLE PRECISION NOT NULL,
  duration_seconds DOUBLE PRECISION NOT NULL,
  pace_min_per_km DOUBLE PRECISION,
  completed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_run_history_user_id ON run_history(user_id);
