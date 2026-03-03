import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

export default function PaymentModal({ course, onClose, onSuccess }) {
    const [cardNumber, setCardNumber] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvv, setCvv] = useState('');
    const [loading, setLoading] = useState(false);

    // Format card number as XXXX XXXX XXXX XXXX
    const formatCard = (val) => {
        const digits = val.replace(/\D/g, '').slice(0, 16);
        return digits.replace(/(.{4})/g, '$1 ').trim();
    };

    // Format expiry as MM/YY
    const formatExpiry = (val) => {
        const digits = val.replace(/\D/g, '').slice(0, 4);
        if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
        return digits;
    };

    const handlePay = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            toast.loading('Processing payment…', { id: 'pay' });
            await axios.post('/api/checkout', {
                lessonId: course.lesson_id,
                cardNumber: cardNumber.replace(/\s/g, ''),
                expiry,
                cvv,
            });
            toast.success('Payment successful! Course unlocked.', { id: 'pay' });
            onSuccess(course.lesson_id);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Payment failed.', { id: 'pay' });
        } finally {
            setLoading(false);
        }
    };

    const price = parseFloat(course.price);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <div className="modal-title">Complete purchase</div>
                        <div className="modal-subtitle">{course.title}</div>
                    </div>
                    <button className="btn btn-ghost modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    <div className="price-display">
                        ₹{price === 0 ? 'Free' : price.toFixed(2)}
                    </div>

                    <form onSubmit={handlePay} className="payment-form">
                        <div className="field">
                            <label htmlFor="card-number">Card number</label>
                            <input
                                id="card-number"
                                className="input mono"
                                type="text"
                                inputMode="numeric"
                                placeholder="4111 1111 1111 1111"
                                value={cardNumber}
                                onChange={(e) => setCardNumber(formatCard(e.target.value))}
                                maxLength={19}
                                required
                            />
                        </div>

                        <div className="field-row">
                            <div className="field">
                                <label htmlFor="expiry">Expiry</label>
                                <input
                                    id="expiry"
                                    className="input mono"
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="MM/YY"
                                    value={expiry}
                                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                                    maxLength={5}
                                    required
                                />
                            </div>
                            <div className="field">
                                <label htmlFor="cvv">CVV</label>
                                <input
                                    id="cvv"
                                    className="input mono"
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="123"
                                    value={cvv}
                                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                    maxLength={4}
                                    required
                                />
                            </div>
                        </div>

                        <div className="demo-card-notice">
                            Demo: use card <code>4111 1111 1111 1111</code>, any future date, any CVV
                        </div>

                        <button
                            className="btn btn-primary"
                            type="submit"
                            disabled={loading}
                            style={{ width: '100%', justifyContent: 'center', marginTop: '0.75rem' }}
                        >
                            {loading ? 'Processing…' : `Pay ₹${price === 0 ? '0.00' : price.toFixed(2)}`}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
