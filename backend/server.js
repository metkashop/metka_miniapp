require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')

const app = express()   // <-- это было пропущено

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

  if (fs.existsSync(DB_PATH)) {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
    db = new SQL.Database(Buffer.from(data, 'base64'))
  } else {
    db = new SQL.Database()
  }

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
      tracking TEXT,
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
  const { items, total, name, phone, address, vk_id, promo_code, promo_discount, promo_fixed,
          delivery_city, delivery_pvz, delivery_type, delivery_cost } = req.body
  const result = run(
    `INSERT INTO orders (items, total, name, phone, address, vk_id, promo_code, promo_discount, promo_fixed,
                         delivery_city, delivery_pvz, delivery_type, delivery_cost)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [JSON.stringify(items), total, name, phone, address||'СДЭК', vk_id||null,
     promo_code||null, promo_discount||null, promo_fixed||null,
     delivery_city||null, delivery_pvz||null, delivery_type||null, delivery_cost||null]
  )
  if (promo_code) {
    try { run('UPDATE promocodes SET used_count = used_count + 1 WHERE code = ?', [promo_code]) } catch(e) {}
  }
  res.json({ id: result.lastInsertRowid })
})

app.patch('/api/orders/:id/tracking', (req, res) => {
  run('UPDATE orders SET tracking = ? WHERE id = ?', [req.body.tracking, req.params.id])
  res.json({ ok: true })
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

// ============ СДЭК ============
let cdekTokenCache = { token: null, expiresAt: 0 }

async function getCdekToken() {
  const CDEK_CLIENT_ID = process.env.CDEK_CLIENT_ID
  const CDEK_CLIENT_SECRET = process.env.CDEK_CLIENT_SECRET
  const CDEK_API_URL = process.env.CDEK_API_URL || 'https://api.cdek.ru/v2'

  if (cdekTokenCache.token && Date.now() < cdekTokenCache.expiresAt) {
    return cdekTokenCache.token
  }

  const tokenRes = await fetch(`${CDEK_API_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${CDEK_CLIENT_ID}&client_secret=${CDEK_CLIENT_SECRET}`
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) throw new Error('CDEK token failed')

  cdekTokenCache = {
    token: tokenData.access_token,
    expiresAt: Date.now() + (tokenData.expires_in - 60) * 1000
  }
  return cdekTokenCache.token
}

async function cdekRequest(method, url, data = null) {
  const CDEK_API_URL = process.env.CDEK_API_URL || 'https://api.cdek.ru/v2'
  const token = await getCdekToken()

  const options = {
    method,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  }
  if (data) options.body = JSON.stringify(data)

  const res = await fetch(`${CDEK_API_URL}${url}`, options)
  return res.json()
}

// Прокси для виджета СДЭК с логированием
app.all('/api/cdek-proxy', async (req, res) => {
  console.log('🔥 CDEK proxy request:', req.method, req.url, req.query);
  try {
    const token = await getCdekToken();

    const action = req.query.action;
    let apiMethod = '';
    let apiData = { ...req.query };

    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      Object.assign(apiData, req.body);
    }

    if (action === 'offices') {
      apiMethod = 'deliverypoints';
      delete apiData.action;
    } else if (action === 'calculate') {
      apiMethod = 'calculator/tarifflist';
      delete apiData.action;
    } else {
      console.log('❌ Unknown action:', action);
      return res.status(400).json({ message: 'Unknown action' });
    }

    const url = new URL(`https://api.cdek.ru/v2/${apiMethod}`);
    Object.keys(apiData).forEach(key => url.searchParams.append(key, apiData[key]));

    console.log('➡️  Forwarding to CDEK API:', url.toString());

    const fetchOptions = {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(apiData);
    }

    const response = await fetch(url.toString(), fetchOptions);
    let responseData;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
      console.log('⚠️  Non-JSON response from CDEK:', responseData.substring(0, 200));
    }

    console.log('✅ Response status:', response.status);
    res.status(response.status).json(responseData);
  } catch (error) {
    console.error('💥 CDEK widget proxy error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Поиск городов СДЭК
app.get('/api/cdek/cities', async (req, res) => {
  try {
    const { q } = req.query
    if (!q || q.length < 2) return res.json([])
    const data = await cdekRequest('GET', `/location/cities?city=${encodeURIComponent(q)}&country_codes=RU&size=7`)
    res.json(Array.isArray(data) ? data.map(c => ({ code: c.code, name: c.city, region: c.region })) : [])
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

// Список ПВЗ в городе
app.get('/api/cdek/pvz', async (req, res) => {
  try {
    const { city_code } = req.query
    const data = await cdekRequest('GET', `/deliverypoints?city_code=${city_code}&type=PVZ&size=100`)
    const pvzList = Array.isArray(data) ? data : []
    res.json(pvzList.map(p => ({
      code: p.code,
      name: p.name,
      address: p.location?.address,
      lat: p.location?.latitude,
      lon: p.location?.longitude,
      work_time: p.work_time,
      type: p.type
    })))
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

// Расчёт тарифов СДЭК
app.post('/api/cdek/calculate', async (req, res) => {
  try {
    const { city_code, pvz_code, items } = req.body
    const SENDER_CITY_CODE = parseInt(process.env.SENDER_CITY_CODE) || 137
    const SENDER_PVZ_CODE = process.env.SENDER_PVZ_CODE || 'SPB160'
    const TARIFFS = [136, 234, 368, 378]

    let totalWeight = 0
    let totalCost = 0
    items.forEach(item => {
      totalWeight += (item.weight || 300)
      totalCost += item.price
    })

    const results = []
    for (const tariff of TARIFFS) {
      try {
        const data = await cdekRequest('POST', '/calculator/tariff', {
          type: 1,
          from_location: { code: SENDER_CITY_CODE },
          to_location: { code: city_code },
          tariff_code: tariff,
          shipment_point: SENDER_PVZ_CODE,
          delivery_point: pvz_code,
          services: [{ code: 'INSURANCE', parameter: String(totalCost) }],
          packages: [{ weight: totalWeight, length: 30, width: 40, height: 3 }]
        })
        if (data.total_sum) {
          const rounded = Math.ceil(data.total_sum / 10) * 10
          results.push({
            tariff_code: tariff,
            cost: rounded + 30,
            days: data.period_min || 3
          })
        }
      } catch(e) {}
    }
    res.json(results)
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

// Оценка стоимости доставки склад-склад (для показа в корзине)
app.post('/api/cdek/estimate', async (req, res) => {
  try {
    const { city_code, items } = req.body
    if (!city_code) return res.status(400).json({ error: 'city_code required' })
    const SENDER_CITY_CODE = parseInt(process.env.SENDER_CITY_CODE) || 137
    const TARIFFS = [136, 234, 368, 378]

    let totalWeight = 0
    let totalCost = 0
    items.forEach(item => {
      totalWeight += (item.weight || 300)
      totalCost += item.price
    })

    let minCost = null
    let minDays = null
    for (const tariff of TARIFFS) {
      try {
        const data = await cdekRequest('POST', '/calculator/tariff', {
          type: 1,
          from_location: { code: SENDER_CITY_CODE },
          to_location: { code: city_code },
          tariff_code: tariff,
          services: [{ code: 'INSURANCE', parameter: String(totalCost) }],
          packages: [{ weight: totalWeight, length: 30, width: 40, height: 3 }]
        })
        if (data.total_sum) {
          const cost = Math.ceil(data.total_sum / 10) * 10 + 30
          if (minCost === null || cost < minCost) {
            minCost = cost
            minDays = data.period_min || 3
          }
        }
      } catch(e) {}
    }
    res.json(minCost !== null ? { cost: minCost, days: minDays } : { error: 'Не удалось рассчитать' })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

// Подсказки DaData (улицы)
app.get('/api/dadata/suggest', async (req, res) => {
  try {
    const { q, city } = req.query
    const DADATA_KEY = process.env.DADATA_KEY
    const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${DADATA_KEY}`
      },
      body: JSON.stringify({
        query: `${city} ${q}`,
        count: 7,
        from_bound: { value: 'street' },
        to_bound: { value: 'street' },
        locations: [{ city }]
      })
    })
    const data = await response.json()
    res.json((data.suggestions || []).map(s => ({ value: s.value, unrestricted: s.unrestricted_value })))
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

// Эндпоинт для передачи клиенту публичных настроек
app.get('/api/config', (req, res) => {
  res.json({
    yandexMapsApiKey: process.env.YANDEX_MAPS_API_KEY || ''
  })
})

// ============ НОВЫЙ ЭНДПОИНТ ДЛЯ ПОЛУЧЕНИЯ ПВЗ ПО АДРЕСУ ============
app.post('/api/get-pvz-by-address', async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'Address required' });

    // 1. Извлекаем название города из адреса (как в боте)
    function extractCityFromAddress(addr) {
      const parts = addr.split(',').map(s => s.trim());
      for (let part of parts) {
        if (/^\d+$/.test(part)) continue; // индекс
        if (/край|область|респ|республика|автономный/i.test(part)) continue; // регион
        if (/ул\.|улица|пр-кт|проспект|пер\.|переулок/i.test(part)) break; // улица
        return part; // город
      }
      return null;
    }

    const cityName = extractCityFromAddress(address);
    if (!cityName) return res.status(400).json({ error: 'City not found in address' });

    // 2. Получаем код города через API СДЭК (используем существующий токен)
    const token = await getCdekToken();
    const citySearchUrl = `https://api.cdek.ru/v2/location/cities?city=${encodeURIComponent(cityName)}&country_codes=RU&size=1`;
    const cityResp = await fetch(citySearchUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    const cities = await cityResp.json();
    if (!cities || cities.length === 0) return res.status(404).json({ error: 'City not found in CDEK' });
    const cityCode = cities[0].code;

    // 3. Получаем координаты улицы через DaData
    let coords = null;
    try {
      const dadataResp = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${process.env.DADATA_KEY}`
        },
        body: JSON.stringify({ query: address })
      });
      const dadataData = await dadataResp.json();
      if (dadataData.suggestions && dadataData.suggestions[0]) {
        const data = dadataData.suggestions[0].data;
        if (data.geo_lat && data.geo_lon) {
          coords = { lat: parseFloat(data.geo_lat), lon: parseFloat(data.geo_lon) };
        }
      }
    } catch (e) {
      console.warn('DaData error:', e.message);
    }

    // 4. Получаем список ПВЗ для города
    const pvzUrl = `https://api.cdek.ru/v2/deliverypoints?city_code=${cityCode}&type=PVZ&size=100`;
    const pvzResp = await fetch(pvzUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    const allPvz = await pvzResp.json();

    // 5. Форматируем и вычисляем расстояния
    const pvzList = allPvz.map(p => ({
      code: p.code,
      address: p.location.address,
      lat: p.location.latitude,
      lon: p.location.longitude,
      work_time: p.work_time,
    }));

    // Функция расстояния (как в боте)
    function distance(lat1, lon1, lat2, lon2) {
      const R = 6371e3; // метров
      const φ1 = lat1 * Math.PI/180;
      const φ2 = lat2 * Math.PI/180;
      const Δφ = (lat2-lat1) * Math.PI/180;
      const Δλ = (lon2-lon1) * Math.PI/180;
      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c / 1000; // км
    }

    const withDistance = pvzList.map(p => {
      if (!coords) return { ...p, distance: 999 };
      const d = distance(coords.lat, coords.lon, p.lat, p.lon);
      return { ...p, distance: d };
    });

    withDistance.sort((a,b) => a.distance - b.distance);
    res.json(withDistance.slice(0, 20)); // топ-20

  } catch (error) {
    console.error('❌ /api/get-pvz-by-address error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Запуск
initDB().then(() => {
  app.listen(3001, () => {
    console.log('Сервер запущен на http://localhost:3001')
  })
}).catch(err => {
  console.error('Ошибка инициализации БД:', err)
})