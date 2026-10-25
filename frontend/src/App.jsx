import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Render Backend API Live URL
const API_BASE_URL = "https://ecommerce-razorpay-django-react-1.onrender.com";

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  // 1. Backend-il ninnu products fetch cheyyuka
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
      setErrorMessage("Products load cheyyan sadhichilla. Backend check cheyyuka.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Razorpay Checkout handle cheyyuka
  const handleBuyNow = async (product) => {
    try {
      setProcessingPayment(true);

      // Razorpay Order create cheyyuka
      const orderRes = await axios.post(`${API_BASE_URL}/api/create-razorpay-order/`, {
        product_id: product.id,
      });

      const orderData = orderRes.data;

      // Razorpay Checkout window options
      const options = {
        key: orderData.razorpay_key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "PrintStack Store",
        description: `Buying ${orderData.product_name}`,
        order_id: orderData.razorpay_order_id,
        handler: async function (response) {
          try {
            // Payment verify cheyyuka
            const verifyRes = await axios.post(`${API_BASE_URL}/api/verify-payment/`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            // Upsell recommendations screen kanikkuka
            setSuccessData(verifyRes.data);
          } catch (verifyErr) {
            alert("Payment verification fail aayi!");
            console.error(verifyErr);
          }
        },
        prefill: {
          name: "Test Customer",
          email: "customer@example.com",
          contact: "9999999999",
        },
        theme: {
          color: "#0f172a",
        },
      };

      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (resp) {
          alert("Payment fail aayi: " + resp.error.description);
        });
        rzp.open();
      } else {
        alert("Razorpay SDK load aayittilla! index.html check cheyyuka.");
      }
    } catch (err) {
      console.error("Order error:", err);
      alert("Order create cheyyan sadhichilla.");
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '40px auto', fontFamily: 'Arial, sans-serif', padding: '0 20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: 15, marginBottom: 30 }}>
        <h1 style={{ margin: 0, color: '#111827' }}>PrintStack Store</h1>
        <button 
          onClick={fetchProducts} 
          style={{ padding: '8px 16px', background: '#e2e8f0', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}
        >
          Refresh Products
        </button>
      </header>

      {/* Success / Upsell View */}
      {successData ? (
        <div style={{ background: '#ecfdf5', padding: 30, borderRadius: 12, border: '1px solid #10b981' }}>
          <h2 style={{ color: '#065f46', marginTop: 0 }}>Payment Successful!</h2>
          <p style={{ fontSize: 16 }}>
            Order ID: <strong>#{successData.order_id}</strong> | Product: <strong>{successData.purchased_item}</strong>
          </p>

          <hr style={{ margin: '25px 0', border: 'none', borderTop: '1px solid #a7f3d0' }} />

          <h3 style={{ color: '#047857' }}>Special Add-ons (Free Delivery with your parcel)</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
            {successData.recommendations && successData.recommendations.length > 0 ? (
              successData.recommendations.map((addon) => (
                <div key={addon.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 15 }}>
                  <img 
                    src={addon.image_url} 
                    alt={addon.name} 
                    style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 6 }} 
                  />
                  <h4 style={{ margin: '10px 0 5px' }}>{addon.name}</h4>
                  <p style={{ color: '#047857', fontWeight: 'bold', fontSize: 16, margin: '5px 0 10px' }}>Rs. {addon.price}</p>
                  <button 
                    onClick={() => alert("Added to your order!")} 
                    style={{ width: '100%', padding: '8px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    + Add to My Parcel
                  </button>
                </div>
              ))
            ) : (
              <p>Add-on recommendations onnumilla.</p>
            )}
          </div>

          <button 
            onClick={() => setSuccessData(null)} 
            style={{ marginTop: 25, padding: '10px 20px', background: '#374151', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            Continue Shopping
          </button>
        </div>
      ) : (
        /* Products Catalog View */
        <div>
          {loading && <p style={{ fontSize: 18, color: '#6b7280' }}>Products load aavunnu, please wait...</p>}
          
          {errorMessage && (
            <div style={{ padding: 15, background: '#fee2e2', border: '1px solid #ef4444', color: '#b91c1c', borderRadius: 6, marginBottom: 20 }}>
              {errorMessage}
            </div>
          )}

          {!loading && products.length === 0 && !errorMessage && (
            <p>Products onnum kandethan aayilla.</p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 25 }}>
            {products.map((item) => (
              <div 
                key={item.id} 
                style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, background: '#fff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              >
                <div>
                  <img 
                    src={item.image_url} 
                    alt={item.name} 
                    style={{ width: '100%', height: 170, objectFit: 'cover', borderRadius: 8, marginBottom: 12 }} 
                  />
                  <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#1f2937' }}>{item.name}</h3>
                  <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 12px' }}>{item.description}</p>
                </div>

                <div>
                  <p style={{ fontWeight: 'bold', fontSize: 20, color: '#111827', margin: '0 0 12px' }}>Rs. {item.price}</p>
                  <button 
                    onClick={() => handleBuyNow(item)}
                    disabled={processingPayment}
                    style={{ width: '100%', padding: '12px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 15, fontWeight: 'bold' }}
                  >
                    {processingPayment ? "Processing..." : "Buy Now"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}