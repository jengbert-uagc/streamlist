import React from 'react';
import { NavLink } from 'react-router-dom';

function Navigation() {
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
          <NavLink to="/movies" className={({ isActive }) => isActive ? 'active' : ''}>
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
      </ul>
    </nav>
  );
}

export default Navigation;
