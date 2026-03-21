import React, { useState } from 'react';

function StreamList() {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('User input:', inputValue);
    setInputValue('');
  };

  return (
    <div className="page-container">
      <h2>StreamList</h2>
      <p>Enter a streaming service and check the console:</p>
      <form onSubmit={handleSubmit} className="input-group">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter service name..."
          className="streamlist-input"
        />
        <button type="submit" className="add-button">Submit</button>
      </form>
    </div>
  );
}

export default StreamList;
