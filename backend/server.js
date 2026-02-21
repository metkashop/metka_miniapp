const express = require('express')
const cors = require('cors')
const Database = require('better-sqlite3')
const path = require('path')

const app = express()
const db = new Database('shop.db')

app.use(cors())
app.use(express.json())
app.use(express.static(__dirname))
app.use('/img', express.static(path.join(__dirname, '../img')))

// Таблицы
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    art TEXT,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    description TEXT,
    images TEXT,
    sizes TEXT,
    color TEXT,
    weight INTEGER,
    length INTEGER,
    width INTEGER,
    height INTEGER
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    items TEXT NOT NULL,
    total INTEGER NOT NULL,
    name TEXT,
    phone TEXT,
    address TEXT,
    status TEXT DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS promocodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    discount INTEGER NOT NULL,
    active INTEGER DEFAULT 1
  );
`)

// Товары
app.get('/api/products', (req, res) => {
  res.json(db.prepare('SELECT * FROM products').all())
})

app.get('/api/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)
  if (!product) return res.status(404).json({ error: 'Товар не найден' })
  res.json(product)
})

app.post('/api/products', (req, res) => {
  const { art, name, price, description, images, sizes, color, weight, length, width, height } = req.body
  const result = db.prepare(
    'INSERT INTO products (art, name, price, description, images, sizes, color, weight, length, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(art, name, price, description, images, sizes, color, weight, length, width, height)
  res.json({ id: result.lastInsertRowid })
})

app.delete('/api/products/:id', (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// Заказы
app.get('/api/orders', (req, res) => {
  res.json(db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all())
})

app.post('/api/orders', (req, res) => {
  const { user_id, items, total, name, phone, address } = req.body
  const result = db.prepare(
    'INSERT INTO orders (user_id, items, total, name, phone, address) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(user_id, JSON.stringify(items), total, name, phone, address)
  res.json({ id: result.lastInsertRowid })
})

// Промокоды
app.get('/api/promocodes', (req, res) => {
  res.json(db.prepare('SELECT * FROM promocodes').all())
})

app.post('/api/promocodes', (req, res) => {
  const { code, discount } = req.body
  const result = db.prepare('INSERT INTO promocodes (code, discount) VALUES (?, ?)').run(code, discount)
  res.json({ id: result.lastInsertRowid })
})

app.delete('/api/promocodes/:id', (req, res) => {
  db.prepare('DELETE FROM promocodes WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

app.get('/api/promocodes/:code', (req, res) => {
  const promo = db.prepare('SELECT * FROM promocodes WHERE code = ? AND active = 1').get(req.params.code.toUpperCase())
  if (!promo) return res.status(404).json({ error: 'Промокод не найден' })
  res.json(promo)
})

app.listen(3001, () => {
  console.log('Сервер запущен на http://localhost:3001')
})