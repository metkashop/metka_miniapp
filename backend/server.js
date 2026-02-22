const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static(__dirname))
app.use('/img', express.static(path.join(__dirname, '../img')))

// Инициализация sql.js
const initSqlJs = require('sql.js')
const DB_PATH = path.join(__dirname, 'shop.db.json')

let db = null

async function initDB() {
  const SQL = await initSqlJs()

  // Загружаем существующую базу или создаём новую
  if (fs.existsSync(DB_PATH)) {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
    db = new SQL.Database(Buffer.from(data, 'base64'))
  } else {
    db = new SQL.Database()
  }

  // Создаём таблицы
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      art TEXT,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      description TEXT,
      images TEXT,
      sizes TEXT,
      color TEXT,
      weight INTEGER DEFAULT 0,
      length INTEGER DEFAULT 0,
      width INTEGER DEFAULT 0,
      height INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      items TEXT NOT NULL,
      total INTEGER NOT NULL,
      name TEXT,
      phone TEXT,
      address TEXT,
      status TEXT DEFAULT 'new',
      vk_id TEXT,
      promo_code TEXT,
      promo_discount INTEGER,
      promo_fixed INTEGER,
      delivery_city TEXT,
      delivery_pvz TEXT,
      delivery_type TEXT,
      delivery_cost INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS promocodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      discount INTEGER NOT NULL,
      type TEXT DEFAULT 'percent',
      max_uses INTEGER,
      used_count INTEGER DEFAULT 0,
      valid_from TEXT,
      valid_to TEXT,
      active INTEGER DEFAULT 1
    );
  `)

  saveDB()
  console.log('База данных инициализирована')
}

function saveDB() {
  const data = Buffer.from(db.export()).toString('base64')
  fs.writeFileSync(DB_PATH, JSON.stringify(data), 'utf8')
}

// Хелперы для работы с БД
function all(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}

function get(sql, params = []) {
  const rows = all(sql, params)
  return rows[0] || null
}

function run(sql, params = []) {
  db.run(sql, params)
  saveDB()
  return { lastInsertRowid: all('SELECT last_insert_rowid() as id')[0].id }
}

// ============ ТОВАРЫ ============
app.get('/api/products', (req, res) => {
  res.json(all('SELECT * FROM products'))
})

app.get('/api/products/:id', (req, res) => {
  const product = get('SELECT * FROM products WHERE id = ?', [req.params.id])
  if (!product) return res.status(404).json({ error: 'Товар не найден' })
  res.json(product)
})

app.post('/api/products', (req, res) => {
  const { art, name, price, description, images, sizes, color, weight, length, width, height } = req.body
  const result = run(
    'INSERT INTO products (art, name, price, description, images, sizes, color, weight, length, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [art, name, price, description, images, sizes, color, weight||0, length||0, width||0, height||0]
  )
  res.json({ id: result.lastInsertRowid })
})

app.delete('/api/products/:id', (req, res) => {
  run('DELETE FROM products WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

// ============ ЗАКАЗЫ ============
app.get('/api/orders', (req, res) => {
  res.json(all('SELECT * FROM orders ORDER BY created_at DESC'))
})

app.get('/api/orders/user/:vk_id', (req, res) => {
  res.json(all('SELECT * FROM orders WHERE vk_id = ? ORDER BY created_at DESC', [req.params.vk_id]))
})

app.post('/api/orders', (req, res) => {
  const { items, total, name, phone, address, vk_id, promo_code, promo_discount, promo_fixed } = req.body
  const result = run(
    `INSERT INTO orders (items, total, name, phone, address, vk_id, promo_code, promo_discount, promo_fixed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [JSON.stringify(items), total, name, phone, address||'СДЭК', vk_id||null, promo_code||null, promo_discount||null, promo_fixed||null]
  )
  if (promo_code) {
    try { run('UPDATE promocodes SET used_count = used_count + 1 WHERE code = ?', [promo_code]) } catch(e) {}
  }
  res.json({ id: result.lastInsertRowid })
})

app.patch('/api/orders/:id/status', (req, res) => {
  run('UPDATE orders SET status = ? WHERE id = ?', [req.body.status, req.params.id])
  res.json({ ok: true })
})

app.delete('/api/orders/:id/personal', (req, res) => {
  run('UPDATE orders SET name = ?, phone = ?, vk_id = NULL WHERE id = ?', ['[удалено]', '[удалено]', req.params.id])
  res.json({ ok: true })
})

app.delete('/api/orders/:id', (req, res) => {
  run('DELETE FROM orders WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

// ============ ПРОМОКОДЫ ============
app.get('/api/promocodes', (req, res) => {
  res.json(all('SELECT * FROM promocodes'))
})

app.get('/api/promocodes/:code', (req, res) => {
  const promo = get('SELECT * FROM promocodes WHERE code = ? AND active = 1', [req.params.code])
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
  const result = run(
    'INSERT INTO promocodes (code, discount, type, max_uses, used_count, valid_from, valid_to, active) VALUES (?, ?, ?, ?, 0, ?, ?, 1)',
    [code, discount, type||'percent', max_uses||null, valid_from||null, valid_to||null]
  )
  res.json({ id: result.lastInsertRowid })
})

app.delete('/api/promocodes/:id', (req, res) => {
  run('DELETE FROM promocodes WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

// Запуск
initDB().then(() => {
  app.listen(3001, () => {
    console.log('Сервер запущен на http://localhost:3001')
  })
}).catch(err => {
  console.error('Ошибка инициализации БД:', err)
})