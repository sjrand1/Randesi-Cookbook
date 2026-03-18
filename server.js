require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());

// ── Auth middleware for write operations ──
const COOKBOOK_PASSWORD = process.env.COOKBOOK_PASSWORD || 'greco1234';
function requireAuth(req, res, next) {
  const pwd = req.headers['x-cookbook-password'];
  if (!pwd || pwd !== COOKBOOK_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password. Please try again.' });
  }
  next();
}

// ── Auto-setup: create tables and seed on first run ──
// ── Seed data loaded from file (keeps server.js small and fast) ──
const seedData = require('./seed-data.json');
const RECIPES = seedData.recipes;
const INTRO = seedData.intro;


async function setupDatabase() {
  const client = await pool.connect();
  try {
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS recipes (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        submitted_by TEXT DEFAULT '',
        time_to_prepare TEXT DEFAULT '',
        serves TEXT DEFAULT '',
        description TEXT DEFAULT '',
        ingredients JSONB DEFAULT '[]',
        steps JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS intro_pages (
        id SERIAL PRIMARY KEY,
        page_number TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        display_order INTEGER NOT NULL
      )
    `);

    // Seed recipes if empty
    const { rows } = await client.query('SELECT COUNT(*) FROM recipes');
    if (parseInt(rows[0].count) === 0) {
      console.log('Seeding', RECIPES.length, 'recipes...');
      for (const r of RECIPES) {
        await client.query(
          `INSERT INTO recipes (name, category, submitted_by, time_to_prepare, serves, description, ingredients, steps)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [r.name || r.n, r.cat || r.category, r.submittedBy || r.s || '',
           r.time || r.t || '', r.serves || r.sv || '', r.description || r.d || '',
           JSON.stringify(r.ingredients || r.i || []), JSON.stringify(r.steps || r.st || [])]
        );
      }
      console.log('Recipes seeded successfully');
    } else {
      console.log('Recipes already seeded:', rows[0].count);
    }

    // Seed intro if empty
    const introCheck = await client.query('SELECT COUNT(*) FROM intro_pages');
    if (parseInt(introCheck.rows[0].count) === 0) {
      console.log('Seeding intro pages...');
      for (let i = 0; i < INTRO.length; i++) {
        const sec = INTRO[i];
        await client.query(
          'INSERT INTO intro_pages (page_number, title, content, display_order) VALUES ($1,$2,$3,$4)',
          [sec.page, sec.title, sec.content, i + 1]
        );
      }
      console.log('Intro pages seeded successfully');
    }

    console.log('Database ready');
  } catch (err) {
    console.error('Database setup error:', err.message);
  } finally {
    client.release();
  }
}

// ── Auth check endpoint ──
app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  const expected = COOKBOOK_PASSWORD;
  console.log('Auth attempt - received:', JSON.stringify(password), 'expected:', JSON.stringify(expected), 'match:', password === expected);
  if (password === expected) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Incorrect password' });
  }
});

// ── Health check ──
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── GET all recipes ──
app.get('/api/recipes', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = 'SELECT * FROM recipes';
    const params = [];
    const conditions = [];
    if (category && category !== 'all') {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(name ILIKE $${params.length} OR submitted_by ILIKE $${params.length})`);
    }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY category, name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET single recipe ──
app.get('/api/recipes/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM recipes WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST create recipe ──
app.post('/api/recipes', requireAuth, async (req, res) => {
  try {
    const { name, category, submitted_by, time_to_prepare, serves, description, ingredients, steps } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = await pool.query(
      `INSERT INTO recipes (name, category, submitted_by, time_to_prepare, serves, description, ingredients, steps)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, category || 'Miscellaneous', submitted_by || '', time_to_prepare || '',
       serves || '', description || '', JSON.stringify(ingredients || []), JSON.stringify(steps || [])]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT update recipe ──
app.put('/api/recipes/:id', requireAuth, async (req, res) => {
  try {
    const { name, category, submitted_by, time_to_prepare, serves, description, ingredients, steps } = req.body;
    const result = await pool.query(
      `UPDATE recipes SET name=$1, category=$2, submitted_by=$3, time_to_prepare=$4,
       serves=$5, description=$6, ingredients=$7, steps=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [name, category, submitted_by || '', time_to_prepare || '',
       serves || '', description || '', JSON.stringify(ingredients || []),
       JSON.stringify(steps || []), req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE recipe ──
app.delete('/api/recipes/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM recipes WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET intro pages ──
app.get('/api/intro', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM intro_pages ORDER BY display_order');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// ── Serve frontend (must come after all API routes) ──
app.use(express.static(__dirname));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start ──
// Listen immediately so Render detects the port, then seed in background
app.listen(PORT, () => {
  console.log(`Greco Family Cookbook running on port ${PORT}`);
  setupDatabase().catch(err => console.error('Setup error:', err.message));
});
