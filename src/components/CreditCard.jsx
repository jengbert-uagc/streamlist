import React, { useState } from 'react';

const CREDIT_CARD_STORAGE_KEY_PREFIX = 'streamlist-credit-card';
const CARD_NUMBER_PATTERN = /^\d{4} \d{4} \d{4} \d{4}$/;
const EXPIRY_PATTERN = /^(0[1-9]|1[0-2])\/\d{2}$/;
const CVV_PATTERN = /^\d{3,4}$/;

const formatCardNumber = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
};

const formatExpiry = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

const getStorageKey = (username) => `${CREDIT_CARD_STORAGE_KEY_PREFIX}:${username}`;

const INITIAL_FORM = {
  cardholderName: '',
  cardNumber: '',
  expiryDate: '',
  cvv: '',
};

const loadStoredCard = (username) => {
  if (!username) {
    return INITIAL_FORM;
  }

  try {
    const stored = localStorage.getItem(getStorageKey(username));
    if (!stored) {
      return INITIAL_FORM;
    }
    const parsed = JSON.parse(stored);
    return {
      cardholderName: typeof parsed.cardholderName === 'string' ? parsed.cardholderName : '',
      cardNumber: typeof parsed.cardNumber === 'string' ? formatCardNumber(parsed.cardNumber) : '',
      expiryDate: typeof parsed.expiryDate === 'string' ? parsed.expiryDate : '',
      cvv: typeof parsed.cvv === 'string' ? parsed.cvv : '',
    };
  } catch {
    return INITIAL_FORM;
  }
};

function CreditCard({ currentUser }) {
  const [form, setForm] = useState(() => loadStoredCard(currentUser));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setSuccess('');
    setError('');

    if (name === 'cardNumber') {
      setForm((previous) => ({ ...previous, cardNumber: formatCardNumber(value) }));
      return;
    }

    if (name === 'expiryDate') {
      setForm((previous) => ({ ...previous, expiryDate: formatExpiry(value) }));
      return;
    }

    if (name === 'cvv') {
      setForm((previous) => ({ ...previous, cvv: value.replace(/\D/g, '').slice(0, 4) }));
      return;
    }

    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const validateForm = () => {
    if (!form.cardholderName.trim()) {
      return 'Cardholder name is required.';
    }
    if (!CARD_NUMBER_PATTERN.test(form.cardNumber)) {
      return 'Card number must follow 1234 5678 9012 3456 format.';
    }
    if (!EXPIRY_PATTERN.test(form.expiryDate)) {
      return 'Expiry date must be in MM/YY format.';
    }
    if (!CVV_PATTERN.test(form.cvv)) {
      return 'CVV must be 3 or 4 digits.';
    }
    return '';
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSuccess('');
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    localStorage.setItem(getStorageKey(currentUser), JSON.stringify(form));
    setSuccess('Credit card saved successfully.');
  };

  return (
    <div className="page-container credit-card-page">
      <h2>Credit Card</h2>
      <p>Enter your payment details and save them for this account.</p>

      <form onSubmit={handleSubmit} className="auth-form">
        <label htmlFor="cardholderName">Cardholder Name</label>
        <input
          id="cardholderName"
          name="cardholderName"
          type="text"
          value={form.cardholderName}
          onChange={handleInputChange}
          className="auth-input"
          autoComplete="cc-name"
          required
        />

        <label htmlFor="cardNumber">Card Number</label>
        <input
          id="cardNumber"
          name="cardNumber"
          type="text"
          value={form.cardNumber}
          onChange={handleInputChange}
          className="auth-input"
          autoComplete="cc-number"
          placeholder="1234 5678 9012 3456"
          inputMode="numeric"
          required
        />

        <label htmlFor="expiryDate">Expiry Date (MM/YY)</label>
        <input
          id="expiryDate"
          name="expiryDate"
          type="text"
          value={form.expiryDate}
          onChange={handleInputChange}
          className="auth-input"
          autoComplete="cc-exp"
          placeholder="MM/YY"
          inputMode="numeric"
          required
        />

        <label htmlFor="cvv">CVV</label>
        <input
          id="cvv"
          name="cvv"
          type="password"
          value={form.cvv}
          onChange={handleInputChange}
          className="auth-input"
          autoComplete="cc-csc"
          inputMode="numeric"
          required
        />

        {error ? <p className="auth-error">{error}</p> : null}
        {success ? <p className="auth-success">{success}</p> : null}

        <button type="submit" className="add-button auth-submit">
          Save Card
        </button>
      </form>
    </div>
  );
}

export default CreditCard;
