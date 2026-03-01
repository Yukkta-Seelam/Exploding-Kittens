# Exploding Kittens

A web app to play the Exploding Kittens card game with friends.

- **Play Locally**: Same device, pass between players (2–10 players).
- **Play Online**: Share a party code; everyone joins from their own device (Supabase).

## Play

[Play the game](https://yukkta-seelam.github.io/Exploding-Kittens/) (after enabling GitHub Pages)

## Setup (hosting)

1. Clone this repository.
2. Enable **GitHub Pages**: **Settings → Pages → Source: GitHub Actions** (or host on Vercel/Render/any static host).
3. Push to trigger deployment.

## Online play (Supabase) – one-time setup

To use **Play Online** with a shared party code (no Google Cloud):

### 1. Create a Supabase project

1. Go to [Supabase](https://supabase.com/) and sign in.
2. Click **New project**, pick an org, name the project (e.g. `exploding-kittens`), set a database password, and create the project.

### 2. Create the `rooms` table and enable Realtime

1. In the Supabase Dashboard, open **SQL Editor**.
2. Click **New query** and paste in the contents of **`supabase-setup.sql`** from this repo (or the SQL below).
3. Run the query.

```sql
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

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to rooms"
  ON public.rooms FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
```

If you get an error that the table is already in the publication, you can ignore it and continue.

### 3. Get your API keys

1. In the Dashboard go to **Project Settings** (gear icon) → **API**.
2. Copy:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys").

### 4. Add config to this repo

1. Open **`supabase-config.js`** in this repo.
2. Replace the placeholders with your values:

```js
window.supabaseUrl = 'https://YOUR_PROJECT_REF.supabase.co';
window.supabaseAnonKey = 'YOUR_ANON_KEY';
```

3. Save, commit, and push. After redeploy, **Play Online** will work.

Without a valid Supabase config, only **Play Locally** is available (you’ll see a message if you try to create or join a party).

## Game Modes

- **Base Game**: 2–5 players  
- **Party Pack**: 2–10 players  

## How to Play

- **Local**: Pass the device between players. On your turn, play any cards (or none), then draw a card.
- **Online**: One person clicks **Play Online** → **Create Party**, enters name and options, and gets a 6-letter code. Others click **Play Online** → **Join Party**, enter the same code and their name. When everyone is in, the host clicks **Start Game**. The game syncs in real time across devices.

Avoid drawing Exploding Kittens—or use a Defuse to survive!
