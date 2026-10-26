import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = "https://ecommerce-razorpay-django-react-1.onrender.com";

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  
  // State for Cart and Wishlist
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [activeTab, setActiveTab] = useState('store'); // 'store', 'cart', 'wishlist'

  // State for Customer Details Checkout Modal
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutProduct, setCheckoutProduct] = useState(null);
  const [customerDetails, setCustomerDetails] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    pincode: '',
  });

  // State for Processing and Post-Purchase Upsell
  const [processingPayment, setProcessingPayment] = useState(false);
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const res = await axios.get(`${API_BASE_URL}/api/products/`);
      setProducts(res.data || []);
    } catch (err) {
      console.error("Products fetch error:", err);
      setErrorMessage("Failed to load products. Please ensure the backend server is reachable.");
    } finally {
      setLoading(false);
    }
  };

  // Wishlist Toggle
  const toggleWishlist = (product) => {
    if (wishlist.some((item) => item.id === product.id)) {
      setWishlist(wishlist.filter((item) => item.id !== product.id));
    } else {
      setWishlist([...wishlist, product]);
    }
  };

  // Cart Functions
  const addToCart = (product) => {
    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      setCart(cart.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    alert(`${product.name} added to cart!`);
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.id !== productId));
  };

  const updateCartQuantity = (productId, delta) => {
    setCart(cart.map((item) => {
      if (item.id === productId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  // Open Checkout Modal for a single product or whole cart
  const startCheckout = (product) => {
    setCheckoutProduct(product);
    setIsCheckoutOpen(true);
  };

  const handleInputChange = (e) => {
    setCustomerDetails({
      ...customerDetails,
      [e.target.name]: e.target.value,
    });
  };

  // Execute Razorpay Payment after Checkout Form validation
  const handleProceedToPayment = async (e) => {
    e.preventDefault();

    if (!customerDetails.name || !customerDetails.email || !customerDetails.phone || !customerDetails.address) {
      alert("Please fill in all required customer details.");
      return;
    }

    try {
      setProcessingPayment(true);

      const targetProduct = checkoutProduct || cart[0];
      if (!targetProduct) {
        alert("No product selected for purchase.");
        return;
      }

      // Step 1: Request Razorpay Order from Django Backend
      const orderRes = await axios.post(`${API_BASE_URL}/api/create-razorpay-order/`, {
        product_id: targetProduct.id,
      });

      const orderData = orderRes.data;

      // Step 2: Open Razorpay modal with customer details prefilled
      const options = {
        key: orderData.razorpay_key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "PrintStack Store",
        description: `Order for ${orderData.product_name}`,
        order_id: orderData.razorpay_order_id,
        handler: async function (response) {
          try {
            // Step 3: Verify Payment Signature via Backend
            const verifyRes = await axios.post(`${API_BASE_URL}/api/verify-payment/`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            setIsCheckoutOpen(false);
            if (checkoutProduct && cart.some(c => c.id === checkoutProduct.id)) {
              removeFromCart(checkoutProduct.id);
            }
            setSuccessData({
              ...verifyRes.data,
              shippingDetails: customerDetails
            });
          } catch (verifyErr) {
            alert("Payment signature verification failed. Please check server logs.");
            console.error(verifyErr);
          }
        },
        prefill: {
          name: customerDetails.name,
          email: customerDetails.email,
          contact: customerDetails.phone,
        },
        notes: {
          address: `${customerDetails.address}, ${customerDetails.city} - ${customerDetails.pincode}`,
        },
        theme: {
          color: "#0f172a",
        },
      };

      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (resp) {
          alert("Payment Failed: " + resp.error.description);
        });
        rzp.open();
      } else {
        alert("Razorpay checkout SDK failed to load. Check index.html.");
      }
    } catch (err) {
      console.error("Order Creation Error:", err.response?.data || err.message);
      const serverErr = err.response?.data?.error || err.message;
      alert("Order initiation failed: " + serverErr);
    } finally {
      setProcessingPayment(false);
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '20px' }}>
      
      {/* Navigation Bar */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: 20, marginBottom: 30 }}>
        <h1 
          onClick={() => { setActiveTab('store'); setSuccessData(null); }} 
          style={{ cursor: 'pointer', margin: 0, fontSize: 26, fontWeight: 800, color: '#111827' }}
        >
          PrintStack Store
        </h1>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button 
            onClick={() => { setActiveTab('store'); setSuccessData(null); }}
            style={{ padding: '8px 14px', background: activeTab === 'store' ? '#111827' : '#f3f4f6', color: activeTab === 'store' ? '#fff' : '#111827', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
          >
            Products
          </button>

          <button 
            onClick={() => { setActiveTab('wishlist'); setSuccessData(null); }}
            style={{ padding: '8px 14px', background: activeTab === 'wishlist' ? '#111827' : '#f3f4f6', color: activeTab === 'wishlist' ? '#fff' : '#111827', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>❤️ Wishlist</span>
            <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, padding: '2px 7px', fontSize: 12 }}>{wishlist.length}</span>
          </button>

          <button 
            onClick={() => { setActiveTab('cart'); setSuccessData(null); }}
            style={{ padding: '8px 14px', background: activeTab === 'cart' ? '#111827' : '#f3f4f6', color: activeTab === 'cart' ? '#fff' : '#111827', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>🛒 Cart</span>
            <span style={{ background: '#0284c7', color: '#fff', borderRadius: 10, padding: '2px 7px', fontSize: 12 }}>
              {cart.reduce((total, item) => total + item.quantity, 0)}
            </span>
          </button>

          <button 
            onClick={fetchProducts}
            title="Refresh Catalog"
            style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            🔄
          </button>
        </div>
      </nav>

      {/* View 1: Payment Success & Post-Purchase Upsell Recommendations */}
      {successData ? (
        <div style={{ background: '#ecfdf5', padding: 30, borderRadius: 12, border: '1px solid #10b981' }}>
          <h2 style={{ color: '#065f46', marginTop: 0 }}>Payment Successful!</h2>
          <p style={{ fontSize: 16 }}>
            Order ID: <strong>#{successData.order_id}</strong> | Product: <strong>{successData.purchased_item}</strong>
          </p>
          <p style={{ fontSize: 14, color: '#047857' }}>
            Shipping to: <strong>{successData.shippingDetails?.name}</strong>, {successData.shippingDetails?.address}, {successData.shippingDetails?.city} - {successData.shippingDetails?.pincode}
          </p>

          <hr style={{ margin: '25px 0', border: 'none', borderTop: '1px solid #a7f3d0' }} />

          <h3 style={{ color: '#047857' }}>Recommended Add-ons (Free shipping with your parcel)</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
            {successData.recommendations && successData.recommendations.length > 0 ? (
              successData.recommendations.map((addon) => (
                <div key={addon.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 15 }}>
                  <img src={addon.image_url} alt={addon.name} style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 6 }} />
                  <h4 style={{ margin: '10px 0 5px', fontSize: 15 }}>{addon.name}</h4>
                  <p style={{ color: '#047857', fontWeight: 'bold', fontSize: 16, margin: '5px 0 10px' }}>Rs. {addon.price}</p>
                  <button 
                    onClick={() => alert("Added to your current order package!")} 
                    style={{ width: '100%', padding: '8px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                  >
                    + Add to Parcel
                  </button>
                </div>
              ))
            ) : (
              <p>No extra recommendations for this item.</p>
            )}
          </div>

          <button 
            onClick={() => { setSuccessData(null); setActiveTab('store'); }} 
            style={{ marginTop: 25, padding: '10px 20px', background: '#374151', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
          >
            Continue Shopping
          </button>
        </div>
      ) : activeTab === 'cart' ? (
        
        /* View 2: Cart Page */
        <div>
          <h2>Your Shopping Cart</h2>
          {cart.length === 0 ? (
            <p>Your cart is empty. <span onClick={() => setActiveTab('store')} style={{ color: '#0284c7', cursor: 'pointer', textDecoration: 'underline' }}>Browse products</span></p>
          ) : (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 15, marginBottom: 25 }}>
                {cart.map((item) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 15, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                      <img src={item.image_url} alt={item.name} style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 6 }} />
                      <div>
                        <h4 style={{ margin: '0 0 5px' }}>{item.name}</h4>
                        <p style={{ margin: 0, color: '#6b7280' }}>Rs. {item.price}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button onClick={() => updateCartQuantity(item.id, -1)} style={{ padding: '4px 10px', cursor: 'pointer' }}>-</button>
                      <span style={{ fontWeight: 'bold' }}>{item.quantity}</span>
                      <button onClick={() => updateCartQuantity(item.id, 1)} style={{ padding: '4px 10px', cursor: 'pointer' }}>+</button>
                      <button onClick={() => removeFromCart(item.id)} style={{ marginLeft: 15, color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #eee', paddingTop: 15 }}>
                <h3>Total Amount: Rs. {cartTotal.toFixed(2)}</h3>
                <button 
                  onClick={() => startCheckout(cart[0])}
                  style={{ padding: '12px 24px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
                >
                  Proceed to Checkout
                </button>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'wishlist' ? (
        
        /* View 3: Wishlist Page */
        <div>
          <h2>Your Wishlist</h2>
          {wishlist.length === 0 ? (
            <p>Your wishlist is empty.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 20 }}>
              {wishlist.map((item) => (
                <div key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 15 }}>
                  <img src={item.image_url} alt={item.name} style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 6 }} />
                  <h4>{item.name}</h4>
                  <p style={{ fontWeight: 'bold' }}>Rs. {item.price}</p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button 
                      onClick={() => { addToCart(item); toggleWishlist(item); }}
                      style={{ flex: 1, padding: '8px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                    >
                      Move to Cart
                    </button>
                    <button 
                      onClick={() => toggleWishlist(item)}
                      style={{ padding: '8px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (

        /* View 4: Main Product Catalog */
        <div>
          {loading && <p style={{ fontSize: 18, color: '#6b7280' }}>Loading products, please wait...</p>}
          {errorMessage && <div style={{ padding: 15, background: '#fee2e2', color: '#b91c1c', borderRadius: 6, marginBottom: 20 }}>{errorMessage}</div>}
          {!loading && products.length === 0 && !errorMessage && <p>No products found in the catalog.</p>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 25 }}>
            {products.map((item) => {
              const isWishlisted = wishlist.some((w) => w.id === item.id);
              return (
                <div 
                  key={item.id} 
                  style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#fff', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}
                >
                  {/* Wishlist Heart Icon Toggle */}
                  <button 
                    onClick={() => toggleWishlist(item)}
                    style={{ position: 'absolute', top: 22, right: 22, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}
                  >
                    {isWishlisted ? '❤️' : '🤍'}
                  </button>

                  <div>
                    <img src={item.image_url} alt={item.name} style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 8, marginBottom: 12 }} />
                    <h3 style={{ margin: '0 0 6px', fontSize: 18, color: '#111827' }}>{item.name}</h3>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px', minHeight: 36 }}>{item.description}</p>
                  </div>

                  <div>
                    <p style={{ fontWeight: 800, fontSize: 20, color: '#111827', margin: '0 0 14px' }}>Rs. {item.price}</p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button 
                        onClick={() => addToCart(item)}
                        style={{ flex: 1, padding: '10px', background: '#f3f4f6', color: '#111827', border: '1px solid #d1d5db', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Add to Cart
                      </button>
                      <button 
                        onClick={() => startCheckout(item)}
                        style={{ flex: 1, padding: '10px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Buy Now
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Checkout Shipping Details Modal */}
      {isCheckoutOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: 30, borderRadius: 12, width: '90%', maxWidth: 500, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>Customer & Delivery Details</h2>
              <button onClick={() => setIsCheckoutOpen(false)} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>

            {checkoutProduct && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#f8fafc', padding: 10, borderRadius: 6, marginBottom: 20 }}>
                <img src={checkoutProduct.image_url} alt="" style={{ width: 45, height: 45, objectFit: 'cover', borderRadius: 4 }} />
                <div>
                  <strong style={{ fontSize: 14 }}>{checkoutProduct.name}</strong>
                  <div style={{ color: '#0284c7', fontWeight: 'bold' }}>Rs. {checkoutProduct.price}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleProceedToPayment} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Full Name *</label>
                <input required type="text" name="name" value={customerDetails.name} onChange={handleInputChange} placeholder="e.g. Manikandan" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', marginTop: 4, boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Email *</label>
                  <input required type="email" name="email" value={customerDetails.email} onChange={handleInputChange} placeholder="name@example.com" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', marginTop: 4, boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Phone *</label>
                  <input required type="tel" name="phone" value={customerDetails.phone} onChange={handleInputChange} placeholder="9876543210" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', marginTop: 4, boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Shipping Address *</label>
                <textarea required rows="2" name="address" value={customerDetails.address} onChange={handleInputChange} placeholder="Door No, Street Name, Area" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', marginTop: 4, boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>City</label>
                  <input type="text" name="city" value={customerDetails.city} onChange={handleInputChange} placeholder="Chennai" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', marginTop: 4, boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Pincode</label>
                  <input type="text" name="pincode" value={customerDetails.pincode} onChange={handleInputChange} placeholder="600001" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', marginTop: 4, boxSizing: 'border-box' }} />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={processingPayment}
                style={{ marginTop: 10, padding: 14, background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
              >
                {processingPayment ? "Initiating Razorpay..." : "Proceed to Razorpay Payment"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}