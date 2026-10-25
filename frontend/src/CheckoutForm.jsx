import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from 'axios';

export default function CheckoutForm({ clientSecret, orderId, onPaymentSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setErrorMsg('');

    // Stripe மூலம் கார்டு பேமெண்டை உறுதி செய்தல்
    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: elements.getElement(CardElement),
      },
    });

    if (result.error) {
      setErrorMsg(result.error.message);
      setLoading(false);
    } else {
      if (result.paymentIntent.status === 'succeeded') {
        // Backend-க்கு தகவல் தெரிவித்து அடுத்த புராடக்டுகளை பெறுதல்
        const res = await axios.post('http://127.0.0.1:8000/api/confirm-order/', {
          order_id: orderId,
        });
        setLoading(false);
        onPaymentSuccess(res.data);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ border: '1px solid #ccc', padding: 20, borderRadius: 8, marginTop: 20 }}>
      <h3>Enter Test Card Details</h3>
      <div style={{ padding: 10, border: '1px solid #ddd', borderRadius: 4, marginBottom: 15 }}>
        <CardElement options={{ style: { base: { fontSize: '16px' } } }} />
      </div>
      {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}
      <button type="submit" disabled={!stripe || loading} style={{ padding: '10px 20px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
        {loading ? 'Processing...' : 'Pay with Test Card'}
      </button>
    </form>
  );
}