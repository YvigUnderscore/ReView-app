import React, { useState } from 'react';

const ClientLogin = ({ onLogin }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onLogin(name.trim());
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-foreground mb-6 text-center">Welcome to Review</h1>
        <p className="text-muted-foreground mb-6 text-center">
          Please enter your name to access the review.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
              Your Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
              placeholder="John Doe"
              required
              autoComplete="name"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 transition-colors font-medium"
          >
            Continue to Review
          </button>
        </form>
      </div>
    </div>
  );
};

export default ClientLogin;
