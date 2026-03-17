// Run this once after deploying to seed the database
// In Render dashboard: Shell tab → node seed.js

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seed() {
  console.log('Connecting to database...');
  const sql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
  console.log('Running seed.sql...');
  try {
    await pool.query(sql);
    console.log('✓ Database seeded successfully!');
    console.log('✓ Tables created: recipes, intro_pages');

    const recipeCount = await pool.query('SELECT COUNT(*) FROM recipes');
    const introCount = await pool.query('SELECT COUNT(*) FROM intro_pages');
    console.log('✓ Recipes:', recipeCount.rows[0].count);
    console.log('✓ Intro pages:', introCount.rows[0].count);
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('Tables already exist — checking counts...');
      const recipeCount = await pool.query('SELECT COUNT(*) FROM recipes');
      console.log('Current recipes:', recipeCount.rows[0].count);
    } else {
      console.error('Seed error:', err.message);
    }
  }
  await pool.end();
}

seed();
