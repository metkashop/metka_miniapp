import { useState, useEffect, useRef } from 'react'
import { AppRoot, ConfigProvider, AdaptivityProvider, ViewWidth, View, Panel, PanelHeader, PanelHeaderBack, PanelHeaderButton, Card, Text, Title, Button, Spinner, Input, FormItem, Snackbar, Checkbox } from '@vkontakte/vkui'
import { Icon28ShoppingCartOutline, Icon28FavoriteOutline, Icon28Favorite, Icon28DeleteOutline } from '@vkontakte/icons'
import bridge from '@vkontakte/vk-bridge'
import '@vkontakte/vkui/dist/vkui.css'

// ===== ИМПОРТЫ ДЛЯ КАРТЫ =====
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Настройка иконок Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ===== КОМПОНЕНТ КАРТЫ =====
function PvzMap({ pvzList, selectedPvz, onSelectPvz, userCoords }) {
  const center = userCoords
    ? [userCoords.lat, userCoords.lon]
    : pvzList.length > 0
    ? [pvzList[0].lat, pvzList[0].lon]
    : [55.75, 37.62] // Москва по умолчанию

  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ height: '300px', width: '100%', borderRadius: '8px', marginBottom: '16px' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {pvzList.map(pvz => (
        <Marker
          key={pvz.code}
          position={[pvz.lat, pvz.lon]}
          eventHandlers={{ click: () => onSelectPvz(pvz) }}
        >
          <Popup>
            <strong>{pvz.address}</strong><br />
            {pvz.work_time && <>Время работы: {pvz.work_time}<br /></>}
            {pvz.distance && <>Расстояние: {pvz.distance.toFixed(1)} км</>}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

// ===== Lightbox =====
function Lightbox({ src, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', cursor: 'zoom-out', overflowY: 'auto' }}>
      <img src={src} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
    </div>
  )
}

// ===== Детальная карточка товара =====
function ProductDetail({ product, onAdd, favorites, toggleFavorite }) {
  const sizes = product.sizes ? product.sizes.split(',').map(s => s.trim()) : []
  const images = product.images
    ? [...product.images.split(',').map(s => s.trim()), 'img/size/size.jpg']
    : ['img/size/size.jpg']
  const [currentImg, setCurrentImg] = useState(0)
  const [lightbox, setLightbox] = useState(null)
  const [selectedSize, setSelectedSize] = useState(null)
  const touchStartX = useRef(null)
  const isFav = favorites.includes(product.id)

  const prevImg = () => setCurrentImg(i => (i - 1 + images.length) % images.length)
  const nextImg = () => setCurrentImg(i => (i + 1) % images.length)
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 40) diff > 0 ? nextImg() : prevImg()
    touchStartX.current = null
  }

  const description = product.description ? product.description.replace(/\\n/g, '\n') : ''

  return (
    <div style={{ overflowY: 'auto', paddingBottom: '24px', width: '100%' }}>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', maxHeight: '450px', overflow: 'hidden', background: '#000', cursor: 'zoom-in' }} onClick={() => setLightbox(`${API}/${images[currentImg]}`)} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <img src={`${API}/${images[currentImg]}`} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        {images.length > 1 && (
          <>
            <button onClick={e => { e.stopPropagation(); prevImg() }} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '18px' }}>‹</button>
            <button onClick={e => { e.stopPropagation(); nextImg() }} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '18px' }}>›</button>
            <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px' }}>
              {images.map((_, i) => (
                <div key={i} onClick={e => { e.stopPropagation(); setCurrentImg(i) }} style={{ width: '7px', height: '7px', borderRadius: '50%', background: i === currentImg ? '#fff' : 'rgba(255,255,255,0.4)', cursor: 'pointer' }} />
              ))}
            </div>
          </>
        )}
      </div>
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <Title level="2" style={{ flex: 1 }}>{product.name}</Title>
          <button onClick={() => toggleFavorite(product.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            {isFav ? <Icon28Favorite style={{ color: '#e24a4a' }} /> : <Icon28FavoriteOutline style={{ color: '#888' }} />}
          </button>
        </div>
        <Text style={{ color: '#888', marginBottom: '8px', fontSize: '12px' }}>Арт: {product.art}</Text>
        <Title level="1" style={{ marginBottom: '16px' }}>{product.price} ₽</Title>
        {description && (
          <p style={{ color: '#ccc', fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-line', margin: '0 0 16px 0' }}>{description}</p>
        )}
        <p style={{ color: '#fff', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Выберите размер:</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {sizes.map(size => (
            <Button key={size} size="m" mode={selectedSize === size ? 'primary' : 'secondary'} onClick={() => setSelectedSize(size)}>{size}</Button>
          ))}
        </div>
        <Button size="l" stretched disabled={!selectedSize} onClick={() => onAdd({ ...product, size: selectedSize })}>
          {selectedSize ? `В корзину (${selectedSize})` : 'Выберите размер'}
        </Button>
      </div>
    </div>
  )
}

// ===== ОСНОВНОЙ КОМПОНЕНТ APP =====
const API = typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
  ? '' 
  : 'http://192.168.1.2:3001'

function App() {
  const [activePanel, setActivePanel] = useState('splash')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState([])
  const [favorites, setFavorites] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [snackbar, setSnackbar] = useState(null)
  const [vkUser, setVkUser] = useState(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' })
  const [agreePolicy, setAgreePolicy] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoApplied, setPromoApplied] = useState(null)
  const [promoError, setPromoError] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)

  // Оценка доставки в корзине
  const [cartCitySearch, setCartCitySearch] = useState('')
  const [cartCityResults, setCartCityResults] = useState([])
  const [cartCity, setCartCity] = useState(null)
  const [deliveryEstimate, setDeliveryEstimate] = useState(null)
  const [estimateLoading, setEstimateLoading] = useState(false)
  const cartCityTimer = useRef(null)

  // СДЭК и Адреса (для чекаута)
  const [citySearch, setCitySearch] = useState('')
  const [cityResults, setCityResults] = useState([])
  const [selectedCity, setSelectedCity] = useState(null)
  const [streetSearch, setStreetSearch] = useState('')
  const [streetResults, setStreetResults] = useState([])
  const [userCoords, setUserCoords] = useState(null)
  
  const [pvzList, setPvzList] = useState([])
  const [pvzLoading, setPvzLoading] = useState(false)
  const [selectedPvz, setSelectedPvz] = useState(null)
  const [deliveryOptions, setDeliveryOptions] = useState([])
  const [deliveryLoading, setDeliveryLoading] = useState(false)
  const [selectedDelivery, setSelectedDelivery] = useState(null)
  const [checkoutStep, setCheckoutStep] = useState(1) 
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  const citySearchTimer = useRef(null)

  useEffect(() => {
    bridge.send('VKWebAppInit').catch(() => {})
    bridge.send('VKWebAppGetUserInfo').then(user => {
      setVkUser(user)
      setForm(prev => ({ ...prev, firstName: user.first_name || '', lastName: user.last_name || '' }))
    }).catch(() => {})
    fetch(`${API}/api/products`)
      .then(res => res.json())
      .then(data => { setProducts(data); setLoading(false) })
  }, [])

  const addToCart = (product) => {
    setCart(prev => [...prev, { ...product, cartId: Date.now() }])
    setSnackbar(`${product.name} (${product.size}) добавлена в корзину!`)
  }

  const removeFromCart = (cartId) => {
    setCart(prev => {
      const newCart = prev.filter(item => item.cartId !== cartId)
      if (newCart.length === 0) { setPromoApplied(null); setPromoCode(''); setActivePanel('catalog') }
      return newCart
    })
  }

  const toggleFavorite = (id) => setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])

  const subtotal = cart.reduce((sum, item) => sum + item.price, 0)
  const discount = promoApplied
    ? promoApplied.type === 'percent'
      ? Math.round(subtotal * promoApplied.discount / 100)
      : Math.min(promoApplied.discount, subtotal)
    : 0
  const total = subtotal - discount

  const applyPromo = async () => {
    if (!promoCode.trim()) return
    setPromoLoading(true)
    setPromoError('')
    try {
      const res = await fetch(`${API}/api/promocodes/${promoCode.trim().toUpperCase()}`)
      const data = await res.json()
      if (data.valid) {
        setPromoApplied(data)
        setSnackbar(`Промокод применён! Скидка: ${data.type === 'percent' ? data.discount + '%' : data.discount + ' ₽'}`)
      } else {
        setPromoError(data.reason || 'Недействительный промокод')
        setPromoApplied(null)
      }
    } catch {
      setPromoError('Ошибка проверки промокода')
    }
    setPromoLoading(false)
  }

  const removePromo = () => { setPromoApplied(null); setPromoCode(''); setPromoError('') }

  // Поиск города для предварительной оценки
  const searchCartCity = (q) => {
    setCartCitySearch(q)
    setDeliveryEstimate(null)
    if (q.length < 2) { setCartCityResults([]); return }
    clearTimeout(cartCityTimer.current)
    cartCityTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/cdek/cities?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setCartCityResults(data)
      } catch(e) {}
    }, 400)
  }

  const selectCartCity = async (city) => {
    setCartCity(city)
    setCartCitySearch(city.name)
    setCartCityResults([])
    setEstimateLoading(true)
    setDeliveryEstimate(null)
    try {
      const res = await fetch(`${API}/api/cdek/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city_code: city.code,
          items: cart.map(item => ({
            price: item.price,
            weight: item.weight || 300,
            length: item.length || 30,
            width: item.width || 40,
            height: item.height || 3
          }))
        })
      })
      const data = await res.json()
      setDeliveryEstimate(data)
    } catch(e) {}
    setEstimateLoading(false)
  }

  // Поиск города (для чекаута)
  const searchCity = (q) => {
    setCitySearch(q)
    if (q.length < 2) { setCityResults([]); return }
    clearTimeout(citySearchTimer.current)
    citySearchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/cdek/cities?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setCityResults(data)
      } catch (e) {}
    }, 500)
  }

  const selectCity = (city) => {
    setSelectedCity(city)
    setCitySearch(city.name)
    setCityResults([])
    setStreetSearch('')
    setStreetResults([])
    setPvzList([])
    setSelectedPvz(null)
    setDeliveryOptions([])
    setSelectedDelivery(null)
  }

  // Поиск улицы через DaData
  const searchStreet = async (q) => {
    setStreetSearch(q)
    if (q.length < 3 || !selectedCity) { setStreetResults([]); return }
    try {
      const res = await fetch(`${API}/api/dadata/suggest?city=${encodeURIComponent(selectedCity.name)}&q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setStreetResults(data)
    } catch (e) { console.error(e) }
  }

  // ВАЖНО: Новая функция selectStreet с использованием вашего прокси
  const selectStreet = async (suggestion) => {
  setStreetSearch(suggestion.value)
  setStreetResults([])
  setSelectedPvz(null)
  setDeliveryOptions([])
  setSelectedDelivery(null)

  setPvzLoading(true)
  
  // 1. Получаем координаты выбранной улицы
  let coords = null
  try {
    const res = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/address', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Token f857f124c478d8cd818f19af870979240a757e0d'
      },
      body: JSON.stringify({ query: suggestion.unrestricted_value })
    })
    const data = await res.json()
    if (data.suggestions && data.suggestions[0]) {
      const lat = data.suggestions[0].data.geo_lat
      const lon = data.suggestions[0].data.geo_lon
      if (lat && lon) {
        coords = { lat: parseFloat(lat), lon: parseFloat(lon) }
        setUserCoords(coords)
      }
    }
  } catch (e) {}

  // 2. Запрашиваем ПВЗ для выбранного города через ваш прокси
  try {
    const res = await fetch(`${API}/api/cdek-proxy?action=offices&city_code=${selectedCity.code}&is_handout=true&size=100`)
    const allPvz = await res.json()
    
    // Преобразуем в нужный формат
    const pvzWithCoords = allPvz.map(p => ({
      code: p.code,
      address: p.location.address,
      lat: p.location.latitude,
      lon: p.location.longitude,
      work_time: p.work_time
    }))

    // 3. Считаем расстояние до каждого ПВЗ (используем coords, полученные выше)
    const withDistance = pvzWithCoords.map(pvz => {
      if (!coords) return { ...pvz, distance: 999 }
      const d = 2 * 6371 * Math.asin(Math.sqrt(
        Math.pow(Math.sin((pvz.lat - coords.lat) * Math.PI / 360), 2) +
        Math.cos(coords.lat * Math.PI / 180) * Math.cos(pvz.lat * Math.PI / 180) *
        Math.pow(Math.sin((pvz.lon - coords.lon) * Math.PI / 360), 2)
      ))
      return { ...pvz, distance: d }
    })

    setPvzList(withDistance.sort((a, b) => a.distance - b.distance).slice(0, 20))
  } catch (e) { console.error(e) }
  setPvzLoading(false)
}

  const selectPvz = async (pvz) => {
    setSelectedPvz(pvz)
    setDeliveryOptions([])
    setSelectedDelivery(null)
    setDeliveryLoading(true)
    // Здесь можно добавить расчёт тарифов, если нужен
    setDeliveryLoading(false)
  }

  const tariffName = (code) => ({
    136: 'Обычная ПВЗ', 234: 'Экономичная ПВЗ', 368: 'Обычная Постамат', 378: 'Экономичная Постамат'
  })[code] || `Тариф ${code}`

  const cancelOrder = (clearCart) => {
    if (clearCart) setCart([])
    setShowCancelDialog(false)
    setCheckoutStep(1)
    setSelectedCity(null)
    setCitySearch('')
    setStreetSearch('')
    setPvzList([])
    setSelectedPvz(null)
    setDeliveryOptions([])
    setSelectedDelivery(null)
    setActivePanel('catalog')
  }

  const submitOrder = () => {
    if (!form.firstName || !form.lastName || !form.phone) { setSnackbar('Заполните все поля!'); return }
    if (!agreePolicy) { setSnackbar('Необходимо согласие с политикой обработки данных!'); return }
    if (!selectedPvz || !selectedDelivery) { setSnackbar('Выберите пункт выдачи и тариф доставки!'); return }
    setSubmitting(true)
    const name = `${form.lastName} ${form.firstName}`
    fetch(`${API}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart, 
        total: total + (selectedDelivery?.cost || 0),
        name,
        phone: form.phone,
        address: selectedPvz.address,
        vk_id: vkUser?.id || null,
        promo_code: promoApplied ? promoCode : null,
        promo_discount: promoApplied?.type === 'percent' ? promoApplied.discount : null,
        promo_fixed: promoApplied?.type === 'fixed' ? promoApplied.discount : null,
        delivery_city: selectedCity?.name,
        delivery_pvz: selectedPvz?.code,
        delivery_type: String(selectedDelivery?.tariff_code),
        delivery_cost: selectedDelivery?.cost,
      })
    })
      .then(res => res.json())
      .then(data => {
        setCart([])
        setForm(prev => ({ ...prev, phone: '' }))
        setAgreePolicy(false)
        setPromoApplied(null)
        setPromoCode('')
        setCheckoutStep(1)
        setSelectedCity(null)
        setCitySearch('')
        setStreetSearch('')
        setPvzList([])
        setSelectedPvz(null)
        setDeliveryOptions([])
        setSelectedDelivery(null)
        setActivePanel('catalog')
        setSnackbar(`Заказ №${data.id} оформлен! Мы свяжемся с вами.`)
        setSubmitting(false)
      })
  }

  const cartButton = (
    <PanelHeaderButton aria-label="Корзина" onClick={() => setActivePanel('cart')}>
      <div style={{ position: 'relative' }}>
        <Icon28ShoppingCartOutline />
        {cart.length > 0 && (
          <div style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#e24a4a', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {cart.length}
          </div>
        )}
      </div>
    </PanelHeaderButton>
  )

  return (
    <ConfigProvider colorScheme="dark">
      <AdaptivityProvider viewWidth={ViewWidth.MOBILE}>
        <AppRoot>
          <View activePanel={activePanel}>
            <Panel id="splash">
              <div 
                onClick={() => setActivePanel('catalog')} 
                style={{ 
                  height: '100vh', 
                  cursor: 'pointer', 
                  backgroundColor: '#111',
                  backgroundImage: `url(${API}/img/cover/cover.jpg)`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center bottom',
                  backgroundSize: typeof window !== 'undefined' && window.innerWidth < 600 ? 'contain' : 'cover'
                }} 
              />
            </Panel>

            <Panel id="catalog">
              <PanelHeader after={cartButton}>METKA SHOP</PanelHeader>
              {loading
                ? <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Spinner /></div>
                : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '10px' }}>
                    {products.map(product => {
                      const img = product.images ? product.images.split(',')[0].trim() : null
                      return (
                        <Card key={product.id} style={{ overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column' }} onClick={() => { setSelectedProduct(product); setActivePanel('product') }}>
                          <div style={{ width: '100%', aspectRatio: '2/3', overflow: 'hidden', background: '#2a2a2a', position: 'relative' }}>
                            {img && <img src={`${API}/${img}`} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                            {favorites.includes(product.id) && (
                              <div style={{ position: 'absolute', top: '6px', right: '6px' }}>
                                <Icon28Favorite style={{ color: '#e24a4a' }} />
                              </div>
                            )}
                          </div>
                          <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', minHeight: '60px' }}>
                            <Text weight="2" style={{ fontSize: '12px', marginBottom: '4px' }}>{product.name}</Text>
                            <Text style={{ fontSize: '14px', fontWeight: '600' }}>{product.price} ₽</Text>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
              }
            </Panel>

            <Panel id="product">
              <PanelHeader before={<PanelHeaderBack onClick={() => setActivePanel('catalog')} />} after={cartButton}>
                {selectedProduct?.name || ''}
              </PanelHeader>
              {selectedProduct && (
                <ProductDetail product={selectedProduct} onAdd={(p) => { addToCart(p) }} favorites={favorites} toggleFavorite={toggleFavorite} />
              )}
            </Panel>

            <Panel id="cart">
              <PanelHeader before={<PanelHeaderBack onClick={() => setActivePanel('catalog')} />}>Корзина</PanelHeader>
              {cart.length === 0
                ? <div style={{ textAlign: 'center', padding: '40px' }}>
                    <Text style={{ color: '#888' }}>Корзина пуста</Text>
                    <div style={{ marginTop: '16px' }}>
                      <Button onClick={() => setActivePanel('catalog')}>В каталог</Button>
                    </div>
                  </div>
                : <>
                    {cart.map(item => {
                      const img = item.images ? item.images.split(',')[0].trim() : null
                      return (
                        <div key={item.cartId} style={{ display: 'flex', gap: '12px', alignItems: 'center', borderBottom: '1px solid #333', padding: '12px 16px' }}>
                          {img && <img src={`${API}/${img}`} alt={item.name} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />}
                          <div style={{ flex: 1 }}>
                            <Text weight="2" style={{ fontSize: '13px' }}>{item.name}</Text>
                            <Text style={{ color: '#888', fontSize: '11px' }}>Арт: {item.art} · Размер: {item.size}</Text>
                            <Text weight="2">{item.price} ₽</Text>
                          </div>
                          <button onClick={() => removeFromCart(item.cartId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e24a4a', padding: '8px' }}>
                            <Icon28DeleteOutline />
                          </button>
                        </div>
                      )
                    })}

                    <div style={{ padding: '16px', borderBottom: '1px solid #333' }}>
                      {!promoApplied
                        ? <>
                            <Text style={{ color: '#888', fontSize: '13px', marginBottom: '8px' }}>Есть промокод?</Text>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <Input
                                placeholder="Введите промокод"
                                value={promoCode}
                                onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError('') }}
                                style={{ flex: 1 }}
                              />
                              <Button loading={promoLoading} onClick={applyPromo}>Применить</Button>
                            </div>
                            {promoError && <Text style={{ color: '#e24a4a', fontSize: '12px', marginTop: '6px' }}>{promoError}</Text>}
                          </>
                        : <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a3a1a', padding: '10px 12px', borderRadius: '8px' }}>
                            <Text style={{ color: '#44cc88', fontSize: '13px' }}>
                              ✓ Промокод <strong>{promoCode}</strong> — скидка {promoApplied.type === 'percent' ? promoApplied.discount + '%' : promoApplied.discount + ' ₽'}
                            </Text>
                            <button onClick={removePromo} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                          </div>
                      }
                    </div>

                    <div style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <Text style={{ color: '#888', fontSize: '13px' }}>Товары ({cart.length} шт.)</Text>
                        <Text style={{ fontSize: '13px' }}>{subtotal} ₽</Text>
                      </div>
                      {promoApplied && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <Text style={{ color: '#44cc88', fontSize: '13px' }}>Скидка по промокоду</Text>
                          <Text style={{ color: '#44cc88', fontSize: '13px' }}>−{discount} ₽</Text>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #333', marginBottom: '16px' }}>
                        <Title level="3">Итого</Title>
                        <Title level="3">{total} ₽</Title>
                      </div>

                      {/* Блок оценки доставки */}
                      <div style={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: '10px', padding: '12px', marginBottom: '16px' }}>
                        <Text style={{ fontSize: '13px', color: '#aaa', marginBottom: '8px', display: 'block' }}>🚚 Узнать стоимость доставки</Text>
                        <Input
                          placeholder="Введите ваш город"
                          value={cartCitySearch}
                          onChange={e => searchCartCity(e.target.value)}
                          style={{ marginBottom: '4px' }}
                        />
                        {cartCityResults.length > 0 && (
                          <div style={{ background: '#111', border: '1px solid #333', borderRadius: '8px', marginTop: '4px', overflow: 'hidden' }}>
                            {cartCityResults.map(city => (
                              <div key={city.code} onClick={() => selectCartCity(city)}
                                style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #222' }}>
                                <Text style={{ fontSize: '13px' }}>{city.name}</Text>
                                {city.region && <Text style={{ fontSize: '11px', color: '#666', display: 'block' }}>{city.region}</Text>}
                              </div>
                            ))}
                          </div>
                        )}
                        {estimateLoading && (
                          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px' }}><Spinner /></div>
                        )}
                        {deliveryEstimate && !estimateLoading && deliveryEstimate.error && (
                          <Text style={{ color: '#e24a4a', fontSize: '13px', marginTop: '8px', display: 'block' }}>Не удалось рассчитать доставку</Text>
                        )}
                        {deliveryEstimate && !estimateLoading && !deliveryEstimate.error && (
                          <div style={{ marginTop: '10px', padding: '10px', background: '#0a2a0a', border: '1px solid #44aa44', borderRadius: '8px' }}>
                            <Text style={{ color: '#88ff88', fontSize: '13px' }}>
                              Доставка в <strong>{cartCity?.name}</strong>: от <strong>{deliveryEstimate.cost} ₽</strong>
                            </Text>
                            <Text style={{ color: '#666', fontSize: '11px', display: 'block', marginTop: '2px' }}>
                              ≈ {deliveryEstimate.days} дней · Точная стоимость при выборе ПВЗ
                            </Text>
                          </div>
                        )}
                      </div>

                      <Button size="l" stretched onClick={() => {
                        if (cartCity) {
                          setSelectedCity(cartCity)
                          setCitySearch(cartCity.name)
                        }
                        setActivePanel('checkout')
                      }}>Оформить заказ</Button>
                    </div>
                  </>
              }
            </Panel>

            <Panel id="checkout">
              <PanelHeader before={<PanelHeaderBack onClick={() => setActivePanel('cart')} />}>Оформление</PanelHeader>
              <div style={{ padding: '16px' }}>

                {showCancelDialog && (
                  <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box' }}>
                    <div style={{ background: '#1a1a1a', borderRadius: '12px', padding: '24px', maxWidth: '320px', width: '100%' }}>
                      <Title level="3" style={{ marginBottom: '12px' }}>Отменить заказ?</Title>
                      <Text style={{ color: '#aaa', marginBottom: '20px', display: 'block' }}>Удалить товары из корзины?</Text>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Button size="m" stretched appearance="negative" onClick={() => cancelOrder(true)}>Да, удалить</Button>
                        <Button size="m" stretched appearance="neutral" onClick={() => cancelOrder(false)}>Нет, оставить</Button>
                      </div>
                      <Button size="m" stretched appearance="overlay" style={{ marginTop: '8px' }} onClick={() => setShowCancelDialog(false)}>Продолжить оформление</Button>
                    </div>
                  </div>
                )}

                {checkoutStep === 1 && (
                  <>
                    <div style={{ background: '#1a1a2e', border: '1px solid #4a4aaa44', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                      <Text style={{ color: '#aaaaff', fontSize: '13px' }}>📦 Шаг 1 из 2 — Где вам удобнее забрать заказ?</Text>
                    </div>

                    <FormItem top="1. Выберите город">
                      <Input
                        placeholder="Начните вводить название города"
                        value={citySearch}
                        onChange={e => searchCity(e.target.value)}
                      />
                    </FormItem>

                    {cityResults.length > 0 && (
                      <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', marginBottom: '16px', overflow: 'hidden' }}>
                        {cityResults.map(city => (
                          <div key={city.code} onClick={() => selectCity(city)}
                            style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #222' }}>
                            <Text style={{ fontSize: '14px' }}>{city.name}</Text>
                            {city.region && <Text style={{ fontSize: '11px', color: '#888' }}>{city.region}</Text>}
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedCity && (
                      <FormItem top="2. Введите вашу улицу (найдем ближайшие ПВЗ)">
                        <Input
                          placeholder="Например: Ленина"
                          value={streetSearch}
                          onChange={e => searchStreet(e.target.value)}
                        />
                      </FormItem>
                    )}

                    {streetResults.length > 0 && (
                      <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', marginBottom: '16px', overflow: 'hidden' }}>
                        {streetResults.map((street, i) => (
                          <div key={i} onClick={() => selectStreet(street)}
                            style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #222' }}>
                            <Text style={{ fontSize: '13px' }}>{street.value}</Text>
                          </div>
                        ))}
                      </div>
                    )}

                    {pvzLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}><Spinner /></div>}

                    {pvzList.length > 0 && !pvzLoading && (
                      <>
                        <Text style={{ fontSize: '13px', color: '#888', marginBottom: '8px', display: 'block' }}>
                          3. Выберите пункт выдачи на карте или из списка:
                        </Text>
                        <PvzMap
                          pvzList={pvzList}
                          selectedPvz={selectedPvz}
                          onSelectPvz={selectPvz}
                          userCoords={userCoords}
                        />
                        <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #333', borderRadius: '8px', marginBottom: '16px' }}>
                          {pvzList.map(pvz => (
                            <div key={pvz.code} onClick={() => selectPvz(pvz)}
                              style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #222', background: selectedPvz?.code === pvz.code ? '#1a3a1a' : 'transparent' }}>
                              <Text style={{ fontSize: '13px', fontWeight: selectedPvz?.code === pvz.code ? '600' : '400' }}>{pvz.address}</Text>
                              <Text style={{ fontSize: '11px', color: '#44cc88', marginTop: '2px' }}>≈ {pvz.distance.toFixed(1)} км от вас</Text>
                              {pvz.work_time && <Text style={{ fontSize: '11px', color: '#888' }}>{pvz.work_time}</Text>}
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {deliveryLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}><Spinner /></div>}

                    {/* Здесь можно будет добавить выбор тарифов, когда реализуете расчёт */}

                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                      <Button size="l" stretched
                        disabled={!selectedPvz} // пока достаточно выбора ПВЗ
                        onClick={() => setCheckoutStep(2)}>
                        Далее →
                      </Button>
                      <Button size="l" appearance="neutral" onClick={() => setShowCancelDialog(true)}>Отмена</Button>
                    </div>
                  </>
                )}

                {checkoutStep === 2 && (
                  <>
                    {selectedPvz && (
                      <div style={{ background: '#1a2a1a', border: '1px solid #44aa44', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                        <Text style={{ color: '#88ff88', fontSize: '13px' }}>✅ ПВЗ: {selectedPvz.address}</Text>
                      </div>
                    )}

                    {vkUser && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '12px', background: '#2a2a2a', borderRadius: '8px' }}>
                        {vkUser.photo_100 && <img src={vkUser.photo_100} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />}
                        <Text>{vkUser.first_name} {vkUser.last_name}</Text>
                      </div>
                    )}

                    <div style={{ background: '#2a1a1a', border: '1px solid #e24a4a44', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                      <Text style={{ color: '#ffaa44', fontSize: '13px' }}>
                        ⚠️ Укажите настоящие данные — они нужны для получения посылки в СДЭК. Неверные данные = потерянный заказ!
                      </Text>
                    </div>

                    <FormItem top="Имя">
                      <Input placeholder="Иван" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
                    </FormItem>
                    <FormItem top="Фамилия">
                      <Input placeholder="Иванов" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
                    </FormItem>
                    <FormItem top="Телефон">
                      <Input placeholder="+7 900 000 00 00" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                    </FormItem>

                    <div style={{ padding: '8px 0 16px' }}>
                      <Checkbox checked={agreePolicy} onChange={e => setAgreePolicy(e.target.checked)}>
                        <Text style={{ fontSize: '12px' }}>
                          Я согласен с{' '}
                          <span onClick={() => setActivePanel('policy')} style={{ color: '#5b9cf6', cursor: 'pointer' }}>
                            политикой обработки персональных данных
                          </span>
                        </Text>
                      </Checkbox>
                    </div>

                    <div style={{ borderTop: '1px solid #333', paddingTop: '12px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <Text style={{ color: '#888', fontSize: '13px' }}>Товары</Text>
                        <Text style={{ fontSize: '13px' }}>{subtotal} ₽</Text>
                      </div>
                      {promoApplied && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <Text style={{ color: '#44cc88', fontSize: '13px' }}>Скидка</Text>
                          <Text style={{ color: '#44cc88', fontSize: '13px' }}>−{discount} ₽</Text>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                        <Title level="3">Итого</Title>
                        <Title level="3">{total} ₽</Title>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button size="l" stretched loading={submitting} disabled={!agreePolicy} onClick={submitOrder}>
                        Подтвердить заказ
                      </Button>
                      <Button size="l" appearance="neutral" onClick={() => setCheckoutStep(1)}>← Назад</Button>
                    </div>
                    <Button size="m" stretched appearance="negative" style={{ marginTop: '8px' }} onClick={() => setShowCancelDialog(true)}>
                      Отменить заказ
                    </Button>
                  </>
                )}
              </div>
            </Panel>

            <Panel id="policy">
              <PanelHeader before={<PanelHeaderBack onClick={() => setActivePanel('checkout')} />}>
                Политика обработки данных
              </PanelHeader>
              <div style={{ padding: '16px' }}>
                <Title level="2" style={{ marginBottom: '16px' }}>Политика обработки персональных данных</Title>
                <p style={{ color: '#ccc', fontSize: '13px', lineHeight: '1.6', marginBottom: '12px' }}>Настоящая политика определяет порядок обработки персональных данных пользователей магазина METKA SHOP.</p>
                <p style={{ color: '#ccc', fontSize: '13px', lineHeight: '1.6', marginBottom: '12px' }}><strong style={{ color: '#fff' }}>Какие данные мы собираем:</strong> имя, фамилия, номер телефона, идентификатор ВКонтакте.</p>
                <p style={{ color: '#ccc', fontSize: '13px', lineHeight: '1.6', marginBottom: '12px' }}><strong style={{ color: '#fff' }}>Для чего используются данные:</strong> исключительно для оформления и доставки заказа через службу СДЭК.</p>
                <p style={{ color: '#ccc', fontSize: '13px', lineHeight: '1.6', marginBottom: '12px' }}><strong style={{ color: '#fff' }}>Передача третьим лицам:</strong> данные передаются только в службу доставки СДЭК в объёме, необходимом для оформления отправления.</p>
                <p style={{ color: '#ccc', fontSize: '13px', lineHeight: '1.6', marginBottom: '12px' }}><strong style={{ color: '#fff' }}>Хранение данных:</strong> данные хранятся на защищённом сервере и не передаются иным третьим лицам.</p>
                <p style={{ color: '#ccc', fontSize: '13px', lineHeight: '1.6', marginBottom: '16px' }}><strong style={{ color: '#fff' }}>Ваши права:</strong> вы можете запросить удаление ваших данных, написав нам в сообщения сообщества ВКонтакте.</p>
                <Button stretched onClick={() => setActivePanel('checkout')}>Понятно, вернуться к заказу</Button>
              </div>
            </Panel>

          </View>
          {snackbar && <Snackbar onClose={() => setSnackbar(null)}>{snackbar}</Snackbar>}
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  )
}

export default App