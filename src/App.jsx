import { useState, useEffect, useRef } from 'react'
import { AppRoot, ConfigProvider, AdaptivityProvider, ViewWidth, View, Panel, PanelHeader, PanelHeaderBack, PanelHeaderButton, Card, Text, Title, Button, Spinner, Input, FormItem, Snackbar } from '@vkontakte/vkui'
import { Icon28ShoppingCartOutline, Icon28FavoriteOutline, Icon28Favorite, Icon28DeleteOutline } from '@vkontakte/icons'
import '@vkontakte/vkui/dist/vkui.css'

const API = 'http://192.168.1.2:3001'

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
  const [form, setForm] = useState({ name: '', phone: '', address: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
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
      if (newCart.length === 0) setActivePanel('catalog')
      return newCart
    })
  }

  const toggleFavorite = (id) => setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
  const total = cart.reduce((sum, item) => sum + item.price, 0)

  const submitOrder = () => {
    if (!form.name || !form.phone || !form.address) { setSnackbar('Заполните все поля!'); return }
    setSubmitting(true)
    fetch(`${API}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cart, total, name: form.name, phone: form.phone, address: form.address })
    })
      .then(res => res.json())
      .then(data => {
        setCart([])
        setForm({ name: '', phone: '', address: '' })
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
              <div onClick={() => setActivePanel('catalog')} style={{ height: '100vh', cursor: 'pointer', overflow: 'hidden', background: '#111' }}>
                <img src={`${API}/img/cover/cover.jpg`} alt="METKA SHOP" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
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
                    <div style={{ padding: '16px' }}>
                      <Title level="2" style={{ marginBottom: '12px' }}>Итого: {total} ₽</Title>
                      <Button size="l" stretched onClick={() => setActivePanel('checkout')}>Оформить заказ</Button>
                    </div>
                  </>
              }
            </Panel>

            <Panel id="checkout">
              <PanelHeader before={<PanelHeaderBack onClick={() => setActivePanel('cart')} />}>Оформление</PanelHeader>
              <div style={{ padding: '16px' }}>
                <FormItem top="Ваше имя">
                  <Input placeholder="Иван Иванов" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </FormItem>
                <FormItem top="Телефон">
                  <Input placeholder="+7 900 000 00 00" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </FormItem>
                <FormItem top="Адрес доставки">
                  <Input placeholder="Город, улица, дом, квартира" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                </FormItem>
                <FormItem>
                  <Title level="3" style={{ marginBottom: '12px' }}>Итого: {total} ₽</Title>
                  <Button size="l" stretched loading={submitting} onClick={submitOrder}>Подтвердить заказ</Button>
                </FormItem>
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