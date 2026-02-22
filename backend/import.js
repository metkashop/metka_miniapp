const initSqlJs = require('sql.js')
const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const DB_PATH = path.join(__dirname, 'shop.db.json')

async function importProducts() {
  const SQL = await initSqlJs()
  
  // Загружаем базу
  let db
  if (fs.existsSync(DB_PATH)) {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
    db = new SQL.Database(Buffer.from(data, 'base64'))
  } else {
    console.log('База не найдена! Сначала запустите server.js')
    return
  }

  // Читаем Excel
  const workbook = XLSX.readFile('../catalog.xlsx')
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet)

  console.log(`Найдено строк в Excel: ${rows.length}`)

  // Очищаем таблицу товаров
  db.run('DELETE FROM products')

  let count = 0
  rows.forEach(row => {
    const art = row['Артикул'] || row['art'] || ''
    const name = row['Название'] || row['name'] || ''
    const price = parseInt(row['Цена'] || row['price'] || 0)
    const description = (row['Описание'] || row['description'] || '').toString().replace(/\n/g, '\\n')
    const images = row['Картинки'] || row['images'] || ''
    const sizes = row['Размеры'] || row['sizes'] || 'XS,S,M,L,XL,XXL,3XL'
    const color = row['Цвет'] || row['color'] || ''

    if (!name || !price) return

    db.run(
      'INSERT INTO products (art, name, price, description, images, sizes, color) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [art, name, price, description, images, sizes, color]
    )
    count++
  })

  // Сохраняем
  const exported = Buffer.from(db.export()).toString('base64')
  fs.writeFileSync(DB_PATH, JSON.stringify(exported), 'utf8')
  
  console.log(`Импортировано товаров: ${count}`)
  console.log('Готово!')
}

importProducts().catch(console.error)