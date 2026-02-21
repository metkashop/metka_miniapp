const db = require('better-sqlite3')('shop.db')
try { db.prepare('ALTER TABLE orders ADD COLUMN promo_code TEXT').run() } catch(e) { console.log('promo_code exists') }
try { db.prepare('ALTER TABLE orders ADD COLUMN promo_discount INTEGER').run() } catch(e) { console.log('promo_discount exists') }
try { db.prepare('ALTER TABLE orders ADD COLUMN promo_fixed INTEGER').run() } catch(e) { console.log('promo_fixed exists') }
console.log('done')