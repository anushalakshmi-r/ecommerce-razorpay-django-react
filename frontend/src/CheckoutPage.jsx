import { useState } from 'react';
import axios from 'axios';
import './CheckoutPage.css';

const shippingOptions = {
  standard: { label: 'Standard delivery (3–5 business days)', price: 0 },
  express: { label: 'Express delivery (1–2 business days)', price: 99 },
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 12px',
  border: '1px solid #cbd5e0',
  borderRadius: 5,
  font: 'inherit',
};

const labelStyle = {
  display: 'grid',
  gap: 6,
  textAlign: 'left',
  color: '#2d3748',
  fontSize: 14,
};

export default function CheckoutPage({ products, onBack, onPaymentSuccess }) {
  const [shippingMethod, setShippingMethod] = useState('standard');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const productTotal = products.reduce(
    (totalCents, product) => totalCents + Math.round(Number(product.price) * 100),
    0,
  ) / 100;
  const total = productTotal + shippingOptions[shippingMethod].price;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      if (!window.Razorpay) {
        throw new Error('The payment service could not be loaded. Please refresh and try again.');
      }

      const formData = new FormData(event.currentTarget);
      const orderResponse = await axios.post(
        'http://127.0.0.1:8000/api/create-razorpay-order/',
        {
          product_ids: products.map((product) => product.id),
          customer_name: formData.get('customer_name'),
          customer_email: formData.get('customer_email'),
          customer_phone: formData.get('customer_phone'),
          address_line1: formData.get('address_line1'),
          address_line2: formData.get('address_line2'),
          city: formData.get('city'),
          state: formData.get('state'),
          postal_code: formData.get('postal_code'),
          country: formData.get('country'),
          shipping_method: shippingMethod,
        },
      );

      const order = orderResponse.data;
      const payment = new window.Razorpay({
        key: order.razorpay_key,
        amount: order.amount,
        currency: order.currency,
        name: 'PrintStack Store',
        description: `Purchase for ${order.product_name}`,
        order_id: order.razorpay_order_id,
        prefill: {
          name: formData.get('customer_name'),
          email: formData.get('customer_email'),
          contact: formData.get('customer_phone'),
        },
        theme: { color: '#3399cc' },
        handler: async (response) => {
          try {
            const verificationResponse = await axios.post(
              'http://127.0.0.1:8000/api/verify-payment/',
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            );
            onPaymentSuccess(verificationResponse.data);
          } catch (error) {
            console.error(error);
            setErrorMessage('Payment verification failed. Please contact support before trying again.');
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });

      payment.on('payment.failed', (response) => {
        setErrorMessage(`Payment failed: ${response.error.description}`);
        setLoading(false);
      });
      payment.open();
    } catch (error) {
      console.error(error);
      const responseData = error.response?.data;
      const apiMessage = responseData && typeof responseData === 'object'
        ? responseData.error ||
          responseData.detail ||
          Object.entries(responseData)
            .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : String(messages)}`)
            .join('; ')
        : responseData;
      setErrorMessage(
        apiMessage ||
          (error.request
            ? 'Could not reach the store server. Make sure Django is running and try again.'
            : error.message || 'Unable to start checkout. Please try again.'),
      );
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 760, margin: '0 auto 40px', textAlign: 'left' }}>
      <button
        type="button"
        onClick={onBack}
        style={{ border: 0, background: 'none', padding: '8px 0', cursor: 'pointer' }}
      >
        ← Back to products
      </button>
      <h2 style={{ margin: '16px 0 20px' }}>Checkout</h2>

      <div className="checkout-layout">
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
          <h3 style={{ margin: '0 0 2px' }}>Shipping details</h3>
          <label style={labelStyle}>
            Full name
            <input style={inputStyle} name="customer_name" autoComplete="name" required maxLength={200} />
          </label>
          <div className="checkout-fields-row">
            <label style={labelStyle}>
              Email
              <input style={inputStyle} name="customer_email" type="email" autoComplete="email" required />
            </label>
            <label style={labelStyle}>
              Phone
              <input
                style={inputStyle}
                name="customer_phone"
                type="tel"
                autoComplete="tel"
                pattern="\+?[0-9\s()-]{7,20}"
                required
              />
            </label>
          </div>
          <label style={labelStyle}>
            Address
            <input
              style={inputStyle}
              name="address_line1"
              autoComplete="address-line1"
              placeholder="House number and street"
              required
              maxLength={255}
            />
          </label>
          <label style={labelStyle}>
            Apartment, suite, etc. (optional)
            <input
              style={inputStyle}
              name="address_line2"
              autoComplete="address-line2"
              maxLength={255}
            />
          </label>
          <div className="checkout-fields-row">
            <label style={labelStyle}>
              City
              <input style={inputStyle} name="city" autoComplete="address-level2" required maxLength={100} />
            </label>
            <label style={labelStyle}>
              State / Province
              <input style={inputStyle} name="state" autoComplete="address-level1" required maxLength={100} />
            </label>
            <label style={labelStyle}>
              PIN / Postal code
              <input
                style={inputStyle}
                name="postal_code"
                autoComplete="postal-code"
                pattern="[A-Za-z0-9 -]{3,12}"
                required
                maxLength={12}
              />
            </label>
            <label style={labelStyle}>
              Country
              <input
                style={inputStyle}
                name="country"
                autoComplete="country-name"
                defaultValue="India"
                required
                maxLength={100}
              />
            </label>
          </div>

          <fieldset style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: 14 }}>
            <legend style={{ fontWeight: 600, padding: '0 5px' }}>Shipping method</legend>
            {Object.entries(shippingOptions).map(([value, option]) => (
              <label
                key={value}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0' }}
              >
                <span>
                  <input
                    type="radio"
                    name="shipping_method"
                    value={value}
                    checked={shippingMethod === value}
                    onChange={() => setShippingMethod(value)}
                  />{' '}
                  {option.label}
                </span>
                <strong>{option.price ? `₹${option.price}` : 'Free'}</strong>
              </label>
            ))}
          </fieldset>

          {errorMessage && <p role="alert" style={{ color: '#c53030' }}>{errorMessage}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: 12,
              background: '#1a202c',
              color: '#fff',
              border: 0,
              borderRadius: 5,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Opening secure payment...' : 'Continue to secure payment'}
          </button>
        </form>

        <aside style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Order summary</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {products.map((product) => (
              <div key={product.id} style={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr) auto', alignItems: 'center', gap: 10 }}>
                <img
                  src={product.image_url}
                  alt={product.name}
                  style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 5 }}
                />
                <span>{product.name}</span>
                <strong>₹{Number(product.price).toFixed(2)}</strong>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
            <span>Products total</span><span>₹{productTotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
            <span>Shipping</span>
            <span>{shippingOptions[shippingMethod].price ? `₹${shippingOptions[shippingMethod].price}.00` : 'Free'}</span>
          </div>
          <hr style={{ border: 0, borderTop: '1px solid #e2e8f0', margin: '14px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>Total</span><span>₹{total.toFixed(2)}</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
