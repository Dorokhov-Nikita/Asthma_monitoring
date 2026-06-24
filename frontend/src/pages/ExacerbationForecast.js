import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/ExacerbationForecast.css';

// Додаємо бібліотеку для графіків
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Реєструємо необхідні компоненти для Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function ExacerbationForecast() {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [healthRecords, setHealthRecords] = useState([]);
  const [currentRecordIndex, setCurrentRecordIndex] = useState(0);
  const [forecastResult, setForecastResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [userData, setUserData] = useState(null);
  const [userRole, setUserRole] = useState('user');
  const [predictions, setPredictions] = useState([]);
  const [emptyRecordWarning, setEmptyRecordWarning] = useState(false);
  
  // Додаємо стани для метрик моделі
  const [modelMetrics, setModelMetrics] = useState(null);
  
  // Додаємо стан для відображення підказки стовпчика
  const [activeColumn, setActiveColumn] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Fetch health records and user data when component mounts
  useEffect(() => {
    fetchHealthRecords();
    fetchUserData();
    checkUserRole();
    
    // Fetch previous predictions
    fetchPreviousPredictions();
    
    // Якщо користувач адмін, завантажуємо метрики моделі
    if (userRole === 'admin') {
      fetchModelMetrics();
    }
    
    // Додаємо клас no-scroll для блокування горизонтального скролу
    document.body.classList.add('no-scroll');
    document.documentElement.classList.add('no-scroll');
    
    // Set up event handler for table container scrolling
    setupTableScrolling();
    
    // Видаляємо клас при розмонтуванні компонента
    return () => {
      document.body.classList.remove('no-scroll');
      document.documentElement.classList.remove('no-scroll');
      
      // Remove event handlers
      const tableContainer = document.querySelector('.record-table-container');
      if (tableContainer) {
        tableContainer.removeEventListener('scroll', handleTableScroll);
      }
    };
  }, []);
  
  // Додатковий ефект для завантаження метрик моделі, коли роль користувача оновлюється
  useEffect(() => {
    if (userRole === 'admin') {
      fetchModelMetrics();
    }
  }, [userRole]);
  
  // Update forecast result when records or predictions change
  useEffect(() => {
    if (predictions.length > 0 && healthRecords.length > 0) {
      // Find the current record's prediction
      const currentRecord = healthRecords[currentRecordIndex];
      if (currentRecord) {
        const matchingPrediction = predictions.find(p => p.record_id === currentRecord.id);
        if (matchingPrediction) {
          // Format the prediction data to match the forecastResult structure
          const predictionResult = {
            probability: matchingPrediction.risk_score,
            riskLevel: matchingPrediction.risk_level === 'Low' ? 'low' : 
                      matchingPrediction.risk_level === 'Medium' ? 'moderate' : 'high',
            criticalFeatures: matchingPrediction.critical_features,
            recommendations: generateRecommendations(
              matchingPrediction.risk_level === 'Low' ? 'low' : 
              matchingPrediction.risk_level === 'Medium' ? 'moderate' : 'high', 
              currentRecord
            ),
            predictionDate: new Date(matchingPrediction.prediction_date)
          };
          setForecastResult(predictionResult);
          return;
        }
      }
      
      // Clear forecast if no matching prediction
      setForecastResult(null);
    }
  }, [currentRecordIndex, predictions, healthRecords]);

  const fetchUserData = async () => {
    try {
      // Перевіряємо, чи переглядаємо як інший користувач
      const viewing_as_user_id = localStorage.getItem('viewing_as_user_id');
      const user_id = viewing_as_user_id || localStorage.getItem('user_id');
      
      if (!user_id) {
        navigate('/');
        return;
      }

      // Fetch user data (age, sex, smoking, allergies)
      const response = await fetch(`http://localhost:5000/api/user-data/${user_id}`);
      const data = await response.json();
      
      if (response.ok) {
        setUserData(data);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setError('Failed to load user profile data');
    }
  };

  const fetchPreviousPredictions = async () => {
    try {
      const viewing_as_user_id = localStorage.getItem('viewing_as_user_id');
      const user_id = viewing_as_user_id || localStorage.getItem('user_id');
      
      if (!user_id) {
        navigate('/');
        return;
      }
      
      const response = await fetch(`http://localhost:5000/api/predictions/${user_id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch predictions');
      }
      
      const data = await response.json();
      setPredictions(data);
    } catch (error) {
      console.error('Error fetching predictions:', error);
      // Don't set error message here - empty predictions is a normal state
    }
  };

  const fetchHealthRecords = async () => {
    setIsLoading(true);
    setError('');

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
        throw new Error('Failed to fetch records');
      }

      const data = await response.json();
      
      // Sort by date descending to get latest records first
      const sortedData = data.sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      );
      
      setHealthRecords(sortedData);
      setCurrentRecordIndex(0);
    } catch (error) {
      console.error('Error fetching health records:', error);
      setError('Failed to load health records');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to check user role
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
      // Default to 'user' role in case of error
      setUserRole('user');
    }
  };

  const handleForecast = () => {
    if (healthRecords.length === 0 || !userData) {
      setError('Cannot forecast: Missing health records or user profile data');
      setForecastResult(null);
      setEmptyRecordWarning(false);
      return;
    }
    
    // Check if the record is empty (all zeros)
    if (isEmptyRecord(healthRecords[currentRecordIndex])) {
      setEmptyRecordWarning(true);
      setForecastResult(null);
      return;
    }
    
    setIsLoading(true);
    setError('');
    setForecastResult(null);
    setEmptyRecordWarning(false);
    
    try {
      // Get the current record ID
      const currentRecord = healthRecords[currentRecordIndex];
      const recordId = currentRecord.id;
      const viewing_as_user_id = localStorage.getItem('viewing_as_user_id');
      const userId = viewing_as_user_id ? parseInt(viewing_as_user_id) : parseInt(localStorage.getItem('user_id'));
      
      if (!recordId || !userId) {
        setIsLoading(false);
        setError('Missing record ID or user ID for prediction');
        return;
      }
      
      // Call backend API for prediction
      fetch(`http://localhost:5000/api/predict-exacerbation/${userId}/${recordId}`)
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to get prediction from server');
          }
          return response.json();
        })
        .then(data => {
          // Process prediction results
          const probability = data.risk_score;
          let riskLevel = 'low';
          
          if (data.risk_level === 'Medium') {
            riskLevel = 'moderate';
          } else if (data.risk_level === 'High') {
            riskLevel = 'high';
          }
          
          // Generate recommendations based on risk level and health data
          const recommendations = generateRecommendations(riskLevel, healthRecords[currentRecordIndex]);
          
          // Create forecast result with recommendations and critical features
          const result = {
            probability,
            riskLevel,
            recommendations,
            criticalFeatures: data.critical_features,
            predictionDate: new Date(data.prediction_date)
          };
          
          setForecastResult(result);
          setIsLoading(false);
          
          // Update predictions list
          fetchPreviousPredictions();
        })
        .catch(error => {
          console.error('Error in forecast calculation:', error);
          setError('Failed to calculate forecast: ' + error.message);
          setIsLoading(false);
        });
    } catch (error) {
      console.error('Error in forecast handling:', error);
      setError('Error preparing forecast: ' + error.message);
      setIsLoading(false);
    }
  };

  // Generate personalized recommendations based on risk level and health data
  const generateRecommendations = (riskLevel, healthRecord) => {
    const recommendations = [];
    
    // Get personalized recommendations based on user data and risk level
    if (riskLevel === 'low') {
      recommendations.push('Continue your current treatment plan');
      recommendations.push('Monitor your symptoms regularly');
      
      // Add specific recommendations based on actual data
      if (healthRecord.cough > 0) {
        recommendations.push('Track your cough symptoms to ensure they don\'t worsen');
      }
      
      if (parseFloat(healthRecord.FEV1) < 3) {
        recommendations.push('Your lung function is good, but continue regular measurements');
      }
      
      if (parseInt(healthRecord.pulse) > 90) {
        recommendations.push('Your heart rate is slightly elevated - consider consulting with your physician');
      }
    } 
    else if (riskLevel === 'moderate') {
      recommendations.push('Be vigilant about your symptoms');
      recommendations.push('Ensure your rescue inhaler is always accessible');
      
      // Add specific recommendations based on actual data
      if (parseInt(healthRecord.cough) >= 2) {
        recommendations.push('Pay attention to your increased cough - contact your doctor if it worsens');
      }
      
      if (parseInt(healthRecord.nighttime_awakenings) > 0) {
        recommendations.push('Nighttime symptoms may indicate your asthma needs better control');
      }
      
      if (parseInt(healthRecord.breathlessness) > 0 || parseInt(healthRecord.wheezing) > 0) {
        recommendations.push('Your breathing symptoms suggest your treatment plan may need adjustment');
      }
      
      if (parseFloat(healthRecord.FEV1) < 2.5 || parseInt(healthRecord.PEF) < 350) {
        recommendations.push('Your lung function is below expected levels - consider consulting your doctor');
      }
    } 
    else { // high risk
      recommendations.push('Contact your healthcare provider as soon as possible');
      recommendations.push('Review and follow your asthma action plan for yellow/red zone');
      recommendations.push('Avoid asthma triggers and reduce physical exertion');
      
      // Add specific recommendations based on actual data
      if (parseFloat(healthRecord.FEV1) < 2 || parseInt(healthRecord.PEF) < 300) {
        recommendations.push('Your lung function values indicate significant restriction - medical attention is advised');
      }
      
      if (parseInt(healthRecord.cough) >= 3 || parseInt(healthRecord.breathlessness) >= 2) {
        recommendations.push('Your symptoms suggest an active exacerbation may be developing');
      }
      
      if (parseInt(healthRecord.nighttime_awakenings) >= 2) {
        recommendations.push('Frequent nighttime awakenings indicate poor asthma control');
      }
      
      if (parseInt(healthRecord.respiratory_rate) > 20 || parseInt(healthRecord.pulse) > 100) {
        recommendations.push('Your vital signs indicate increased stress - urgent medical consultation is recommended');
      }
    }
    
    // If using medication, add specific advice
    if (healthRecord.medicine && healthRecord.medicine !== 'None') {
      recommendations.push('Continue using your prescribed medications as directed');
    } else if (riskLevel !== 'low') {
      recommendations.push('You may need to discuss medication options with your healthcare provider');
    }
    
    return recommendations;
  };

  const handleNextRecord = () => {
    if (currentRecordIndex < healthRecords.length - 1) {
      setCurrentRecordIndex(currentRecordIndex + 1);
      setEmptyRecordWarning(false);
    }
  };

  const handlePreviousRecord = () => {
    if (currentRecordIndex > 0) {
      setCurrentRecordIndex(currentRecordIndex - 1);
      setEmptyRecordWarning(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString();
  };
  
  const formatDateTime = (dateTime) => {
    if (!dateTime) return '';
    const date = new Date(dateTime);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString();
  };

  const getRiskCardClass = (riskLevel) => {
    switch (riskLevel) {
      case 'low':
        return 'risk-card low-risk';
      case 'moderate':
        return 'risk-card moderate-risk';
      case 'high':
        return 'risk-card high-risk';
      default:
        return 'risk-card';
    }
  };
  
  const getRiskLevelColor = (riskLevel) => {
    switch (riskLevel) {
      case 'low':
        return '#4CAF50';
      case 'moderate':
        return '#ff9800';
      case 'high':
        return '#f44336';
      default:
        return '#2196F3';
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user_id');
    localStorage.removeItem('viewing_as_user_id');
    localStorage.removeItem('selected_user_id');
    navigate('/');
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

  // При розмонтуванні компоненту переконаємося, що усі класи видалені
  useEffect(() => {
    return () => {
      document.body.classList.remove('no-scroll');
      document.documentElement.classList.remove('no-scroll');
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

  const handleHome = () => {
    // Redirect to admin dashboard if user is admin, otherwise to regular dashboard
    const viewing_as_user_id = localStorage.getItem('viewing_as_user_id');
    
    if (viewing_as_user_id) {
      // If viewing as another user, return to admin dashboard
      localStorage.removeItem('viewing_as_user_id');
      navigate('/admin-dashboard');
    } else if (userRole === 'admin') {
      navigate('/admin-dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  // Function to fetch model training metrics
  const fetchModelMetrics = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/training-metrics');
      if (!response.ok) {
        throw new Error('Failed to fetch model metrics');
      }
      
      const data = await response.json();
      setModelMetrics(data);
    } catch (error) {
      console.error('Error fetching model metrics:', error);
    }
  };

  // Helper function to render model metrics
  const renderModelMetrics = () => {
    if (!modelMetrics || !modelMetrics.final_metrics) {
      return <p>No model metrics available.</p>;
    }

    const { final_metrics } = modelMetrics;
    
    return (
      <div className="model-metrics">
        <h3>Model Performance Metrics</h3>
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-title">Validation Accuracy</div>
            <div className="metric-value">{(final_metrics.val_accuracy * 100).toFixed(2)}%</div>
          </div>
          <div className="metric-card">
            <div className="metric-title">AUC</div>
            <div className="metric-value">{final_metrics.val_auc.toFixed(4)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-title">Precision</div>
            <div className="metric-value">{(final_metrics.precision_val * 100).toFixed(2)}%</div>
          </div>
          <div className="metric-card">
            <div className="metric-title">Recall</div>
            <div className="metric-value">{(final_metrics.recall_val * 100).toFixed(2)}%</div>
          </div>
          <div className="metric-card">
            <div className="metric-title">F1 Score</div>
            <div className="metric-value">{final_metrics.f1_score.toFixed(4)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-title">Validation Loss</div>
            <div className="metric-value">{final_metrics.val_loss.toFixed(4)}</div>
          </div>
        </div>
        
        {renderTrainingCharts()}
        
        {/* Додаємо SHAP візуалізацію */}
        <div className="shap-visualization">
          <h3>SHAP Feature Importance Analysis</h3>
          <p>
            SHAP values show how much each feature contributes to the prediction
            for individual instances. This summary plot shows the global feature importance and impact direction
            across the entire dataset.
          </p>
          <div className="shap-plot-container">
            <img 
              src="http://localhost:5000/api/model-plots/shap-summary" 
              alt="SHAP Summary Plot" 
              title="SHAP Values Summary Plot"
            />
          </div>
          <p>
            <strong>How to interpret:</strong> Features are ranked by importance from top to bottom. 
            Red points indicate higher feature values, while blue points represent lower values. 
            Points to the right show positive impact on the prediction (increasing risk), 
            and points to the left show negative impact (decreasing risk).
          </p>
        </div>
      </div>
    );
  };

  // Helper function to render training charts
  const renderTrainingCharts = () => {
    if (!modelMetrics || !modelMetrics.epoch_metrics || modelMetrics.epoch_metrics.length === 0) {
      return <p>No training history available.</p>;
    }

    const { epoch_metrics } = modelMetrics;
    
    // Prepare data for charts
    const epochs = epoch_metrics.map(metric => metric.epoch);
    
    const accuracyData = {
      labels: epochs,
      datasets: [
        {
          label: 'Training Accuracy',
          data: epoch_metrics.map(metric => metric.accuracy),
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
        },
        {
          label: 'Validation Accuracy',
          data: epoch_metrics.map(metric => metric.val_accuracy),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
        },
      ],
    };
    
    const lossData = {
      labels: epochs,
      datasets: [
        {
          label: 'Training Loss',
          data: epoch_metrics.map(metric => metric.loss),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
        },
        {
          label: 'Validation Loss',
          data: epoch_metrics.map(metric => metric.val_loss),
          borderColor: 'rgb(255, 159, 64)',
          backgroundColor: 'rgba(255, 159, 64, 0.5)',
        },
      ],
    };
    
    const aucData = {
      labels: epochs,
      datasets: [
        {
          label: 'Training AUC',
          data: epoch_metrics.map(metric => metric.auc),
          borderColor: 'rgb(153, 102, 255)',
          backgroundColor: 'rgba(153, 102, 255, 0.5)',
        },
        {
          label: 'Validation AUC',
          data: epoch_metrics.map(metric => metric.val_auc),
          borderColor: 'rgb(255, 205, 86)',
          backgroundColor: 'rgba(255, 205, 86, 0.5)',
        },
      ],
    };
    
    const chartOptions = {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
      },
      scales: {
        y: {
          beginAtZero: false,
        },
      },
    };
    
    return (
      <div className="training-charts">
        <h3>Training History</h3>
        
        <div className="chart-container">
          <h4>Accuracy</h4>
          <Line options={chartOptions} data={accuracyData} />
        </div>
        
        <div className="chart-container">
          <h4>Loss</h4>
          <Line options={chartOptions} data={lossData} />
        </div>
        
        <div className="chart-container">
          <h4>AUC</h4>
          <Line options={chartOptions} data={aucData} />
        </div>
      </div>
    );
  };

  // Function to set up scrolling behavior for the table
  const setupTableScrolling = () => {
    // Wait for component to render
    setTimeout(() => {
      const tableContainer = document.querySelector('.record-table-container');
      if (tableContainer) {
        tableContainer.addEventListener('scroll', handleTableScroll);
        
        // Ensure medicine column has proper width
        const medicineCells = document.querySelectorAll('.health-record-table td:last-child, .health-record-table th:last-child');
        medicineCells.forEach(cell => {
          if (window.innerWidth <= 768) {
            cell.style.wordWrap = 'break-word';
            cell.style.whiteSpace = 'normal';
          }
        });
      }
    }, 500);
  };
  
  // Prevent scroll propagation
  const handleTableScroll = (e) => {
    // Prevent the scroll event from bubbling up to parent elements
    e.stopPropagation();
  };

  // Check if a health record is empty (all values are zero or null)
  const isEmptyRecord = (record) => {
    if (!record) return true;
    
    // These are the numerical fields we want to check
    const numericFields = ['FEV1', 'FVC', 'PEF', 'respiratory_rate', 'pulse', 
                           'cough', 'breathlessness', 'wheezing', 
                           'chest_tightness', 'nighttime_awakenings'];
    
    // Check if all numeric fields are zero or null
    return numericFields.every(field => {
      const value = record[field];
      return value === 0 || value === null || value === undefined || value === '';
    });
  };

  // Функція для відображення підказки для стовпчика
  const handleColumnClick = (e, columnName) => {
    e.stopPropagation(); // Зупиняємо поширення події
    
    // Отримуємо позицію елемента для відображення підказки
    const rect = e.target.getBoundingClientRect();
    const x = rect.left;
    const y = rect.top - 30; // Позиціонуємо трохи вище заголовка
    
    setTooltipPosition({ x, y });
    setActiveColumn(columnName);
  };

  // Функція для приховування підказки при кліку за межами стовпчика
  const handleDocumentClick = () => {
    setActiveColumn(null);
  };

  // Додаємо і видаляємо обробник подій при монтуванні/розмонтуванні
  useEffect(() => {
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

  return (
    <div className={`exacerbation-forecast-container ${isSidebarOpen ? 'sidebar-open' : ''}`}>
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
            <h1>Asthma Exacerbation Risk Forecast</h1>
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
      
      <div className="exacerbation-content">        
        {error && <div className="error-message">{error}</div>}
        
        <div className="info-section">
          <h3>About Exacerbation Forecast</h3>
          <p>This tool helps predict your risk of asthma exacerbation based on your recorded health data. Our neural network model analyzes your symptoms, lung function measurements, and other metrics to calculate your exacerbation probability.</p>
          
          <div className="instructions">
            <h4>How to use:</h4>
            <ol>
              <li>Navigate through your health records using the Previous/Next buttons</li>
              <li>Review your health data in the table</li>
              <li>Click "Run Forecast" to generate a risk assessment</li>
              <li>Review your risk level, contributing factors, and personalized recommendations</li>
            </ol>
          </div>
          
          <p className="note">Note: This prediction is intended as a supportive tool and should not replace professional medical advice. Always consult your healthcare provider for medical decisions.</p>
        </div>
        
        <div className="record-navigation">
          {healthRecords.length > 0 && (
            <>
              <button 
                onClick={handlePreviousRecord}
                disabled={currentRecordIndex === 0 || isLoading}
                className="exacerbation-nav-button"
              >
                ← Previous Record
              </button>
              <span className="record-info">
                Record {currentRecordIndex + 1} of {healthRecords.length}
              </span>
              <button 
                onClick={handleNextRecord}
                disabled={currentRecordIndex === healthRecords.length - 1 || isLoading}
                className="exacerbation-nav-button"
              >
                Next Record →
              </button>
            </>
          )}
        </div>
        
        {healthRecords.length > 0 ? (
          <>
            <div className="record-table-container">
              <table className="health-record-table">
                <thead>
                  <tr>
                    <th onClick={(e) => handleColumnClick(e, 'Date')}>Date</th>
                    <th onClick={(e) => handleColumnClick(e, 'FEV1')}>FEV1</th>
                    <th onClick={(e) => handleColumnClick(e, 'FVC')}>FVC</th>
                    <th onClick={(e) => handleColumnClick(e, 'PEF')}>PEF</th>
                    <th onClick={(e) => handleColumnClick(e, 'Respiratory Rate')}>Respiratory Rate</th>
                    <th onClick={(e) => handleColumnClick(e, 'Pulse')}>Pulse</th>
                    <th onClick={(e) => handleColumnClick(e, 'Cough')}>Cough</th>
                    <th onClick={(e) => handleColumnClick(e, 'Breathlessness')}>Breathlessness</th>
                    <th onClick={(e) => handleColumnClick(e, 'Wheezing')}>Wheezing</th>
                    <th onClick={(e) => handleColumnClick(e, 'Chest Tightness')}>Chest Tightness</th>
                    <th onClick={(e) => handleColumnClick(e, 'Nighttime Awakenings')}>Nighttime Awakenings</th>
                    <th onClick={(e) => handleColumnClick(e, 'Medicine')}>Medicine</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{formatDate(healthRecords[currentRecordIndex]?.date)}</td>
                    <td>{healthRecords[currentRecordIndex]?.FEV1}</td>
                    <td>{healthRecords[currentRecordIndex]?.FVC}</td>
                    <td>{healthRecords[currentRecordIndex]?.PEF}</td>
                    <td>{healthRecords[currentRecordIndex]?.respiratory_rate}</td>
                    <td>{healthRecords[currentRecordIndex]?.pulse}</td>
                    <td>{healthRecords[currentRecordIndex]?.cough}</td>
                    <td>{healthRecords[currentRecordIndex]?.breathlessness}</td>
                    <td>{healthRecords[currentRecordIndex]?.wheezing}</td>
                    <td>{healthRecords[currentRecordIndex]?.chest_tightness}</td>
                    <td>{healthRecords[currentRecordIndex]?.nighttime_awakenings}</td>
                    <td>{healthRecords[currentRecordIndex]?.medicine}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div className="forecast-controls">
              <button 
                onClick={handleForecast} 
                disabled={isLoading || !healthRecords[currentRecordIndex] || (userRole === 'admin' && localStorage.getItem('viewing_as_user_id'))} 
                className="forecast-button"
              >
                {isLoading ? 'Processing...' : 'Run Forecast'}
              </button>
            </div>
            
            {emptyRecordWarning && (
              <div className="empty-record-warning">
                <p>This record contains all zeros or empty values and may not provide meaningful forecast results.</p>
                <Link to="/recording-indicators" className="empty-record-action">Enter Health Data</Link>
              </div>
            )}
            
            {forecastResult && (
              <div className="forecast-result">
                <div className={getRiskCardClass(forecastResult.riskLevel)}>
                  <div className="prediction-timestamp">
                    {forecastResult.predictionDate && 
                      `Prediction from: ${formatDateTime(forecastResult.predictionDate)}`}
                  </div>
                  
                  <h3 className="risk-title">
                    {forecastResult.riskLevel === 'low' && 'Low Risk of Asthma Exacerbation'}
                    {forecastResult.riskLevel === 'moderate' && 'Moderate Risk of Asthma Exacerbation'}
                    {forecastResult.riskLevel === 'high' && 'High Risk of Asthma Exacerbation'}
                  </h3>
                  
                  <div className="risk-probability">
                    <div className="probability-meter">
                      <div className="probability-label">Exacerbation Probability:</div>
                      <div className="probability-bar-container">
                        <div 
                          className="probability-bar" 
                          style={{
                            width: `${forecastResult.probability}%`,
                            backgroundColor: getRiskLevelColor(forecastResult.riskLevel)
                          }}
                        ></div>
                        <span className="probability-value">{forecastResult.probability.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <p className="risk-description">
                    Based on your health data and profile information, we've analyzed your risk of an asthma exacerbation.
                  </p>
                  
                  {forecastResult.criticalFeatures && (
                    <div className="critical-features">
                      <h4>5 Key Factors Influencing Risk:</h4>
                      <div className="feature-grid">
                        {Object.entries(forecastResult.criticalFeatures)
                          .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])) // Sort by absolute value of importance
                          .slice(0, 5) // Take only top 5 features
                          .map(([feature, value]) => (
                            <div key={feature} className="feature-card">
                              <div 
                                className="feature-icon"
                                style={{ 
                                  backgroundColor: getRiskLevelColor(forecastResult.riskLevel),
                                  opacity: Math.max(0.3, Math.min(0.9, Math.abs(value) * 10))
                                }}
                              >
                                {feature.charAt(0)}
                              </div>
                              <div className="feature-details">
                                <div className="feature-name">{feature.replace(/_/g, ' ')}</div>
                                <div className="feature-value">Impact: {(value * 100).toFixed(1)}%</div>
                                <div className="feature-influence">
                                  <div 
                                    className="influence-bar" 
                                    style={{
                                      width: `${Math.min(Math.abs(value * 100), 100)}%`,
                                      backgroundColor: getRiskLevelColor(forecastResult.riskLevel)
                                    }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="recommendations">
                    <h4>Recommendations:</h4>
                    <ul>
                      {forecastResult.recommendations.map((recommendation, index) => (
                        <li key={index}>{recommendation}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            
            <div className="forecast-actions">
              <div className="navigation-links">
                <Link to="/recording-indicators">Return to data entry</Link>
                <Link to="/graphs-of-changes">View performance graphs</Link>
              </div>
            </div>
            
            {/* Admin only model metrics section - відображається автоматично */}
            {userRole === 'admin' && (
              <div className="admin-model-info">
                <h3 className="admin-section-header">Model Information (Admin Only)</h3>
                {renderModelMetrics()}
              </div>
            )}
          </>
        ) : (
          <div className="no-records-message">
            <p>No health records available for forecasting.</p>
            <p>
              <Link to="/recording-indicators">Go to data entry</Link>
            </p>
          </div>
        )}
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

      {/* Відображення підказки назви стовпчика */}
      {activeColumn && (
        <div 
          className="column-tooltip"
          style={{
            position: 'fixed',
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '14px',
            zIndex: 9999,
            pointerEvents: 'none'
          }}
        >
          {activeColumn}
        </div>
      )}
    </div>
  );
}

export default ExacerbationForecast; 