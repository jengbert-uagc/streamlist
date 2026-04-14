import React from 'react';

function About() {
  return (
    <div className="page-container about-page">
      <section className="about-hero">
        <p className="about-kicker">About StreamList</p>
        <h2>Plan your next watch session in one place.</h2>
        <p className="about-intro">
          StreamList helps you track what to watch, discover movies, and organize your subscription decisions.
        </p>
      </section>

      <section className="about-section">
        <h3>What You Can Do</h3>
        <div className="about-grid">
          <article className="about-card">
            <h4>Build Your Watch Queue</h4>
            <p>Add titles to your StreamList and mark them complete as you watch.</p>
          </article>
          <article className="about-card">
            <h4>Search Live Movie Data</h4>
            <p>Use the Movies page to search TMDB and add results directly into your list.</p>
          </article>
          <article className="about-card">
            <h4>Manage Subscriptions</h4>
            <p>Use the Cart page to estimate and review your monthly streaming costs.</p>
          </article>
        </div>
      </section>

      <section className="about-section">
        <h3>Quick Start</h3>
        <ol className="about-steps">
          <li>Add a few titles on the Home page.</li>
          <li>Open Movies and search for something new.</li>
          <li>Add or remove streaming plans in Cart.</li>
          <li>Install StreamList as a desktop app for faster access.</li>
        </ol>
      </section>

      <section className="about-note">
        <p>
          Data notes: movie search requires a configured TMDB API key. Your StreamList and cart are stored locally in
          your browser.
        </p>
      </section>
    </div>
  );
}

export default About;
