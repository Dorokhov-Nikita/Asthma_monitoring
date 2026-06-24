import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import '../styles/GraphsOfChanges.css';

// Реєструємо компоненти Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function GraphsOfChanges() {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [healthData, setHealthData] = useState([]);
  const [selectedIndicators, setSelectedIndicators] = useState([]);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('user');
  const [isLoading, setIsLoading] = useState(false);

  const indicators = [
    { id: 'FEV1', label: 'FEV1', color: 'rgb(255, 99, 132)' },
    { id: 'FVC', label: 'FVC', color: 'rgb(54, 162, 235)' },
    { id: 'PEF', label: 'PEF', color: 'rgb(75, 192, 192)' },
    { id: 'respiratory_rate', label: 'Respiratory Rate', color: 'rgb(255, 159, 64)' },
    { id: 'pulse', label: 'Pulse', color: 'rgb(153, 102, 255)' },
    { id: 'cough', label: 'Cough', color: 'rgb(255, 99, 132)' },
    { id: 'breathlessness', label: 'Breathlessness', color: 'rgb(54, 162, 235)' },
    { id: 'wheezing', label: 'Wheezing', color: 'rgb(75, 192, 192)' },
    { id: 'chest_tightness', label: 'Chest Tightness', color: 'rgb(255, 159, 64)' },
    { id: 'nighttime_awakenings', label: 'Nighttime Awakenings', color: 'rgb(153, 102, 255)' }
  ];

  // Check user role
  const checkUserRole = async () => {
    try {
      const user_id = localStorage.getItem('user_id');
      if (!user_id) {
        navigate('/');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/user-role/${user_id}`);
      if (!response.ok) {
        throw new Error('Failed to verify user role');
      }
      
      const data = await response.json();
      setUserRole(data.role || 'user');
    } catch (error) {
      console.error('Error checking user role:', error);
      setUserRole('user');
    }
  };

  const fetchHealthRecords = async () => {
    setIsLoading(true);
    try {
      // Перевіряємо, чи переглядаємо як інший користувач
      const viewing_as_user_id = localStorage.getItem('viewing_as_user_id');
      const user_id = viewing_as_user_id || localStorage.getItem('user_id');
      
      if (!user_id) {
        navigate('/');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/health-records/${user_id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch health records');
      }
      const data = await response.json();
      setHealthData(data.sort((a, b) => new Date(a.date) - new Date(b.date)));
    } catch (error) {
      console.error('Error fetching health records:', error);
      setError('Failed to load health records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthRecords();
    checkUserRole();
  }, []);

  const handleIndicatorChange = (indicatorId) => {
    setSelectedIndicators(prev => {
      const isSelected = prev.includes(indicatorId);
      if (isSelected) {
        return prev.filter(id => id !== indicatorId);
      } else {
        return [...prev, indicatorId];
      }
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('user_id');
    localStorage.removeItem('viewing_as_user_id');
    localStorage.removeItem('selected_user_id');
    navigate('/');
  };

  const handleHome = () => {
    const viewing_as_user_id = localStorage.getItem('viewing_as_user_id');
    
    if (viewing_as_user_id) {
      // Якщо переглядаємо як інший користувач, повертаємося на адмін-панель
      localStorage.removeItem('viewing_as_user_id');
      navigate('/admin-dashboard');
    } else if (userRole === 'admin') {
      navigate('/admin-dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
    // Додавання/видалення класу до body для блокування прокрутки і правильного відображення сайдбару
    if (!isSidebarOpen) {
      document.body.classList.add('sidebar-open');
      document.documentElement.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
      document.documentElement.classList.remove('sidebar-open');
    }
  };

  // При розмонтуванні компоненту переконаємося, що клас видалений
  useEffect(() => {
    return () => {
      document.body.classList.remove('sidebar-open');
      document.documentElement.classList.remove('sidebar-open');
    };
  }, []);

  // Функція для закриття сайдбара при кліку на фон
  const closeSidebar = () => {
    if (isSidebarOpen) {
      setIsSidebarOpen(false);
      document.body.classList.remove('sidebar-open');
      document.documentElement.classList.remove('sidebar-open');
    }
  };

  const getChartData = () => {
    const labels = healthData.map(record => {
      const date = new Date(record.date);
      return date.toLocaleDateString();
    });

    const datasets = selectedIndicators.map(indicatorId => {
      const indicator = indicators.find(i => i.id === indicatorId);
      return {
        label: indicator.label,
        data: healthData.map(record => record[indicatorId] || 0),
        borderColor: indicator.color,
        backgroundColor: indicator.color,
        tension: 0.1,
        pointRadius: 5,
        pointHoverRadius: 8
      };
    });

    return {
      labels,
      datasets
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          padding: 20,
          usePointStyle: true
        }
      },
      title: {
        display: true,
        text: 'Health Indicators Over Time',
        font: {
          size: 16
        },
        padding: 20
      },
      tooltip: {
        mode: 'index',
        intersect: false
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Date'
        },
        grid: {
          display: false
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Value'
        },
        beginAtZero: true
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  return (
    <div className={`graphs-container ${isSidebarOpen ? 'sidebar-open' : ''}`}>
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
          <h1>Graphs of Changes</h1>
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

      <div className="graphs-content">
        {error && <div className="error-message">{error}</div>}
        
        <div className="info-section">
          <h3>About Graphs of Changes</h3>
          <p>This tool visualizes trends in your health indicators over time, helping you monitor your asthma condition and identify patterns.</p>
          
          <div className="instructions">
            <h4>How to use:</h4>
            <ol>
              <li>Select one or more health indicators from the checkboxes below</li>
              <li>The graph will automatically update to show your selected indicators</li>
              <li>Hover over data points to see exact values</li>
              <li>Compare different indicators to identify potential correlations</li>
            </ol>
          </div>
        </div>

        <div className="indicators-selection">
          <h3>Select Indicators:</h3>
          <div className="indicators-grid">
            {indicators.map((indicator, index) => (
              <div 
                key={indicator.id} 
                className={`indicator-checkbox ${selectedIndicators.includes(indicator.id) ? 'selected' : ''}`} 
                onClick={() => handleIndicatorChange(indicator.id)}
              >
                <input
                  type="checkbox"
                  id={`checkbox-${indicator.id}`}
                  checked={selectedIndicators.includes(indicator.id)}
                  onChange={() => {}} // Handled by parent div onClick
                />
                <span>{indicator.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="graph-container">
          {selectedIndicators.length > 0 ? (
            <Line data={getChartData()} options={chartOptions} height={400} />
          ) : (
            <div className="no-indicators">
              Please select at least one indicator to display the graph
            </div>
          )}
        </div>
      </div>

      <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Menu</h2>
        </div>
        <nav className="sidebar-nav">
          <button onClick={handleHome}>
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

export default GraphsOfChanges; 