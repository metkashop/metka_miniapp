const db = require('better-sqlite3')('shop.db')

try { db.prepare('ALTER TABLE promocodes ADD COLUMN type TEXT DEFAULT "percent"').run() } catch(e) { console.log('type - already exists') }
try { db.prepare('ALTER TABLE promocodes ADD COLUMN max_uses INTEGER').run() } catch(e) { console.log('max_uses - already exists') }
try { db.prepare('ALTER TABLE promocodes ADD COLUMN used_count INTEGER DEFAULT 0').run() } catch(e) { console.log('used_count - already exists') }
try { db.prepare('ALTER TABLE promocodes ADD COLUMN valid_from TEXT').run() } catch(e) { console.log('valid_from - already exists') }
try { db.prepare('ALTER TABLE promocodes ADD COLUMN valid_to TEXT').run() } catch(e) { console.log('valid_to - already exists') }

console.log('Миграция завершена!')