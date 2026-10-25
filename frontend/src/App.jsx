import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CheckoutPage from './CheckoutPage.jsx';

export default function App() {
  const [products, setProducts] = useState([]);
  const [successData, setSuccessData] = useState(null);
  const [checkoutProducts, setCheckoutProducts] = useState(null);
  const [checkoutFromCart, setCheckoutFromCart] = useState(false);
  const [productsError, setProductsError] = useState('');
  const [cartItems, setCartItems] = useState([]);
  const [showCart, setShowCart] = useState(false);

  const API_BASE_URL = "https://ecommerce-razorpay-django-react-1.onrender.com";
  const addToCart = (product) => {
    setCartItems((items) => (
      items.some((item) => item.id === product.id) ? items : [...items, product]
    ));
  };

  const openCheckout = (productsToCheckout, fromCart = false) => {
    setCheckoutProducts(Array.isArray(productsToCheckout) ? productsToCheckout : [productsToCheckout]);
    setCheckoutFromCart(fromCart);
    setShowCart(false);
  };

  const cartTotal = cartItems.reduce(
    (totalCents, item) => totalCents + Math.round(Number(item.price) * 100),
    0,
  ) / 100;

  // 1. புராடக்டுகளை பெறுதல்
  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/products/`)
      .then((res) => setProducts(res.data))
      .catch((err) => {
        console.error(err);
        setProductsError('Unable to load products. Please try again later.');
      });
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', fontFamily: 'Arial, sans-serif', padding: '0 20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <h1>PrintStack Store</h1>
        <nav aria-label="Store navigation">
          <button
            type="button"
            onClick={() => {
              setCheckoutProducts(null);
              setShowCart(false);
            }}
            style={{
              padding: '10px 14px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            Products
          </button>
          <button
            type="button"
            onClick={() => {
              setCheckoutProducts(null);
              setShowCart(true);
            }}
            aria-current={showCart ? 'page' : undefined}
            style={{
              padding: '10px 14px',
              border: '1px solid #1a202c',
              borderRadius: 5,
              background: showCart ? '#1a202c' : '#fff',
              color: showCart ? '#fff' : '#1a202c',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            Cart ({cartItems.length})
          </button>
        </nav>
      </header>

      {/* Screen 1: பேமெண்ட் முடிந்து Upsell காட்டும் திரை */}
      {successData ? (
        <div style={{ background: '#e6fffa', padding: 25, borderRadius: 8, border: '1px solid #38b2ac' }}>
          <h2>✅ Payment Successful!</h2>
          <p>Your order for <strong>{successData.purchased_item}</strong> is confirmed (Order ID: #{successData.order_id}).</p>
          
          <hr style={{ margin: '20px 0' }} />

          <h3>🔥 Complete your setup before it ships! (Zero Extra Delivery Fee)</h3>
          <div style={{ display: 'flex', gap: 20 }}>
            {successData.recommendations && successData.recommendations.length > 0 ? (
              successData.recommendations.map((addon) => (
                <div key={addon.id} style={{ border: '1px solid #ddd', padding: 15, borderRadius: 6, background: '#fff', width: 220 }}>
                  <img src={addon.image_url} alt={addon.name} style={{ width: '100%', height: 120, objectFit: 'cover' }} />
                  <h4>{addon.name}</h4>
                  <p style={{ color: '#2b6cb0', fontWeight: 'bold' }}>₹{addon.price}</p>
                  <button style={{ background: '#38a169', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 4, cursor: 'pointer' }}>
                    + Add to My Parcel
                  </button>
                </div>
              ))
            ) : (
              <p>No extra add-ons suggested for this item.</p>
            )}
          </div>
          <button onClick={() => setSuccessData(null)} style={{ marginTop: 20, padding: '8px 15px', cursor: 'pointer' }}>
            Shop More Items
          </button>
        </div>
      ) : (
        /* Screen 2: Catalog திரை */
        checkoutProducts ? (
          <CheckoutPage
            products={checkoutProducts}
            onBack={() => {
              setCheckoutProducts(null);
              setShowCart(checkoutFromCart);
            }}
            onPaymentSuccess={(data) => {
              const purchasedIds = new Set(checkoutProducts.map((item) => item.id));
              setCartItems((items) => items.filter((item) => !purchasedIds.has(item.id)));
              setSuccessData(data);
              setCheckoutProducts(null);
              setShowCart(false);
            }}
          />
        ) : showCart ? (
          <section aria-labelledby="cart-title">
            <h2 id="cart-title">Your cart</h2>
            {cartItems.length === 0 ? (
              <div style={{ padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
                <p>Your cart is empty.</p>
                <button
                  type="button"
                  onClick={() => setShowCart(false)}
                  style={{ marginTop: 12, padding: '10px 14px', cursor: 'pointer' }}
                >
                  Continue shopping
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                {cartItems.map((item) => (
                  <article
                    key={item.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '100px minmax(0, 1fr) auto',
                      alignItems: 'center',
                      gap: 16,
                      padding: 14,
                      border: '1px solid #eee',
                      borderRadius: 8,
                      textAlign: 'left',
                    }}
                  >
                    <img
                      src={item.image_url}
                      alt={item.name}
                      style={{ width: 100, height: 90, objectFit: 'cover', borderRadius: 5 }}
                    />
                    <div>
                      <h3 style={{ margin: '0 0 6px' }}>{item.name}</h3>
                      <p style={{ fontWeight: 'bold' }}>₹{item.price}</p>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => setCartItems((items) => items.filter((cartItem) => cartItem.id !== item.id))}
                        style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
                <aside style={{ display: 'grid', justifyItems: 'end', gap: 12, padding: 16, border: '1px solid #eee', borderRadius: 8 }}>
                  <p>
                    Product total ({cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}):{' '}
                    <strong>₹{cartTotal.toFixed(2)}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => openCheckout(cartItems, true)}
                    style={{
                      padding: '11px 20px',
                      background: '#1a202c',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    Buy Now
                  </button>
                </aside>
              </div>
            )}
          </section>
        ) : (
        <div>
          {productsError && <p role="alert" style={{ color: '#c53030' }}>{productsError}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 20 }}>
            {products.map((item) => (
              <div key={item.id} style={{ border: '1px solid #eee', padding: 15, borderRadius: 8, boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                <img src={item.image_url} alt={item.name} style={{ width: '100%', height: 150, objectFit: 'cover' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <h3>{item.name}</h3>
                  <button
                    type="button"
                    onClick={() => addToCart(item)}
                    aria-label={`Add ${item.name} to cart`}
                    aria-pressed={cartItems.some((cartItem) => cartItem.id === item.id)}
                    title={cartItems.some((cartItem) => cartItem.id === item.id) ? 'Added to cart' : 'Add to cart'}
                    style={{
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      border: '1px solid #fed7e2',
                      borderRadius: '50%',
                      background: cartItems.some((cartItem) => cartItem.id === item.id) ? '#fff5f7' : '#fff',
                      color: '#d53f8c',
                      fontSize: 22,
                      lineHeight: 1,
                      cursor: 'pointer',
                    }}
                  >
                    {cartItems.some((cartItem) => cartItem.id === item.id) ? '♥' : '♡'}
                  </button>
                </div>
                <p>{item.description}</p>
                <p style={{ fontWeight: 'bold', fontSize: 18 }}>₹{item.price}</p>
                <button
                  onClick={() => openCheckout(item)}
                  style={{ width: '100%', padding: 10, background: '#1a202c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  Buy Now
                </button>
              </div>
            ))}
          </div>
        </div>
        )
      )}
    </div>
  );
}