require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Database ──
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
    if (!result.rows.length) return res.status(404).json({ error: 'Recipe not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST create recipe ──
app.post('/api/recipes', async (req, res) => {
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
app.put('/api/recipes/:id', async (req, res) => {
  try {
    const { name, category, submitted_by, time_to_prepare, serves, description, ingredients, steps } = req.body;
    const result = await pool.query(
      `UPDATE recipes SET
        name=$1, category=$2, submitted_by=$3, time_to_prepare=$4,
        serves=$5, description=$6, ingredients=$7, steps=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [name, category, submitted_by || '', time_to_prepare || '',
       serves || '', description || '', JSON.stringify(ingredients || []),
       JSON.stringify(steps || []), req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Recipe not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE recipe ──
app.delete('/api/recipes/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM recipes WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Recipe not found' });
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

// ── Serve frontend for all other routes ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Greco Family Cookbook running on port ${PORT}`);
});
