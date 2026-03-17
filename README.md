# Greco Family Cookbook — Web App

A full-stack web app with a PostgreSQL database backend so all users share the same recipes in real time.

## Tech Stack
- **Frontend**: HTML/CSS/JS (single page app)
- **Backend**: Node.js + Express REST API
- **Database**: PostgreSQL
- **Hosting**: Render.com (free tier)

---

## Deploy in ~10 minutes (Free)

### Step 1 — Push code to GitHub

1. Go to [github.com](https://github.com) → sign up or log in
2. Click **New repository** → name it `greco-cookbook` → **Public** → **Create repository**
3. On your computer, open Terminal and run:

```bash
# If you have git installed:
cd path/to/greco-cookbook-app
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/greco-cookbook.git
git push -u origin main
```

Or use GitHub Desktop (easier): download at [desktop.github.com](https://desktop.github.com), drag the folder in, click Publish.

---

### Step 2 — Deploy to Render.com

1. Go to [render.com](https://render.com) → sign up free (use your GitHub account)
2. Click **New → Blueprint**
3. Connect your GitHub repo (`greco-cookbook`)
4. Render reads `render.yaml` automatically and creates:
   - A **web service** (your Node.js app)
   - A **PostgreSQL database** (free)
5. Click **Apply** — deployment takes ~3 minutes
6. You'll get a URL like: `https://greco-family-cookbook.onrender.com`

---

### Step 3 — Seed the database

Once deployed, you need to load the 197 recipes into the database. Two options:

**Option A — Using Render's Shell (easiest):**
1. In Render dashboard → click your web service → **Shell** tab
2. Run: `node seed.js`

**Option B — Using psql locally:**
1. In Render dashboard → your database → **Connection** → copy the **External Database URL**
2. Run: `psql YOUR_DATABASE_URL -f seed.sql`

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Create a .env file
cp .env.example .env
# Edit .env and add your DATABASE_URL

# 3. Set up local database (requires PostgreSQL installed)
psql -U postgres -c "CREATE DATABASE grecocookbook;"
psql -U postgres -d grecocookbook -f seed.sql

# 4. Run the server
npm start
# App runs at http://localhost:3000
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/recipes | Get all recipes (supports ?category= and ?search=) |
| GET | /api/recipes/:id | Get single recipe |
| POST | /api/recipes | Create recipe |
| PUT | /api/recipes/:id | Update recipe |
| DELETE | /api/recipes/:id | Delete recipe |
| GET | /api/intro | Get introduction pages |
| GET | /api/health | Health check |

---

## Data Persistence
All recipes are stored in PostgreSQL. Any user who visits the site sees the same data. Edits, additions, and deletions are reflected for everyone immediately.
