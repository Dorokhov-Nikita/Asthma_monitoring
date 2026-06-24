import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);

  // Функція для оновлення класів sidebar
  const updateSidebarClasses = (isOpen) => {
    if (isOpen) {
      document.body.classList.add('sidebar-open');
      document.documentElement.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
      document.documentElement.classList.remove('sidebar-open');
    }
  };

  useEffect(() => {
    // Перевірка чи користувач увійшов в систему
    const user_id = localStorage.getItem('user_id');
    if (!user_id) {
      navigate('/');
      return;
    }

    // Завантаження даних користувача
    const fetchUserData = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/user-data/${user_id}`);
        if (!response.ok) throw new Error('Failed to fetch user data');
        
        const data = await response.json();
        if (data.name) setUserName(data.name);
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
    setTimeout(() => setShowAnimation(true), 100);
    return () => updateSidebarClasses(false);
  }, [navigate]);

  // Застосовуємо класи при зміні стану sidebar
  useEffect(() => {
    updateSidebarClasses(isSidebarOpen);
  }, [isSidebarOpen]);

  const handleLogout = () => {
    localStorage.removeItem('user_id');
    localStorage.removeItem('viewing_as_user_id');
    localStorage.removeItem('selected_user_id');
    navigate('/');
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className={`dashboard-container ${isSidebarOpen ? 'sidebar-open' : ''}`}>
      <div className="animated-bg"></div>
      
      {/* Top Bar */}
      <div className="top-bar">
        <button 
          className="menu-toggle-btn" 
          onClick={toggleSidebar}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        <div className="top-center">
          <h1>Asthma Monitoring <span className="title-accent">System</span></h1>
          <p className="welcome-text">Welcome, {userName}!</p>
        </div>

        <div className="nav-buttons">
          <button onClick={() => navigate('/profile')} className="profile-button">
            Profile
          </button>
          <button onClick={handleLogout} className="logout-button">
             Logout
          </button>
        </div>
      </div>

      {/* Дублікат кнопки меню поверх сайдбару */}
      <button 
        className="sidebar-menu-btn" 
        onClick={toggleSidebar}
        aria-label="Toggle menu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* Dashboard Content */}
      <div className={`dashboard-content ${showAnimation ? 'show' : ''}`}>
        {/* App Information Section */}
        <div className="app-info-section">
          <h2>About Asthma Monitoring App</h2>
          
          <div className="info-card">
            <div className="info-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" stroke="#2b5876" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="#2b5876" strokeWidth="2"/>
              </svg>
            </div>
            <div className="info-content">
              <h3>Purpose</h3>
              <p>
                The Asthma Monitoring App is designed to help individuals with asthma track their condition, 
                predict potential exacerbations, and maintain better control over their respiratory health. 
                By combining personal health data with advanced machine learning algorithms, we provide timely 
                insights and recommendations to improve quality of life.
              </p>
            </div>
          </div>
          
          <div className="info-card">
            <div className="info-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="#4caf50" strokeWidth="2"/>
                <path d="M19.4 15C19.1277 15.8031 19.2294 16.6835 19.68 17.4C20.1478 18.0731 20.3189 18.9037 20.1546 19.7C19.9903 20.4963 19.5053 21.1879 18.8 21.6C18.1223 22.0179 17.306 22.1451 16.5308 21.9508C15.7556 21.7564 15.0948 21.2571 14.7 20.58C14.2604 19.8314 13.5575 19.277 12.7306 19.0238C11.9037 18.7706 11.0125 18.8345 10.2294 19.2021C9.44632 19.5698 8.83379 20.2178 8.4996 21.0137C8.16541 21.8096 8.13912 22.7007 8.42999 23.51" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 9.5C2 11.433 3.567 13 5.5 13C6.11725 13 6.70356 12.8334 7.21028 12.5404C7.71701 12.2474 8.12632 11.8329 8.39175 11.341" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 9.5C22 11.433 20.433 13 18.5 13C17.8828 13 17.2964 12.8334 16.7897 12.5404C16.283 12.2474 15.8737 11.8329 15.6083 11.341" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15.6083 4.659C15.8737 4.1671 16.283 3.75265 16.7897 3.45961C17.2964 3.16657 17.8828 3 18.5 3C20.433 3 22 4.567 22 6.5" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8.39175 4.659C8.12632 4.1671 7.71701 3.75265 7.21028 3.45961C6.70356 3.16657 6.11725 3 5.5 3C3.567 3 2 4.567 2 6.5" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="info-content">
              <h3>Key Features</h3>
              <ul>
                <li>
                  <strong>Health Data Recording</strong> - Track lung function metrics (FEV1, FVC, PEF), 
                  symptoms, and vital signs in one place
                </li>
                <li>
                  <strong>Exacerbation Risk Prediction</strong> - Get personalized risk assessments based on 
                  your health data using neural network technology
                </li>
                <li>
                  <strong>Medication Management</strong> - Monitor your medication intake and adherence
                </li>
                <li>
                  <strong>Trend Analysis</strong> - Visualize your health progress through interactive graphs
                </li>
                <li>
                  <strong>Personalized Recommendations</strong> - Receive tailored advice based on your 
                  specific condition and risk level
                </li>
              </ul>
            </div>
          </div>
          
          <div className="info-card">
            <div className="info-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 16V8C20.9996 7.64928 20.9071 7.30481 20.7315 7.00116C20.556 6.69752 20.3037 6.44536 20 6.27L13 2.27C12.696 2.09446 12.3511 2.00205 12 2.00205C11.6489 2.00205 11.304 2.09446 11 2.27L4 6.27C3.69626 6.44536 3.44398 6.69752 3.26846 7.00116C3.09294 7.30481 3.00036 7.64928 3 8V16C3.00036 16.3507 3.09294 16.6952 3.26846 16.9988C3.44398 17.3025 3.69626 17.5546 4 17.73L11 21.73C11.304 21.9055 11.6489 21.9979 12 21.9979C12.3511 21.9979 12.696 21.9055 13 21.73L20 17.73C20.3037 17.5546 20.556 17.3025 20.7315 16.9988C20.9071 16.6952 20.9996 16.3507 21 16Z" stroke="#2196f3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3.27 7L12 12L20.73 7" stroke="#2196f3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 22V12" stroke="#2196f3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7.5 4.21L16.5 9.79" stroke="#2196f3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="info-content">
              <h3>How to Use</h3>
              <ol>
                <li>
                  <strong>Recording Indicators</strong> - Regularly input your health measurements and symptoms
                </li>
                <li>
                  <strong>Check Your Risk</strong> - Visit the Exacerbation Forecast page to get a personalized 
                  risk assessment
                </li>
                <li>
                  <strong>Track Your Progress</strong> - Use the Graphs of Changes to monitor improvements over time
                </li>
                <li>
                  <strong>Manage Medications</strong> - Log and track your prescribed medications in the Medication Diary
                </li>
                <li>
                  <strong>Stay Consistent</strong> - For best results, record your data at regular intervals
                </li>
              </ol>
            </div>
          </div>
          
          <div className="info-card">
            <div className="info-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 12H18L15 21L9 3L6 12H2" stroke="#ff9800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="info-content">
              <h3>Technology</h3>
              <p>
                Our app uses an advanced neural network to predict asthma exacerbation risk. The model processes multiple respiratory parameters including FEV1, FVC, PEF, respiratory rate, along with symptom severity scores (cough, breathlessness, wheezing). Trained on extensive clinical data, our neural network identifies patterns that precede exacerbations, providing early warnings days before clinical symptoms worsen. The system automatically generates personalized recommendations based on your specific health indicators and medical history.
              </p>
            </div>
          </div>
        </div>
        
        {/* Quick Access Section */}
        <div className="quick-access">
          <h2>Quick Access</h2>
          <div className="quick-access-buttons">
            <button 
              className="quick-access-button record-button" 
              onClick={() => navigate('/recording-indicators')}
            >
              <div className="button-content">
                <div className="button-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 8V12L15 15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span>Record Health Data</span>
              </div>
            </button>
            <button 
              className="quick-access-button forecast-button" 
              onClick={() => navigate('/exacerbation-forecast')}
            >
              <div className="button-content">
                <div className="button-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 12H18L15 21L9 3L6 12H2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span>Check Exacerbation Risk</span>
              </div>
            </button>
            <button 
              className="quick-access-button medication-button" 
              onClick={() => navigate('/medication-diary')}
            >
              <div className="button-content">
                <div className="button-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 5H5C3.89543 5 3 5.89543 3 7V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V7C21 5.89543 20.1046 5 19 5Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 3V7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8 3V7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M3 11H21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 16H12.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span>Medication Diary</span>
              </div>
            </button>
            <button 
              className="quick-access-button graph-button" 
              onClick={() => navigate('/graphs-of-changes')}
            >
              <div className="button-content">
                <div className="button-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 20V10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 20V4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M6 20V14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span>View Health Trends</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Menu</h2>
        </div>
        <nav className="sidebar-nav">
          <button onClick={() => navigate('/dashboard')}>
            <span className="menu-icon">🏠</span> Home
          </button>
          <button onClick={() => navigate('/recording-indicators')}>
            <span className="menu-icon">📊</span> Recording Indicators
          </button>
          <button onClick={() => navigate('/exacerbation-forecast')}>
            <span className="menu-icon">🔮</span> Exacerbation Forecast
          </button>
          <button onClick={() => navigate('/graphs-of-changes')}>
            <span className="menu-icon">📈</span> Graphs of Changes
          </button>
          <button onClick={() => navigate('/medication-diary')}>
            <span className="menu-icon">💊</span> Medication Diary
          </button>
        </nav>
      </div>

      {/* Backdrop for mobile */}
      <div className="sidebar-backdrop" onClick={closeSidebar}></div>
    </div>
  );
}

export default Dashboard;