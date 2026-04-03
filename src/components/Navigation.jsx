import React from 'react';
import { NavLink } from 'react-router-dom';

function Navigation({ currentUser }) {
  return (
    <nav className="main-nav">
      <div className="nav-logo">StreamList</div>
      <ul className="nav-links">
        <li>
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="material-symbols-outlined">home</span>
            Home
          </NavLink>
        </li>
        <li>
          <NavLink to="/find" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="material-symbols-outlined">search</span>
            Find
          </NavLink>
        </li>
        <li>
          <NavLink to="/movie" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="material-symbols-outlined">movie</span>
            Movies
          </NavLink>
        </li>
        <li>
          <NavLink to="/cart" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="material-symbols-outlined">shopping_cart</span>
            Cart
          </NavLink>
        </li>
        <li>
          <NavLink to="/about" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="material-symbols-outlined">info</span>
            About
          </NavLink>
        </li>
        <li>
          <NavLink to={currentUser ? '/profile' : '/login'} className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="material-symbols-outlined">{currentUser ? 'account_circle' : 'login'}</span>
            {currentUser ? 'Profile' : 'Login'}
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}

export default Navigation;
