import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/Login.css';

function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validatePassword = (password) => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[a-zA-Z]/.test(password)) {
      return 'Password must contain at least one letter';
    }
    if (!/\d/.test(password)) {
      return 'Password must contain at least one number';
    }
    return '';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'password') {
      const validationError = validatePassword(value);
      setPasswordError(validationError);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate password
    const validationError = validatePassword(formData.password);
    if (validationError) {
      setPasswordError(validationError);
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }
      
      // Очищаємо всі змінні авторизації перед збереженням нового user_id
      localStorage.removeItem('viewing_as_user_id');
      localStorage.removeItem('selected_user_id');
      
      localStorage.setItem('user_id', data.user_id);
      
      // Перевіряємо роль користувача
      if (data.role === 'admin') {
        navigate('/admin-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Login</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="login-form-group">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder=" "
            />
            <label htmlFor="email">Email</label>
          </div>
          <div className="login-form-group">
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder=" "
            />
            <label htmlFor="password">Password</label>
            {passwordError && <div className="password-requirements error-message">{passwordError}</div>}
          </div>
          <div className="password-requirements">
            Password must:
            <ul>
              <li>Be at least 8 characters long</li>
              <li>Contain at least one letter</li>
              <li>Contain at least one number</li>
            </ul>
          </div>
          <button type="submit" className="login-button">
            Login
          </button>
          <div className="signup-link">
            Don't have an account? <Link to="/signup">Register here</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;  
