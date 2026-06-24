import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/RecordingIndicators.css';

function RecordingIndicators() {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [indicatorsData, setIndicatorsData] = useState([]);
  const [error, setError] = useState('');
  const [localData, setLocalData] = useState({});
  const [userRole, setUserRole] = useState('user');
  const [isViewingAsUser, setIsViewingAsUser] = useState(false);
  const [success, setSuccess] = useState('');
  
  // Додаємо стан для відображення підказки стовпчика
  const [activeColumn, setActiveColumn] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Перевіряємо, чи переглядаємо як інший користувач
    const viewing_as_user_id = localStorage.getItem('viewing_as_user_id');
    const user_id = viewing_as_user_id || localStorage.getItem('user_id');
    
    // Встановлюємо прапорець перегляду як інший користувач
    setIsViewingAsUser(!!viewing_as_user_id);
    
    if (!user_id) {
      navigate('/');
      return;
    }

    fetchRecords();
    checkUserRole();
  }, [navigate]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchRecords = async () => {
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
      
      // Ensure dates are properly formatted when received
      const processedData = data.map(record => ({
        ...record,
        date: record.date ? formatDateForDisplay(record.date) : getCurrentDate()
      }));
      
      setIndicatorsData(processedData);
    } catch (error) {
      console.error('Error fetching records:', error);
      setError('Failed to load records');
      setTimeout(() => setError(''), 2000);
    }
  };

  // Get current date in YYYY-MM-DD format
  const getCurrentDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  // Format date specifically for display in the input field
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return getCurrentDate();
    
    try {
      // Handle different date formats
      let date;
      if (dateString.includes('T')) {
        // ISO format
        date = new Date(dateString);
      } else if (dateString.includes('-')) {
        // YYYY-MM-DD format
        const [year, month, day] = dateString.split('-');
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else if (dateString.includes('/')) {
        // MM/DD/YYYY format
        const [month, day, year] = dateString.split('/');
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        // Try direct parsing as a fallback
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        console.warn(`Invalid date detected: ${dateString}, using current date instead`);
        return getCurrentDate();
      }
      
      return date.toISOString().split('T')[0];
    } catch (e) {
      console.error(`Error formatting date: ${dateString}`, e);
      return getCurrentDate();
    }
  };

  const handleInputChange = (recordId, field, value) => {
    // Якщо переглядаємо як інший користувач, не дозволяємо зміни
    if (isViewingAsUser) return;
    
    // Handle constraint validation for symptom fields
    const symptomFields = ['cough', 'breathlessness', 'wheezing', 'chest_tightness', 'nighttime_awakenings'];
    
    if (symptomFields.includes(field) && value !== '') {
      // For symptom fields, constrain values between 0 and 5
      let parsedValue = parseFloat(value);
      
      if (isNaN(parsedValue)) {
        // Allow empty string for now
        value = '';
      } else if (parsedValue < 0) {
        parsedValue = 0;
        value = parsedValue.toString();
      } else if (parsedValue > 5) {
        parsedValue = 5;
        value = parsedValue.toString();
      } else {
        // For inputs that should be integers, round the value
        if (Number.isFinite(parsedValue)) {
          parsedValue = Math.round(parsedValue);
          value = parsedValue.toString();
        }
      }
    }
    
    setLocalData(prev => ({
      ...prev,
      [recordId]: {
        ...prev[recordId],
        [field]: value
      }
    }));
  };

  const handleInputBlur = async (recordId, field, value) => {
    // Якщо переглядаємо як інший користувач, не дозволяємо зміни
    if (isViewingAsUser) return;
    
    const floatFields = ['FEV1', 'FVC'];
    const integerFields = ['PEF', 'respiratory_rate', 'pulse', 'cough', 
      'breathlessness', 'wheezing', 'chest_tightness', 'nighttime_awakenings'];
    const symptomFields = ['cough', 'breathlessness', 'wheezing', 'chest_tightness', 'nighttime_awakenings'];
    
    let processedValue = value;
    
    // Special handling for date field
    if (field === 'date') {
      if (!value) {
        const existingRecord = indicatorsData.find(record => record.id === recordId);
        processedValue = existingRecord?.date || getCurrentDate();
        setLocalData(prev => ({
          ...prev,
          [recordId]: {
            ...prev[recordId],
            date: processedValue
          }
        }));
      } else {
        // Validate date format
        try {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            setError('Invalid date format');
            
            // Revert to existing date
            const existingRecord = indicatorsData.find(record => record.id === recordId);
            processedValue = existingRecord?.date || getCurrentDate();
            
            // Update local state
            setLocalData(prev => ({
              ...prev,
              [recordId]: {
                ...prev[recordId],
                date: processedValue
              }
            }));
            
            setTimeout(() => setError(''), 2000);
            return;
          }
          processedValue = value; // Use the validated date
        } catch (e) {
          console.error('Date validation error:', e);
          setError('Invalid date format');
          setTimeout(() => setError(''), 2000);
          return;
        }
      }
    } else if (field === 'medicine') {
      // Якщо medicine порожній, встановлюємо None
      processedValue = value || 'None';
    } else if (value === '') {
      // If field is empty on blur, set to 0
      processedValue = 0;
      
      // Update local state to show 0
      setLocalData(prev => ({
        ...prev,
        [recordId]: {
          ...prev[recordId],
          [field]: '0'
        }
      }));
    } else if (floatFields.includes(field)) {
      // Handle floating point with 2 decimal places
      try {
        processedValue = parseFloat(parseFloat(value).toFixed(2));
        if (isNaN(processedValue)) {
          throw new Error(`Invalid floating point value for ${field}`);
        }
      } catch (e) {
        setError(`Invalid floating point value for ${field}`);
        setTimeout(() => setError(''), 2000);
        return;
      }
    } else if (integerFields.includes(field)) {
      // Convert to number and round to integer for integer fields
      try {
        processedValue = Math.round(parseFloat(value));
        if (isNaN(processedValue)) {
          throw new Error(`Invalid numeric value for ${field}`);
        }
        
        // For symptom fields, constrain between 0 and 5
        if (symptomFields.includes(field)) {
          if (processedValue < 0) processedValue = 0;
          if (processedValue > 5) processedValue = 5;
        }
      } catch (e) {
        setError(`Invalid numeric value for ${field}`);
        setTimeout(() => setError(''), 2000);
        return;
      }
      
      // Update local state to show the rounded integer
      setLocalData(prev => ({
        ...prev,
        [recordId]: {
          ...prev[recordId],
          [field]: processedValue.toString()
        }
      }));
    }

    const currentRecord = indicatorsData.find(record => record.id === recordId);
    if (!currentRecord) {
      // Не відображаємо помилку, просто виходимо з функції
      return;
    }

    // Check if the value actually changed to avoid unnecessary updates
    if (currentRecord[field] === processedValue) {
      return; // No change, no need to update
    }

    const updatedRecord = {
      ...currentRecord,
      [field]: processedValue
    };

    try {
      const response = await fetch(`http://localhost:5000/api/update-health-record/${recordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedRecord),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update record');
      }

      // Update the local state first to prevent UI flicker
      setIndicatorsData(prevData => 
        prevData.map(record => 
          record.id === recordId ? {...record, [field]: processedValue} : record
        )
      );
      
      // Silent success - no message display
      
      // We'll only silently refresh data from server with no UI feedback
      await fetchRecords();
    } catch (err) {
      console.error('Error updating record:', err);
      setError(err.message || 'Failed to update record');
      setTimeout(() => setError(''), 2000);
    }
  };

  const handleAddNewRow = async () => {
    // Якщо переглядаємо як інший користувач, не дозволяємо додавати рядки
    if (isViewingAsUser) {
      setError("Cannot add new records when viewing as another user");
      return;
    }

    try {
      // Отримуємо ID користувача
      const viewing_as_user_id = localStorage.getItem('viewing_as_user_id');
      const user_id = viewing_as_user_id || localStorage.getItem('user_id');
      
      if (!user_id) {
        navigate('/');
        return;
      }

      // Створюємо новий запис
      const currentDate = getCurrentDate();
      
      const requestBody = {
        user_id: user_id,
        date: currentDate,
        FEV1: 0,
        FVC: 0,
        PEF: 0,
        respiratory_rate: 0,
        pulse: 0,
        cough: 0,
        breathlessness: 0,
        wheezing: 0,
        chest_tightness: 0,
        nighttime_awakenings: 0,
        medicine: 'None'
      };

      // Відправляємо запит на сервер
      const response = await fetch('http://localhost:5000/api/health-records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error('Failed to add new record');
      }

      const newRecord = await response.json();
      
      // Ensure date is properly formatted
      newRecord.date = formatDateForDisplay(newRecord.date);
      
      // Оновлюємо стан для відображення нового рядка
      setIndicatorsData(prevData => [...prevData, newRecord]);
    } catch (error) {
      console.error('Error adding new record:', error);
      setError('Failed to add new record');
      setTimeout(() => setError(''), 3000);
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

  const handleHome = () => {
    // Redirect to admin dashboard if user is admin, otherwise to regular dashboard
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

  // Helper to display value in input field - show empty string instead of 0
  const displayValue = (recordId, field, defaultValue) => {
    const localValue = localData[recordId]?.[field];
    
    // If we have a local value, use it
    if (localValue !== undefined) {
      // Return empty string if local value is empty
      return localValue;
    }
    
    // For default values from the server, convert zeros to empty string for display
    if (defaultValue === 0 || defaultValue === '0' || defaultValue === 0.0) {
      return '';
    }
    
    return defaultValue ?? '';
  };

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

  const handleDeleteRow = async (id) => {
    // Якщо переглядаємо як інший користувач, не дозволяємо видалення
    if (isViewingAsUser) return;
    
    try {
      const response = await fetch(`http://localhost:5000/api/health-records/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        let errorMessage = "Error deleting record.";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          console.error("Error parsing error response:", parseError);
        }
        
        throw new Error(errorMessage);
      }
      
      // Пробуємо обробити відповідь в залежності від типу
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          // Якщо відповідь - JSON, обробляємо його
          await response.json();
        }
      } catch (jsonError) {
        // У випадку помилки обробки JSON, просто ігноруємо і продовжуємо
        console.log("Note: Server didn't return valid JSON on successful delete");
      }
      
      // Успішне видалення - оновлюємо UI
      setIndicatorsData(prevData => prevData.filter(record => record.id !== id));
      
      // Clear any local data for this record
      if (localData[id]) {
        const newLocalData = { ...localData };
        delete newLocalData[id];
        setLocalData(newLocalData);
      }
    } catch (error) {
      console.error("Error deleting record:", error);
      setError(error.message || "Error deleting record. Please try again.");
    }
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
    <div className={`recording-indicators-container ${isSidebarOpen ? 'sidebar-open' : ''}`}>
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
          <h1>Recording Indicators</h1>
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
      
      <div className="record-content">
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        
        <div className="info-section">
          <h3>About Recording Indicators</h3>
          <p>This tool allows you to record and track your asthma health indicators over time. Your recorded measurements and symptoms are essential for accurate exacerbation risk forecasting and trend analysis.</p>
          
          <div className="instructions">
            <h4>How to use:</h4>
            <ol>
              <li>Enter your health data for each day, including lung function measurements (FEV1, FVC, PEF), vital signs, and symptom severity scores (0-5)</li>
              <li>Select your medication from the dropdown list</li>
              <li>Use the "Add New Row" button to record data for a new day</li>
              <li>Click the delete (❌) button to remove a record if needed</li>
            </ol>
          </div>
        </div>
        
        <div className="table-container">
          <table className="indicators-table">
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
                <th onClick={(e) => handleColumnClick(e, 'Actions')}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {indicatorsData.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="date"
                      value={localData[row.id]?.date !== undefined ? localData[row.id]?.date : row.date}
                      onChange={(e) => handleInputChange(row.id, 'date', e.target.value)}
                      onBlur={(e) => handleInputBlur(row.id, 'date', e.target.value)}
                      disabled={isViewingAsUser}
                      className={isViewingAsUser ? 'view-only' : ''}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={displayValue(row.id, 'FEV1', row.FEV1)}
                      onChange={(e) => handleInputChange(row.id, 'FEV1', e.target.value)}
                      onBlur={(e) => handleInputBlur(row.id, 'FEV1', e.target.value)}
                      disabled={isViewingAsUser}
                      className={isViewingAsUser ? 'view-only' : ''}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={displayValue(row.id, 'FVC', row.FVC)}
                      onChange={(e) => handleInputChange(row.id, 'FVC', e.target.value)}
                      onBlur={(e) => handleInputBlur(row.id, 'FVC', e.target.value)}
                      disabled={isViewingAsUser}
                      className={isViewingAsUser ? 'view-only' : ''}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={displayValue(row.id, 'PEF', row.PEF)}
                      onChange={(e) => handleInputChange(row.id, 'PEF', e.target.value)}
                      onBlur={(e) => handleInputBlur(row.id, 'PEF', e.target.value)}
                      disabled={isViewingAsUser}
                      className={isViewingAsUser ? 'view-only' : ''}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={displayValue(row.id, 'respiratory_rate', row.respiratory_rate)}
                      onChange={(e) => handleInputChange(row.id, 'respiratory_rate', e.target.value)}
                      onBlur={(e) => handleInputBlur(row.id, 'respiratory_rate', e.target.value)}
                      disabled={isViewingAsUser}
                      className={isViewingAsUser ? 'view-only' : ''}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={displayValue(row.id, 'pulse', row.pulse)}
                      onChange={(e) => handleInputChange(row.id, 'pulse', e.target.value)}
                      onBlur={(e) => handleInputBlur(row.id, 'pulse', e.target.value)}
                      disabled={isViewingAsUser}
                      className={isViewingAsUser ? 'view-only' : ''}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      value={displayValue(row.id, 'cough', row.cough)}
                      onChange={(e) => handleInputChange(row.id, 'cough', e.target.value)}
                      onBlur={(e) => handleInputBlur(row.id, 'cough', e.target.value)}
                      disabled={isViewingAsUser}
                      className={isViewingAsUser ? 'view-only' : ''}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      value={displayValue(row.id, 'breathlessness', row.breathlessness)}
                      onChange={(e) => handleInputChange(row.id, 'breathlessness', e.target.value)}
                      onBlur={(e) => handleInputBlur(row.id, 'breathlessness', e.target.value)}
                      disabled={isViewingAsUser}
                      className={isViewingAsUser ? 'view-only' : ''}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      value={displayValue(row.id, 'wheezing', row.wheezing)}
                      onChange={(e) => handleInputChange(row.id, 'wheezing', e.target.value)}
                      onBlur={(e) => handleInputBlur(row.id, 'wheezing', e.target.value)}
                      disabled={isViewingAsUser}
                      className={isViewingAsUser ? 'view-only' : ''}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      value={displayValue(row.id, 'chest_tightness', row.chest_tightness)}
                      onChange={(e) => handleInputChange(row.id, 'chest_tightness', e.target.value)}
                      onBlur={(e) => handleInputBlur(row.id, 'chest_tightness', e.target.value)}
                      disabled={isViewingAsUser}
                      className={isViewingAsUser ? 'view-only' : ''}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      value={displayValue(row.id, 'nighttime_awakenings', row.nighttime_awakenings)}
                      onChange={(e) => handleInputChange(row.id, 'nighttime_awakenings', e.target.value)}
                      onBlur={(e) => handleInputBlur(row.id, 'nighttime_awakenings', e.target.value)}
                      disabled={isViewingAsUser}
                      className={isViewingAsUser ? 'view-only' : ''}
                    />
                  </td>
                  <td>
                    <select
                      value={
                        (localData[row.id]?.medicine === 'None' ? '' : localData[row.id]?.medicine) ??
                        (row.medicine === 'None' ? '' : row.medicine) ??
                        ''
                      }
                      onChange={(e) => handleInputChange(row.id, 'medicine', e.target.value)}
                      onBlur={(e) => handleInputBlur(row.id, 'medicine', e.target.value)}
                      disabled={isViewingAsUser}
                      className={isViewingAsUser ? 'view-only' : ''}
                    >
                      <option value="">Select medicine</option>
                      <option value="Budesonide">Budesonide</option>
                      <option value="Fluticasone">Fluticasone</option>
                      <option value="Formoterol">Formoterol</option>
                      <option value="Ipratropium">Ipratropium</option>
                      <option value="Salbutamol">Salbutamol</option>
                    </select>
                  </td>
                  <td className="action-cell">
                    <button
                      className="delete-row-button"
                      onClick={() => handleDeleteRow(row.id)}
                      disabled={isViewingAsUser}
                      title="Delete record"
                    >
                      ❌
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button 
          onClick={handleAddNewRow} 
          className="add-row-button"
          disabled={isViewingAsUser}
        >
          Add New Row
        </button>
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

export default RecordingIndicators; 