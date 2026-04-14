import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import catalog from '../data.js';

const hasSubscriptionInCart = (cartItems) => cartItems.some((item) => item.type === 'subscription');

function Cart({ cartItems, setCartItems }) {
  const navigate = useNavigate();
  const [warning, setWarning] = useState('');

  const handleAddToCart = (product) => {
    if (product.type === 'subscription' && hasSubscriptionInCart(cartItems)) {
      setWarning('Only one subscription can be added at a time.');
      return;
    }

    setWarning('');
    setCartItems((previousItems) => {
      const existingItem = previousItems.find((item) => item.id === product.id);
      if (existingItem) {
        return previousItems.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      return [...previousItems, { ...product, quantity: 1 }];
    });
  };

  const handleIncrement = (itemId) => {
    setCartItems((previousItems) =>
      previousItems.map((item) =>
        item.id === itemId ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  };

  const handleDecrement = (itemId) => {
    setCartItems((previousItems) =>
      previousItems.map((item) =>
        item.id === itemId ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item
      )
    );
  };

  const handleRemove = (itemId) => {
    setCartItems((previousItems) => previousItems.filter((item) => item.id !== itemId));
  };

  const totalItems = cartItems.reduce((count, item) => count + item.quantity, 0);
  const totalPrice = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="cart-page">
      <section className="page-container">
        <h2>Subscriptions</h2>
        <p>Add one subscription plus any EZTech accessories.</p>
        {warning && <p className="cart-warning">{warning}</p>}
        <ul className="subscription-grid">
          {catalog.map((product) => (
            <li key={product.id} className="subscription-card">
              <img src={product.img} alt={product.service} className="subscription-image" />
              <div className="subscription-details">
                <h3>{product.service}</h3>
                <p>{product.serviceInfo}</p>
                <strong>${product.price.toFixed(2)}</strong>
              </div>
              <button type="button" className="add-button" onClick={() => handleAddToCart(product)}>
                Add to Cart
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="page-container cart-review">
        <h2>Cart</h2>
        {cartItems.length === 0 ? (
          <p>Your cart is currently empty.</p>
        ) : (
          <>
            <ul className="cart-items">
              {cartItems.map((item) => (
                <li key={item.id} className="cart-item">
                  <div className="cart-item-info">
                    <h3>{item.service}</h3>
                    <p>${item.price.toFixed(2)} each</p>
                  </div>
                  <div className="cart-item-controls">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => handleDecrement(item.id)}
                      disabled={item.type === 'subscription'}
                    >
                      -
                    </button>
                    <span className="cart-quantity">{item.quantity}</span>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => handleIncrement(item.id)}
                      disabled={item.type === 'subscription'}
                    >
                      +
                    </button>
                    <button type="button" className="icon-button danger" onClick={() => handleRemove(item.id)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="cart-summary">
              <p>Items: {totalItems}</p>
              <p>Total: ${totalPrice.toFixed(2)}</p>
            </div>
            <div className="checkout-actions">
              <button
                type="button"
                className="add-button"
                onClick={() => navigate('/credit-card')}
                disabled={cartItems.length === 0}
              >
                Checkout
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default Cart;
