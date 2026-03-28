import React, { useState } from 'react';

function StreamList() {
  const [inputValue, setInputValue] = useState('');
  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) {
      return;
    }

    const newItem = {
      id: Date.now(),
      text: trimmedValue,
      completed: false,
    };

    setItems((prevItems) => [newItem, ...prevItems]);
    setInputValue('');
  };

  const toggleComplete = (id) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const deleteItem = (id) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditValue('');
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditValue(item.text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveEdit = (id) => {
    const trimmedValue = editValue.trim();
    if (!trimmedValue) {
      return;
    }

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, text: trimmedValue } : item
      )
    );
    setEditingId(null);
    setEditValue('');
  };

  const totalItems = items.length;
  const completedItems = items.filter((item) => item.completed).length;

  return (
    <div className="page-container">
      <h2>StreamList</h2>
      <p>Add streaming services, then edit, complete, or remove them below.</p>
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

      <div className="list-header">
        <p>{totalItems} total</p>
        <p>{completedItems} completed</p>
      </div>

      {items.length === 0 ? (
        <p className="empty-state">No entries yet. Add your first service above.</p>
      ) : (
        <ul className="stream-items">
          {items.map((item) => (
            <li key={item.id} className={`stream-item ${item.completed ? 'is-complete' : ''}`}>
              {editingId === item.id ? (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="edit-input"
                  aria-label={`Edit ${item.text}`}
                />
              ) : (
                <span className="item-text">{item.text}</span>
              )}

              <div className="item-actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => toggleComplete(item.id)}
                  title={item.completed ? 'Mark as incomplete' : 'Mark as complete'}
                >
                  <span className="material-symbols-outlined">
                    {item.completed ? 'undo' : 'check_circle'}
                  </span>
                </button>

                {editingId === item.id ? (
                  <>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => saveEdit(item.id)}
                      title="Save"
                      disabled={!editValue.trim()}
                    >
                      <span className="material-symbols-outlined">save</span>
                    </button>
                    <button type="button" className="icon-button" onClick={cancelEdit} title="Cancel">
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => startEdit(item)}
                    title="Edit"
                  >
                    <span className="material-symbols-outlined">edit</span>
                  </button>
                )}

                <button
                  type="button"
                  className="icon-button danger"
                  onClick={() => deleteItem(item.id)}
                  title="Delete"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default StreamList;
