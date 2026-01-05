import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!token) {
      setError('Invalid registration link.');
      setLoading(false);
      return;
    }

    // Validate token
    fetch(`/api/invites/${token}`)
      .then(res => {
         if (!res.ok) throw new Error('Invalid or expired invite');
         return res.json();
      })
      .then(data => {
         setEmail(data.email || ''); // If email was bound
         setRole(data.role);
         setLoading(false);
      })
      .catch(err => {
         setError(err.message);
         setLoading(false);
      });
  }, [token]);

  const validateField = (name, value) => {
      let errorMsg = '';
      if (name === 'password') {
          if (!value) errorMsg = 'Password is required';
          else if (value.length < 8) errorMsg = 'Password must be at least 8 characters';
          else if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) errorMsg = 'Password must contain at least one letter and one number';
      }
      setFieldErrors(prev => ({ ...prev, [name]: errorMsg }));
  };

  const handleBlur = (e) => {
      validateField(e.target.name, e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (fieldErrors.password || !password || password.length < 8) {
        validateField('password', password);
        return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, password })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Registration failed');

      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading && !email) { // Initial loading
      return <div className="h-screen flex items-center justify-center">Verifying invite...</div>;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border p-8 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center">Complete Registration</h1>

        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {!error && (
          <form onSubmit={handleSubmit} className="space-y-4">
             <div>
               <label className="block text-sm font-medium mb-1">Email</label>
               <input
                 type="email"
                 value={email}
                 disabled={!!email} // Disable if email came from invite
                 onChange={e => setEmail(e.target.value)}
                 className="w-full bg-muted border border-border rounded p-2 text-muted-foreground cursor-not-allowed"
                 autoComplete="username"
               />
               <p className="text-xs text-muted-foreground mt-1">Email is linked to your invitation.</p>
             </div>

             <div>
               <label className="block text-sm font-medium mb-1">Full Name</label>
               <input
                 type="text"
                 required
                 value={name}
                 onChange={e => setName(e.target.value)}
                 className="w-full bg-background border border-border rounded p-2"
                 placeholder="John Doe"
                 autoComplete="name"
               />
             </div>

             <div>
               <label className="block text-sm font-medium mb-1">Password</label>
               <div className="relative">
                   <input
                     type={showPassword ? "text" : "password"}
                     name="password"
                     required
                     value={password}
                     onChange={e => {
                         setPassword(e.target.value);
                         if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }));
                     }}
                     onBlur={handleBlur}
                     className={`w-full bg-background border ${fieldErrors.password ? 'border-destructive' : 'border-border'} rounded p-2 pr-10`}
                     placeholder="••••••••"
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
               className="w-full bg-primary text-primary-foreground py-2 rounded font-medium hover:bg-primary/90 mt-2"
             >
               {loading ? 'Registering...' : 'Create Account'}
             </button>
          </form>
        )}

        {error && (
           <button onClick={() => navigate('/login')} className="w-full mt-4 text-sm text-primary hover:underline">
              Back to Login
           </button>
        )}
      </div>
    </div>
  );
};

export default Register;
