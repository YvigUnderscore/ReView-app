import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

const Setup = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateField = (name, value) => {
      let errorMsg = '';
      if (name === 'password') {
          if (!value) errorMsg = 'Password is required';
          else if (value.length < 8) errorMsg = 'Password must be at least 8 characters';
          else if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) errorMsg = 'Password must contain at least one letter and one number';
      }
      if (name === 'email') {
          if (!value) errorMsg = 'Email is required';
          else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errorMsg = 'Please enter a valid email address';
      }
      setFieldErrors(prev => ({ ...prev, [name]: errorMsg }));
  };

  const handleBlur = (e) => {
      validateField(e.target.name, e.target.value);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (fieldErrors[e.target.name]) {
         setFieldErrors(prev => ({ ...prev, [e.target.name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (fieldErrors.password || fieldErrors.email || !formData.password || formData.password.length < 8) {
        validateField('email', formData.email);
        validateField('password', formData.password);
        return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Setup failed');
      }

      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-xl mx-auto mb-4">
            R
          </div>
          <h1 className="text-2xl font-bold">Welcome to ReView</h1>
          <p className="text-muted-foreground mt-2">
            Create your admin account to get started.
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Full Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full bg-input border border-border rounded-md px-3 py-2 focus:ring-1 focus:ring-primary focus:outline-none"
              required
              autoComplete="name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              onBlur={handleBlur}
              className={`w-full bg-input border ${fieldErrors.email ? 'border-destructive' : 'border-border'} rounded-md px-3 py-2 focus:ring-1 focus:ring-primary focus:outline-none`}
              required
              autoComplete="username"
            />
            {fieldErrors.email && <p className="text-xs text-destructive mt-1">{fieldErrors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full bg-input border ${fieldErrors.password ? 'border-destructive' : 'border-border'} rounded-md px-3 py-2 pr-10 focus:ring-1 focus:ring-primary focus:outline-none`}
                  required
                  autoComplete="new-password"
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>
            {fieldErrors.password && <p className="text-xs text-destructive mt-1">{fieldErrors.password}</p>}
            {!fieldErrors.password && <p className="text-xs text-muted-foreground mt-1">At least 8 characters, 1 letter, 1 number</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-2 rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Create Admin Account'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Setup;
