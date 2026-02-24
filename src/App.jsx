import { useState, useEffect, useRef } from 'react'
import { AppRoot, ConfigProvider, AdaptivityProvider, ViewWidth, View, Panel, PanelHeader, PanelHeaderBack, PanelHeaderButton, Card, Text, Title, Button, Spinner, Input, FormItem, Snackbar, Checkbox } from '@vkontakte/vkui'
import { Icon28ShoppingCartOutline, Icon28FavoriteOutline, Icon28Favorite, Icon28DeleteOutline } from '@vkontakte/icons'
import bridge from '@vkontakte/vk-bridge'
import '@vkontakte/vkui/dist/vkui.css'

const API = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? ''
  : 'http://192.168.1.2:3001'

function Lightbox({ src, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
      <img src={src} alt="" style={{ maxWidth: '95%', maxHeight: '95%', objectFit: 'contain', borderRadius: '8px' }} />
    </div>
  )
}

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
      <div style={{ position: 'relative', width: '100%', aspectRatio: '2/3', overflow: 'hidden', background: '#2a2a2a', cursor: 'zoom-in' }} onClick={() => setLightbox(`${API}/${images[currentImg]}`)} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <img src={`${API}/${images[currentImg]}`} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
  // CDEK доставка
  const [cityQuery, setCityQuery] = useState('')
  const [cityResults, setCityResults] = useState([])
  const [citySearching, setCitySearching] = useState(false)
  const [selectedCity, setSelectedCity] = useState(null)
  const [pvzList, setPvzList] = useState([])
  const [pvzLoading, setPvzLoading] = useState(false)
  const [selectedPvz, setSelectedPvz] = useState(null)
  const [deliveryCost, setDeliveryCost] = useState(null)
  const [deliveryLoading, setDeliveryLoading] = useState(false)

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

  // Поиск города СДЭК с дебаунсом
  useEffect(() => {
    if (!cityQuery || cityQuery.length < 2 || selectedCity) {
      if (!selectedCity) setCityResults([])
      return
    }
    const timer = setTimeout(async () => {
      setCitySearching(true)
      try {
        const res = await fetch(`${API}/api/cdek/cities?q=${encodeURIComponent(cityQuery)}`)
        const data = await res.json()
        setCityResults(Array.isArray(data) ? data : [])
      } catch { setCityResults([]) }
      setCitySearching(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [cityQuery, selectedCity])

  const addToCart = (product) => {
    setCart(prev => [...prev, { ...product, cartId: Date.now() }])
    setSnackbar(`${product.name} (${product.size}) добавлена в корзину!`)
  }

  const removeFromCart = (cartId) => {
    setCart(prev => {
      const newCart = prev.filter(item => item.cartId !== cartId)
      if (newCart.length === 0) {
        setPromoApplied(null); setPromoCode(''); setActivePanel('catalog')
        setSelectedCity(null); setSelectedPvz(null); setDeliveryCost(null); setCityQuery('')
      }
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
  const grandTotal = total + (deliveryCost || 0)

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

  const handleCityChange = (e) => {
    setCityQuery(e.target.value)
    if (selectedCity) {
      setSelectedCity(null)
      setSelectedPvz(null)
      setDeliveryCost(null)
      setPvzList([])
    }
  }

  const selectCity = async (city) => {
    setSelectedCity(city)
    setCityQuery(`${city.city}${city.region ? ', ' + city.region : ''}`)
    setCityResults([])
    setSelectedPvz(null)
    setDeliveryCost(null)
    setPvzLoading(true)
    try {
      const res = await fetch(`${API}/api/cdek/pvz?city_code=${city.code}`)
      const data = await res.json()
      setPvzList(Array.isArray(data) ? data : [])
    } catch { setPvzList([]) }
    setPvzLoading(false)
    setActivePanel('pvz')
  }

  const selectPvz = async (pvz) => {
    setSelectedPvz(pvz)
    setActivePanel('checkout')
    if (!selectedCity) return
    setDeliveryLoading(true)
    try {
      const totalWeight = cart.reduce((sum, item) => sum + (item.weight || 500), 0)
      const res = await fetch(`${API}/api/cdek/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_city_code: selectedCity.code, weight: totalWeight }),
      })
      const data = await res.json()
      setDeliveryCost(data.total_sum || null)
    } catch { setDeliveryCost(null) }
    setDeliveryLoading(false)
  }

  const submitOrder = () => {
    if (!form.firstName || !form.lastName || !form.phone) { setSnackbar('Заполните все поля!'); return }
    if (!agreePolicy) { setSnackbar('Необходимо согласие с политикой обработки данных!'); return }
    if (!selectedCity || !selectedPvz) { setSnackbar('Выберите пункт выдачи СДЭК!'); return }
    setSubmitting(true)
    const name = `${form.lastName} ${form.firstName}`
    fetch(`${API}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart,
        total: grandTotal,
        name,
        phone: form.phone,
        address: selectedPvz.location?.address_full || selectedPvz.location?.address || selectedPvz.name,
        vk_id: vkUser?.id || null,
        promo_code: promoApplied ? promoCode : null,
        promo_discount: promoApplied?.type === 'percent' ? promoApplied.discount : null,
        promo_fixed: promoApplied?.type === 'fixed' ? promoApplied.discount : null,
        delivery_city: selectedCity.city,
        delivery_pvz: selectedPvz.code,
        delivery_type: 'Посылка склад-склад (136)',
        delivery_cost: deliveryCost || 0,
      }),
    })
      .then(res => res.json())
      .then(data => {
        setCart([])
        setForm(prev => ({ ...prev, phone: '' }))
        setAgreePolicy(false)
        setPromoApplied(null)
        setPromoCode('')
        setSelectedCity(null)
        setSelectedPvz(null)
        setDeliveryCost(null)
        setCityQuery('')
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
        <AppRoot style={{ maxWidth: '600px', margin: '0 auto', minHeight: '100vh' }}>
          <View activePanel={activePanel}>

            <Panel id="splash">
              <div onClick={() => setActivePanel('catalog')} style={{ height: '100vh', cursor: 'pointer', overflow: 'hidden', background: '#111', display: 'flex', justifyContent: 'center' }}>
                <img src={`${API}/img/cover/cover.jpg`} alt="METKA SHOP" style={{ height: '100%', width: 'auto', maxWidth: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
              </div>
            </Panel>

            <Panel id="catalog">
              <PanelHeader after={cartButton}>METKA SHOP</PanelHeader>
              {loading
                ? <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Spinner /></div>
                : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '8px' }}>
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', paddingTop: '8px', borderTop: '1px solid #333' }}>
                        <Title level="3">Итого</Title>
                        <Title level="3">{total} ₽</Title>
                      </div>
                      <Button size="l" stretched onClick={() => setActivePanel('checkout')}>Оформить заказ</Button>
                    </div>
                  </>
              }
            </Panel>

            <Panel id="checkout">
              <PanelHeader before={<PanelHeaderBack onClick={() => setActivePanel('cart')} />}>Оформление</PanelHeader>
              <div style={{ padding: '16px' }}>
                {vkUser && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '12px', background: '#2a2a2a', borderRadius: '8px' }}>
                    {vkUser.photo_100 && <img src={vkUser.photo_100} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />}
                    <Text>{vkUser.first_name} {vkUser.last_name}</Text>
                  </div>
                )}
                <div style={{ background: '#2a1a1a', border: '1px solid #e24a4a44', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                  <Text style={{ color: '#ffaa44', fontSize: '13px' }}>
                    ⚠️ Укажите настоящие данные — они нужны для получения посылки в пункте СДЭК. Неверные данные = потерянный заказ!
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

                {/* Доставка СДЭК */}
                <FormItem top="Город доставки">
                  <Input
                    placeholder="Начните вводить город..."
                    value={cityQuery}
                    onChange={handleCityChange}
                    after={citySearching ? <Spinner size="small" /> : null}
                  />
                  {cityResults.length > 0 && (
                    <div style={{ background: '#2a2a2a', border: '1px solid #444', borderRadius: '8px', marginTop: '4px', overflow: 'hidden' }}>
                      {cityResults.map(city => (
                        <div
                          key={city.code}
                          onClick={() => selectCity(city)}
                          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #333', fontSize: '14px' }}
                        >
                          <span style={{ color: '#fff' }}>{city.city}</span>
                          {city.region && <span style={{ color: '#888', fontSize: '12px' }}>, {city.region}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </FormItem>

                {selectedCity && (
                  <div style={{ margin: '-4px 0 16px 0' }}>
                    {!selectedPvz ? (
                      <Button
                        size="m"
                        mode="secondary"
                        stretched
                        onClick={() => setActivePanel('pvz')}
                        loading={pvzLoading}
                      >
                        {pvzLoading ? 'Загружаем пункты выдачи...' : 'Выбрать пункт выдачи СДЭК →'}
                      </Button>
                    ) : (
                      <div style={{ background: '#1a2a1a', border: '1px solid #44cc8844', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <Text style={{ color: '#44cc88', fontSize: '12px', marginBottom: '4px' }}>✓ Пункт выдачи выбран</Text>
                            <Text style={{ fontSize: '13px', color: '#fff' }}>{selectedPvz.location?.address || selectedPvz.name}</Text>
                            {selectedPvz.work_time && (
                              <Text style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>{selectedPvz.work_time}</Text>
                            )}
                            {deliveryLoading && (
                              <Text style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>Считаем стоимость доставки...</Text>
                            )}
                            {!deliveryLoading && deliveryCost !== null && (
                              <Text style={{ color: '#ffaa44', fontSize: '13px', marginTop: '4px' }}>Доставка: {deliveryCost} ₽</Text>
                            )}
                            {!deliveryLoading && deliveryCost === null && (
                              <Text style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>Стоимость доставки уточняется</Text>
                            )}
                          </div>
                          <button
                            onClick={() => setActivePanel('pvz')}
                            style={{ background: 'none', border: 'none', color: '#5b9cf6', cursor: 'pointer', fontSize: '12px', padding: '0 0 0 8px', whiteSpace: 'nowrap' }}
                          >
                            Изменить
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

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
                  {deliveryCost !== null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <Text style={{ color: '#888', fontSize: '13px' }}>Доставка СДЭК</Text>
                      <Text style={{ fontSize: '13px' }}>{deliveryCost} ₽</Text>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #333' }}>
                    <Title level="3">Итого</Title>
                    <Title level="3">{grandTotal} ₽</Title>
                  </div>
                </div>
                <Button
                  size="l"
                  stretched
                  loading={submitting}
                  disabled={!agreePolicy || !selectedCity || !selectedPvz}
                  onClick={submitOrder}
                >
                  Подтвердить заказ
                </Button>
              </div>
            </Panel>

            <Panel id="pvz">
              <PanelHeader before={<PanelHeaderBack onClick={() => setActivePanel('checkout')} />}>
                Выбор пункта выдачи
              </PanelHeader>
              {selectedCity && (
                <div style={{ padding: '10px 16px', borderBottom: '1px solid #333', background: '#2a2a2a' }}>
                  <Text style={{ color: '#888', fontSize: '13px' }}>
                    Город: <span style={{ color: '#fff' }}>{selectedCity.city}{selectedCity.region ? `, ${selectedCity.region}` : ''}</span>
                  </Text>
                </div>
              )}
              {pvzLoading
                ? <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Spinner /></div>
                : pvzList.length === 0
                  ? <div style={{ textAlign: 'center', padding: '40px' }}>
                      <Text style={{ color: '#888' }}>Пункты выдачи не найдены</Text>
                    </div>
                  : <div>
                      {pvzList.map(pvz => (
                        <div
                          key={pvz.code}
                          onClick={() => selectPvz(pvz)}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid #2a2a2a',
                            cursor: 'pointer',
                            background: selectedPvz?.code === pvz.code ? '#1a2a1a' : 'transparent',
                          }}
                        >
                          <Text weight="2" style={{ fontSize: '13px', color: selectedPvz?.code === pvz.code ? '#44cc88' : '#fff' }}>
                            {selectedPvz?.code === pvz.code ? '✓ ' : ''}{pvz.location?.address || pvz.name}
                          </Text>
                          {pvz.work_time && (
                            <Text style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>{pvz.work_time}</Text>
                          )}
                        </div>
                      ))}
                    </div>
              }
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
