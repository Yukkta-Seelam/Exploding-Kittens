-- Run this in Supabase Dashboard → SQL Editor (new query)
-- Creates the rooms table and enables Realtime for online play

-- Table for game rooms (party code = room_code)
CREATE TABLE IF NOT EXISTS public.rooms (
  room_code TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  player_ids TEXT[] NOT NULL DEFAULT '{}',
  player_names TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'lobby',
  game_mode TEXT NOT NULL DEFAULT 'base',
  player_count INT NOT NULL DEFAULT 5,
  game_state JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Allow anonymous read/write for the app (anyone with the code can join)
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to rooms"
  ON public.rooms FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable Realtime so all clients get updates when a room changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
