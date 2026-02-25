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

    // 4. Получаем список ПВЗ для города (через наш же прокси или напрямую)
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