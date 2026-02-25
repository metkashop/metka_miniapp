# Бэкенд для METKA SHOP

## Установка

1. Установите зависимости:
```bash
npm install
```

2. Создайте файл `.env` на основе `.env.example`:
```bash
cp .env.example .env
```

3. Заполните `.env` вашими API ключами:
- **CDEK_CLIENT_ID** и **CDEK_CLIENT_SECRET** — получите в личном кабинете СДЭК
- **DADATA_KEY** — получите в личном кабинете DaData
- **SENDER_CITY_CODE** — код города отправителя (по умолчанию 137 = Санкт-Петербург)
- **SENDER_PVZ_CODE** — код ПВЗ отправителя (по умолчанию SPB160)

## Запуск

```bash
node server.js
```

Сервер запустится на `http://localhost:3001`

## API Endpoints

### Товары
- `GET /api/products` — список всех товаров
- `GET /api/products/:id` — товар по ID
- `POST /api/products` — добавить товар
- `DELETE /api/products/:id` — удалить товар

### Заказы
- `GET /api/orders` — все заказы
- `GET /api/orders/user/:vk_id` — заказы пользователя
- `POST /api/orders` — создать заказ
- `PATCH /api/orders/:id/tracking` — добавить трек-номер
- `PATCH /api/orders/:id/status` — изменить статус
- `DELETE /api/orders/:id` — удалить заказ

### Промокоды
- `GET /api/promocodes` — все промокоды
- `GET /api/promocodes/:code` — проверка промокода
- `POST /api/promocodes` — создать промокод
- `DELETE /api/promocodes/:id` — удалить промокод

### СДЭК
- `GET /api/cdek/cities?q=...` — поиск городов
- `GET /api/cdek/pvz?city_code=...` — ПВЗ в городе
- `POST /api/cdek/calculate-pvz` — расчёт тарифов для ПВЗ
- `POST /api/cdek/estimate` — оценка доставки (склад-склад)

### DaData
- `GET /api/dadata/suggest?city=...&q=...` — подсказки улиц

## Интеграция СДЭК

Для работы интеграции необходимо:
1. Зарегистрироваться в [СДЭК API](https://www.cdek.ru/clients/integrator.html)
2. Получить Client ID и Client Secret
3. Указать в `.env` код города отправителя и код ПВЗ

### Тарифы
- **136** — ПВЗ Базовый
- **234** — ПВЗ Экспресс
- **368** — Постамат Базовый
- **378** — Постамат Экспресс

## База данных

Данные хранятся в SQLite (через sql.js) в файле `shop.db.json`. База автоматически создаётся при первом запуске.

### Таблицы:
- `products` — товары
- `orders` — заказы
- `promocodes` — промокоды
