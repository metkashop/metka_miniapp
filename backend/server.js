require('dotenv').config()
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

// CDEK API — ключи читаются из backend/.env
const CDEK_CLIENT_ID = process.env.CDEK_CLIENT_ID
const CDEK_CLIENT_SECRET = process.env.CDEK_CLIENT_SECRET
const CDEK_API = 'https://api.cdek.ru/v2'
const CDEK_FROM_CITY = parseInt(process.env.CDEK_FROM_CITY || '44', 10)

let cdekToken = null
let cdekTokenExpiry = 0

async function getCdekToken() {
  if (cdekToken && Date.now() < cdekTokenExpiry) return cdekToken
  const res = await fetch(`${CDEK_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CDEK_CLIENT_ID,
      client_secret: CDEK_CLIENT_SECRET,
    }),
  })
  const data = await res.json()
  cdekToken = data.access_token
  cdekTokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return cdekToken
}

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

// Добавляем колонки если не существуют
const migrations = [
  'ALTER TABLE orders ADD COLUMN vk_id TEXT',
  'ALTER TABLE orders ADD COLUMN promo_code TEXT',
  'ALTER TABLE orders ADD COLUMN promo_discount INTEGER',
  'ALTER TABLE orders ADD COLUMN promo_fixed INTEGER',
  'ALTER TABLE orders ADD COLUMN delivery_city TEXT',
  'ALTER TABLE orders ADD COLUMN delivery_pvz TEXT',
  'ALTER TABLE orders ADD COLUMN delivery_type TEXT',
  'ALTER TABLE orders ADD COLUMN delivery_cost INTEGER',
  'ALTER TABLE promocodes ADD COLUMN type TEXT DEFAULT "percent"',
  'ALTER TABLE promocodes ADD COLUMN max_uses INTEGER',
  'ALTER TABLE promocodes ADD COLUMN used_count INTEGER DEFAULT 0',
  'ALTER TABLE promocodes ADD COLUMN valid_from TEXT',
  'ALTER TABLE promocodes ADD COLUMN valid_to TEXT',
]
migrations.forEach(sql => {
  try { db.prepare(sql).run() } catch(e) {}
})

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
  ).run(art, name, price, description, images, sizes, color, weight || 0, length || 0, width || 0, height || 0)
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
  const { items, total, name, phone, address, vk_id, promo_code, promo_discount, promo_fixed,
    delivery_city, delivery_pvz, delivery_type, delivery_cost } = req.body
  const result = db.prepare(
    `INSERT INTO orders (items, total, name, phone, address, vk_id, promo_code, promo_discount, promo_fixed, delivery_city, delivery_pvz, delivery_type, delivery_cost)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    JSON.stringify(items),
    total,
    name,
    phone,
    address || 'СДЭК',
    vk_id || null,
    promo_code || null,
    promo_discount || null,
    promo_fixed || null,
    delivery_city || null,
    delivery_pvz || null,
    delivery_type || null,
    delivery_cost || null,
  )

  // Увеличиваем счётчик использований промокода
  if (promo_code) {
    try {
      db.prepare('UPDATE promocodes SET used_count = used_count + 1 WHERE code = ?').run(promo_code)
    } catch(e) {}
  }

  res.json({ id: result.lastInsertRowid })
})

// Обновить статус заказа
app.patch('/api/orders/:id/status', (req, res) => {
  const { status } = req.body
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id)
  res.json({ ok: true })
})

// Удалить персональные данные
app.delete('/api/orders/:id/personal', (req, res) => {
  db.prepare('UPDATE orders SET name = ?, phone = ?, vk_id = NULL WHERE id = ?').run('[удалено]', '[удалено]', req.params.id)
  res.json({ ok: true })
})

// Удалить заказ
app.delete('/api/orders/:id', (req, res) => {
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// Промокоды
app.get('/api/promocodes', (req, res) => {
  res.json(db.prepare('SELECT * FROM promocodes').all())
})

app.get('/api/promocodes/:code', (req, res) => {
  const promo = db.prepare('SELECT * FROM promocodes WHERE code = ? AND active = 1').get(req.params.code)
  if (!promo) return res.json({ valid: false, reason: 'Промокод не найден' })

  const now = new Date()
  if (promo.valid_from && new Date(promo.valid_from) > now)
    return res.json({ valid: false, reason: 'Промокод ещё не активен' })
  if (promo.valid_to && new Date(promo.valid_to) < now)
    return res.json({ valid: false, reason: 'Срок действия промокода истёк' })
  if (promo.max_uses && promo.used_count >= promo.max_uses)
    return res.json({ valid: false, reason: 'Промокод исчерпан' })

  res.json({ valid: true, type: promo.type || 'percent', discount: promo.discount })
})

app.post('/api/promocodes', (req, res) => {
  const { code, discount, type, max_uses, valid_from, valid_to } = req.body
  const result = db.prepare(
    'INSERT INTO promocodes (code, discount, type, max_uses, used_count, valid_from, valid_to, active) VALUES (?, ?, ?, ?, 0, ?, ?, 1)'
  ).run(code, discount, type || 'percent', max_uses || null, valid_from || null, valid_to || null)
  res.json({ id: result.lastInsertRowid })
})

app.delete('/api/promocodes/:id', (req, res) => {
  db.prepare('DELETE FROM promocodes WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// CDEK — поиск городов
app.get('/api/cdek/cities', async (req, res) => {
  try {
    const token = await getCdekToken()
    const q = req.query.q || ''
    const r = await fetch(
      `${CDEK_API}/location/cities?name=${encodeURIComponent(q)}&country_codes=RU&size=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await r.json()
    res.json(Array.isArray(data) ? data : [])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// CDEK — список ПВЗ по коду города
app.get('/api/cdek/pvz', async (req, res) => {
  try {
    const token = await getCdekToken()
    const { city_code } = req.query
    const r = await fetch(
      `${CDEK_API}/deliverypoints?city_code=${city_code}&type=PVZ&size=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await r.json()
    res.json(Array.isArray(data) ? data : [])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// CDEK — расчёт стоимости доставки
app.post('/api/cdek/calculate', async (req, res) => {
  try {
    const token = await getCdekToken()
    const { to_city_code, weight } = req.body
    const r = await fetch(`${CDEK_API}/calculator/tariff`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tariff_code: 136, // Посылка склад-склад
        from_location: { code: CDEK_FROM_CITY },
        to_location: { code: to_city_code },
        packages: [{ weight: weight || 500, length: 20, width: 15, height: 5 }],
      }),
    })
    const data = await r.json()
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.listen(3001, () => {
  console.log('Сервер запущен на http://localhost:3001')
})