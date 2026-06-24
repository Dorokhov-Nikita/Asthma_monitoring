import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/MedicationDiary.css';

function MedicationDiary() {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [medications, setMedications] = useState([]);
  const [medicationSchedule, setMedicationSchedule] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userRole, setUserRole] = useState('user');
  const [isViewingAsUser, setIsViewingAsUser] = useState(false);

  // Form data for adding/editing medications
  const [formData, setFormData] = useState({
    medication_id: '',
    dose: '',
    time_slot: 'morning',
    comment: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Predefined medication list (in a real app, this would come from API)
  const availableMedications = [
    { id: 1, name: 'Salbutamol', type: 'Bronchodilator' },
    { id: 2, name: 'Fluticasone', type: 'Corticosteroid' },
    { id: 3, name: 'Ipratropium', type: 'Bronchodilator' },
    { id: 4, name: 'Budesonide', type: 'Corticosteroid' },
    { id: 5, name: 'Cetirizine', type: 'Antihistamine' },
    { id: 6, name: 'Formoterol', type: 'Bronchodilator' },
    { id: 7, name: 'Loratadine', type: 'Antihistamine' }
  ];

  // Backend API URL
  const API_URL = 'http://localhost:5000/api';

  // Fetch user's medication data from the database
  const fetchMedicationData = async () => {
    setIsLoading(true);
    try {
      // Перевіряємо, чи переглядаємо як інший користувач
      const viewing_as_user_id = localStorage.getItem('viewing_as_user_id');
      const user_id = viewing_as_user_id || localStorage.getItem('user_id');
      
      if (!user_id) {
        navigate('/');
        return;
      }

      const response = await fetch(`${API_URL}/medications?user_id=${user_id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch medication data');
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Convert the received array into an object grouped by date
        const scheduleByDate = {};
        
        data.medications.forEach(med => {
          // Convert date to YYYY-MM-DD format
          const dateStr = new Date(med.date).toISOString().split('T')[0];
          
          if (!scheduleByDate[dateStr]) {
            scheduleByDate[dateStr] = [];
          }
          
          scheduleByDate[dateStr].push({
            id: med.id,
            medication_id: med.medication ? availableMedications.find(m => m.name === med.medication)?.id || 0 : 0,
            name: med.medication,
            dose: med.dose,
            time_slot: med.time_slot,
            taken: med.taken === 1,
            comment: med.comment || ''
          });
        });
        
        setMedicationSchedule(scheduleByDate);
      } else {
        setError(data.message || 'Failed to load medication data');
      }
    } catch (err) {
      console.error('Error fetching medication data:', err);
      setError('Failed to load medication data. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize data on component mount
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

    setMedications(availableMedications);
    fetchMedicationData();
    checkUserRole();
    
    // Set current date as selected date by default
    setSelectedDate(new Date());
  }, [navigate]);

  // Check user role
  const checkUserRole = async () => {
    try {
      const user_id = localStorage.getItem('user_id');
      if (!user_id) {
        navigate('/');
        return;
      }

      const response = await fetch(`${API_URL}/user-role/${user_id}`);
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

  // Calendar navigation functions
  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Get first day of the month
    const firstDay = new Date(year, month, 1);
    // Get last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    const daysArray = [];
    let currentDay = new Date(firstDay);
    
    // Adjust the starting day of week to Monday (1) instead of Sunday (0)
    // Sunday will be represented as 7 instead of 0
    const getAdjustedDay = (date) => {
      const day = date.getDay();
      return day === 0 ? 7 : day; // Sunday = 7, Monday = 1, ..., Saturday = 6
    };
    
    // Add days from previous month to align with correct weekday (starting with Monday)
    const startingDayOfWeek = getAdjustedDay(firstDay);
    if (startingDayOfWeek !== 1) { // If not Monday
      const lastDayPrevMonth = new Date(year, month, 0);
      const daysInPrevMonth = lastDayPrevMonth.getDate();
      
      for (let i = startingDayOfWeek - 2; i >= 0; i--) {
        const day = new Date(year, month - 1, daysInPrevMonth - i);
        const dateString = day.toISOString().split('T')[0];
        daysArray.push({
          date: day,
          isCurrentMonth: false,
          hasSchedule: medicationSchedule[dateString] ? true : false,
          medications: medicationSchedule[dateString] || []
        });
      }
    }
    
    // Add days of current month
    while (currentDay <= lastDay) {
      const dateString = currentDay.toISOString().split('T')[0];
      daysArray.push({
        date: new Date(currentDay),
        isCurrentMonth: true,
        hasSchedule: medicationSchedule[dateString] ? true : false,
        medications: medicationSchedule[dateString] || []
      });
      currentDay.setDate(currentDay.getDate() + 1);
    }
    
    // Add days from next month to complete the grid (if needed)
    const remainingDays = 42 - daysArray.length; // 6 rows of 7 days
    if (remainingDays > 0) {
      for (let i = 1; i <= remainingDays; i++) {
        const day = new Date(year, month + 1, i);
        const dateString = day.toISOString().split('T')[0];
        daysArray.push({
          date: day,
          isCurrentMonth: false,
          hasSchedule: medicationSchedule[dateString] ? true : false,
          medications: medicationSchedule[dateString] || []
        });
      }
    }
    
    return daysArray;
  };

  // Open modal for adding/editing medication
  const openAddMedicationModal = (date) => {
    // Якщо переглядаємо як інший користувач, не дозволяємо додавати ліки
    if (isViewingAsUser) return;
    
    setSelectedDate(date);
    setFormData({...formData, date: date.toISOString().split('T')[0]});
    setModalMode('add');
    setIsModalOpen(true);
  };

  const openEditMedicationModal = (medication) => {
    // Якщо переглядаємо як інший користувач, не дозволяємо редагувати ліки
    if (isViewingAsUser) return;
    
    setSelectedMedication(medication);
    setFormData({
      medication_id: medication.medication_id,
      dose: medication.dose,
      time_slot: medication.time_slot,
      comment: medication.comment || '',
      date: selectedDate.toISOString().split('T')[0]
    });
    setModalMode('edit');
    setIsModalOpen(true);
  };

  // Close modal
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedMedication(null);
    setFormData({
      medication_id: '',
      dose: '',
      time_slot: 'morning',
      comment: '',
      date: new Date().toISOString().split('T')[0]
    });
    setError('');
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  // Handle form submission for adding/editing medication
  const handleSubmitMedication = async (e) => {
    e.preventDefault();
    
    if (!formData.medication_id || !formData.dose) {
      setError('Please select a medication and specify the dose');
      return;
    }

    setIsLoading(true);
    // Перевіряємо, чи переглядаємо як інший користувач
    const viewing_as_user_id = localStorage.getItem('viewing_as_user_id');
    const user_id = viewing_as_user_id || localStorage.getItem('user_id');
    
    if (!user_id) {
      navigate('/');
      return;
    }
    
    const selectedMedicationInfo = medications.find(med => med.id === parseInt(formData.medication_id));
    
    try {
      if (modalMode === 'add') {
        // Send request to add new medication
        const response = await fetch(`${API_URL}/medications`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: parseInt(user_id),
            medication: selectedMedicationInfo.name,
            dose: formData.dose,
            time_slot: formData.time_slot,
            date: formData.date,
            taken: 0, // Not taken by default
            comment: formData.comment || ''
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          // Update local state with new medication
          await fetchMedicationData(); // Refresh data from server
        } else {
          setError(result.message || 'Failed to add medication');
        }
      } else if (modalMode === 'edit' && selectedMedication) {
        // Send request to update existing medication
        const response = await fetch(`${API_URL}/medications/${selectedMedication.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            medication: selectedMedicationInfo.name,
            dose: formData.dose,
            time_slot: formData.time_slot,
            comment: formData.comment || ''
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          // Update local state with edited medication
          await fetchMedicationData(); // Refresh data from server
        } else {
          setError(result.message || 'Failed to update medication');
        }
      }
    } catch (err) {
      console.error('Error managing medications:', err);
      setError('Failed to save changes. Please try again later.');
    } finally {
      setIsLoading(false);
      closeModal();
    }
  };

  // Delete medication
  const handleDeleteMedication = async () => {
    if (!selectedMedication) return;
    
    setIsLoading(true);
    
    try {
      // Send request to delete medication
      const response = await fetch(`${API_URL}/medications/${selectedMedication.id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Update local state after deletion
        await fetchMedicationData(); // Refresh data from server
      } else {
        setError(result.message || 'Failed to delete medication');
      }
    } catch (err) {
      console.error('Error deleting medication:', err);
      setError('Failed to delete medication. Please try again later.');
    } finally {
      setIsLoading(false);
      closeModal();
    }
  };

  // Toggle medication as taken/not taken
  const toggleMedicationTaken = async (medicationId) => {
    // Якщо переглядаємо як інший користувач, не дозволяємо відмічати ліки
    if (isViewingAsUser) return;
    
    if (!selectedDate) return;
    
    const dateKey = selectedDate.toISOString().split('T')[0];
    const medication = medicationSchedule[dateKey]?.find(med => med.id === medicationId);
    
    if (!medication) return;
    
    setIsLoading(true);
    
    try {
      // Send request to update medication taken status
      const response = await fetch(`${API_URL}/medications/${medicationId}/toggle-taken`, {
        method: 'PUT'
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Update local state with new taken status
        await fetchMedicationData(); // Refresh data from server
      } else {
        setError(result.message || 'Failed to update medication status');
      }
    } catch (err) {
      console.error('Error updating medication status:', err);
      setError('Failed to update medication status. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // Select a date to view its scheduled medications
  const handleDateClick = (day) => {
    setSelectedDate(day.date);
    // Clear error messages when changing dates
    setError('');
  };

  // Calculate adherence percentage for the current month
  const calculateAdherence = () => {
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    let totalMedications = 0;
    let takenMedications = 0;
    
    Object.entries(medicationSchedule).forEach(([dateStr, meds]) => {
      const scheduleDate = new Date(dateStr);
      
      if (scheduleDate.getMonth() === currentMonth && scheduleDate.getFullYear() === currentYear) {
        meds.forEach(med => {
          totalMedications++;
          if (med.taken) takenMedications++;
        });
      }
    });
    
    if (totalMedications === 0) return 0;
    return Math.round((takenMedications / totalMedications) * 100);
  };

  // Get the month name
  const getMonthName = () => {
    return currentDate.toLocaleString('en-US', { month: 'long' });
  };

  // Get scheduled medications for selected date
  const getScheduledMedications = () => {
    if (!selectedDate) return [];
    
    const dateKey = selectedDate.toISOString().split('T')[0];
    return medicationSchedule[dateKey] || [];
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

  // Відображаємо індикатор завантаження під час виконання API запитів
  if (isLoading) {
    return (
      <div className="medication-diary-container">
        <div className="loading-indicator">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`medication-diary-container ${isSidebarOpen ? 'sidebar-open' : ''}`}>
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
          <h1>Medication Diary</h1>
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
      
      <div className="medic-content">
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="info-section">
          <h3>About Medication Diary</h3>
          <p>This tool helps you track and manage your asthma medications. The calendar view allows you to schedule your medications and record whether you've taken them as prescribed.</p>
          
          <div className="instructions">
            <h4>How to use:</h4>
            <ol>
              <li>Navigate through months using the Previous/Next buttons</li>
              <li>Click on a date to view or schedule medications for that day</li>
              <li>Use "Add Medication" to schedule a new medication</li>
              <li>Mark medications as "Taken" when you take them</li>
              <li>Edit or delete medications as needed</li>
            </ol>
          </div>
        </div>
        
        <div className="adherence-stats">
          <div className="adherence-card">
            <h3>Monthly Adherence</h3>
            <div className="adherence-percentage">
              <span className="percentage-value">{calculateAdherence()}%</span>
              <span className="percentage-label">medications taken</span>
            </div>
          </div>
        </div>
        
        <div className="calendar-section">
          <div className="calendar-header">
            <button className="medic-nav-button" onClick={previousMonth}>
              ← Previous
            </button>
            <h3>{getMonthName()} {currentDate.getFullYear()}</h3>
            <button className="medic-nav-button" onClick={nextMonth}>
              Next →
            </button>
          </div>
          
          <div className="calendar-grid">
            <div className="calendar-weekdays">
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
              <div>Sun</div>
            </div>
            
            <div className="calendar-days">
              {generateCalendarDays().map((day, index) => (
                <div 
                  key={index} 
                  className={`calendar-day ${!day.isCurrentMonth ? 'other-month' : ''} 
                    ${selectedDate && day.date.toDateString() === selectedDate.toDateString() ? 'selected' : ''}
                    ${day.hasSchedule ? 'has-medications' : ''}`}
                  onClick={() => handleDateClick(day)}
                >
                  <span className="day-number">{day.date.getDate()}</span>
                  {day.medications && day.medications.length > 0 && (
                    <div className="medication-indicators">
                      {day.medications.map((med, medIndex) => (
                        <div 
                          key={medIndex} 
                          className={`medication-indicator ${med.taken ? 'taken' : 'not-taken'}`}
                          title={`${med.name} ${med.dose} - ${med.taken ? 'Taken' : 'Not taken'}`}
                        ></div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {selectedDate && (
          <div className="schedule-view">
            <div className="schedule-header">
              <h3>
                Medication Schedule for {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </h3>
              <button 
                className="add-medication-button" 
                onClick={() => openAddMedicationModal(selectedDate)}
                disabled={isViewingAsUser}
              >
                Add Medication
              </button>
            </div>
            
            <div className="schedule-content">
              {getScheduledMedications().length > 0 ? (
                <div className="medications-list">
                  {getScheduledMedications().map((medication) => (
                    <div key={medication.id} className={`medication-item ${medication.taken ? 'taken' : 'not-taken'}`}>
                      <div className="medication-info">
                        <h4>{medication.name}</h4>
                        <div className="medication-details">
                          <span className="medication-dose">{medication.dose}</span>
                          <span className="medication-time">
                            {medication.time_slot === 'morning' ? '🌅 Morning' : 
                             medication.time_slot === 'afternoon' ? '☀️ Afternoon' : '🌙 Evening'}
                          </span>
                        </div>
                        {medication.comment && <p className="medication-comment">{medication.comment}</p>}
                      </div>
                      
                      <div className="medication-actions">
                        <button 
                          className={`taken-button ${medication.taken ? 'taken' : ''}`}
                          onClick={() => toggleMedicationTaken(medication.id)}
                          disabled={isViewingAsUser}
                        >
                          {medication.taken ? 'Taken ✓' : 'Mark as Taken'}
                        </button>
                        <button 
                          className="edit-button" 
                          onClick={() => openEditMedicationModal(medication)}
                          disabled={isViewingAsUser}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-medications">
                  <p>No medications scheduled for this day.</p>
                  {!isViewingAsUser && (
                    <p>Click 'Add Medication' to schedule a medication.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Medication Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="medication-modal">
            <div className="modal-header">
              <h3>{modalMode === 'add' ? 'Add New Medication' : 'Edit Medication'}</h3>
              <button className="close-modal" onClick={closeModal}>×</button>
            </div>
            
            <form onSubmit={handleSubmitMedication}>
              <div className="medic-form-group">
                <label>Medication</label>
                <select 
                  name="medication_id"
                  value={formData.medication_id}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select a medication</option>
                  {medications.map(med => (
                    <option key={med.id} value={med.id}>
                      {med.name} ({med.type})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="medic-form-group">
                <label>Dose</label>
                <input 
                  type="text"
                  name="dose"
                  value={formData.dose}
                  onChange={handleInputChange}
                  placeholder="e.g. 100 mcg, 10 mg"
                  required
                />
              </div>
              
              <div className="medic-form-group">
                <label>Time of Day</label>
                <select 
                  name="time_slot"
                  value={formData.time_slot}
                  onChange={handleInputChange}
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                </select>
              </div>
              
              <div className="medic-form-group">
                <label>Comments</label>
                <textarea 
                  name="comment"
                  value={formData.comment}
                  onChange={handleInputChange}
                  placeholder="Add any notes or special instructions"
                ></textarea>
              </div>
              
              <div className="modal-actions">
                {modalMode === 'edit' && (
                  <button 
                    type="button" 
                    className="delete-button" 
                    onClick={handleDeleteMedication}
                  >
                    Delete Medication
                  </button>
                )}
                <div className="modal-actions-right">
                  <button type="button" className="cancel-button" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="save-button">
                    {modalMode === 'add' ? 'Add to Schedule' : 'Update Schedule'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

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

export default MedicationDiary;