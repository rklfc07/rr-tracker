# Rakesh & Raj — Project Tracker
## Full Setup Guide (One-time, ~20 minutes)

---

## STEP 1 — Supabase Setup (Free Database)

1. Go to **supabase.com** → Sign up free (use Google)
2. Click **"New Project"**
   - Name: `rr-tracker`
   - Password: choose anything, save it
   - Region: **South Asia (Singapore)** ← closest to India
   - Click **Create Project** (wait ~1 min)

3. Once ready, go to **SQL Editor** (left sidebar)
4. Click **"New Query"**, paste this SQL and click **Run**:

```sql
-- Projects table
create table projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category text default 'Client',
  client_name text,
  color text default '#7c6af7',
  budget numeric default 0,
  received numeric default 0,
  created_at timestamptz default now()
);

-- Tasks table
create table tasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  assignee text default 'Rakesh',
  status text default 'Todo',
  priority text default 'Medium',
  due text,
  notes text,
  created_at timestamptz default now()
);

-- Notes / Meeting logs table
create table notes (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  author text not null,
  text text not null,
  created_at timestamptz default now()
);

-- Allow public access (no login needed)
alter table projects enable row level security;
alter table tasks enable row level security;
alter table notes enable row level security;

create policy "Public access" on projects for all using (true) with check (true);
create policy "Public access" on tasks for all using (true) with check (true);
create policy "Public access" on notes for all using (true) with check (true);
```

5. Go to **Settings → API** (left sidebar)
   - Copy **Project URL** → you'll need this
   - Copy **anon public key** → you'll need this

---

## STEP 2 — Get the Code

1. Download / clone this project folder
2. Open terminal inside the project folder
3. Run:
```bash
npm install
npm install @supabase/supabase-js
```

---

## STEP 3 — Connect Supabase to the App

1. Create a file called `.env` in the root of the project folder
2. Paste this inside (replace with YOUR values from Step 1):

```
REACT_APP_SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.XXXXXXXXXXXXXXX
```

3. Save the file

---

## STEP 4 — Test Locally

```bash
npm start
```

Opens at http://localhost:3000 — try adding a project and a task. Check Supabase → Table Editor to confirm data is being saved.

---

## STEP 5 — Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
```

Then:
1. Go to **github.com** → New repository → name: `rr-tracker` → Create
2. Copy the commands from GitHub under **"push an existing repo"**
3. Run them in your terminal

---

## STEP 6 — Deploy on Vercel

1. Go to **vercel.com** → Add New Project
2. Import your `rr-tracker` GitHub repo
3. Before clicking Deploy → click **"Environment Variables"**
4. Add both variables:
   - `REACT_APP_SUPABASE_URL` → your URL
   - `REACT_APP_SUPABASE_ANON_KEY` → your key
5. Click **Deploy**
6. In ~2 minutes you get a live URL like `https://rr-tracker.vercel.app`

---

## STEP 7 — Share with Raj

Send Raj the Vercel URL. Both of you open it — data is shared live in real time! ✅

---

## Updating in Future

Whenever you make changes:
```bash
git add .
git commit -m "update"
git push
```
Vercel auto-deploys within 1 minute.

---

## Project Structure

```
src/
  App.js              ← main app, routing, realtime subscription
  App.css             ← all styles
  lib/
    supabase.js       ← database connection
  components/
    Dashboard.js      ← projects overview page
    ProjectDetail.js  ← kanban + notes + finance per project
```
