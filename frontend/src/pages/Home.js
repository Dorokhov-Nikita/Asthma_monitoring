import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Home.css';

function Home() {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      <div className="center-frame">
        <h1>Welcome to the Asthma Monitoring App</h1>
        <div className="button-container">
          <button 
            className="signup-button"
            onClick={() => navigate('/signup')}
          >
            Sign Up
          </button>
          <button 
            className="login-button"
            onClick={() => navigate('/login')}
          >
            Login
          </button>
        </div>
      </div>
    </div>
  );
}

export default Home; 