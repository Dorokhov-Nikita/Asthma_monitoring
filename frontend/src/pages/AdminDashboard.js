import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/AdminDashboard.css';

function AdminDashboard() {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [statistics, setStatistics] = useState({
    totalUsers: 0,
    medicationRecords: 0,
    healthRecords: 0
  });
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // API URL
  const API_URL = 'http://localhost:5000/api';

  useEffect(() => {
    // Check if user is logged in and is admin
    const user_id = localStorage.getItem('user_id');
    if (!user_id) {
      navigate('/');
      return;
    }

    // Verify admin role
    verifyAdminRole(user_id);
    
    // Fetch admin dashboard data
    fetchDashboardData();
    
    // Відновлюємо вибраного користувача при поверненні на сторінку
    const storedSelectedUserId = localStorage.getItem('selected_user_id');
    if (storedSelectedUserId) {
      fetchSelectedUserData(storedSelectedUserId);
    }
  }, [navigate]);

  // Отримуємо дані вибраного користувача для відновлення стану
  const fetchSelectedUserData = async (userId) => {
    try {
      // Fetch all users first if not already loaded
      if (users.length === 0) {
        await fetchDashboardData();
      }
      
      // Find user in the users array
      const foundUser = users.find(user => user.id === parseInt(userId));
      
      // If user found in the already loaded users
      if (foundUser) {
        setSelectedUser(foundUser);
        return;
      }
      
      // If users are loaded but selected user not found (fallback)
      const response = await fetch(`${API_URL}/user-data/${userId}`);
      if (response.ok) {
        const userData = await response.json();
        const user = {
          id: parseInt(userId),
          name: userData.name,
          email: userData.email,
          role: userData.role
        };
        setSelectedUser(user);
      } else {
        // Clear selected user if not found
        localStorage.removeItem('selected_user_id');
      }
    } catch (err) {
      console.error('Error fetching selected user data:', err);
      localStorage.removeItem('selected_user_id');
    }
  };

  const verifyAdminRole = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/user-role/${userId}`);
      if (!response.ok) {
        throw new Error('Failed to verify admin role');
      }
      
      const data = await response.json();
      if (!data.role || data.role !== 'admin') {
        // Redirect non-admin users to regular dashboard
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Error verifying admin role:', err);
      setError('Failed to verify admin permissions');
      navigate('/dashboard');
    }
  };

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch system statistics
      const statsResponse = await fetch(`${API_URL}/admin/statistics`);
      if (!statsResponse.ok) {
        throw new Error('Failed to fetch system statistics');
      }
      const statsData = await statsResponse.json();
      setStatistics(statsData);

      // Fetch all users
      const usersResponse = await fetch(`${API_URL}/admin/recent-users`);
      if (!usersResponse.ok) {
        throw new Error('Failed to fetch users data');
      }
      const usersData = await usersResponse.json();
      setUsers(usersData);
      
      // Якщо є збережений ID вибраного користувача і ще не було встановлено вибраного користувача
      const storedSelectedUserId = localStorage.getItem('selected_user_id');
      if (storedSelectedUserId && !selectedUser) {
        const foundUser = usersData.find(user => user.id === parseInt(storedSelectedUserId));
        if (foundUser) {
          setSelectedUser(foundUser);
        }
      }

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user_id');
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

  const selectUser = (user) => {
    setSelectedUser(user);
    localStorage.setItem('selected_user_id', user.id);
  };
  
  const deselectUser = () => {
    setSelectedUser(null);
    localStorage.removeItem('selected_user_id');
    localStorage.removeItem('viewing_as_user_id');
  };

  const navigateAsUser = (path) => {
    if (selectedUser) {
      localStorage.setItem('viewing_as_user_id', selectedUser.id);
      navigate(path);
    } else {
      setError('Please select a user first');
    }
  };
  
  const handleProfileClick = () => {
    if (selectedUser) {
      // Встановлюємо viewing_as_user_id для відображення профілю вибраного користувача
      localStorage.setItem('viewing_as_user_id', selectedUser.id);
      navigate('/profile');
    }
  };

  if (isLoading) {
    return (
      <div className="admin-dashboard-container">
        <div className="loading-indicator">
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`admin-dashboard-container ${isSidebarOpen ? 'sidebar-open' : ''}`}>
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
          <h1>Asthma Monitoring - Admin Dashboard</h1>
        </div>
        <div className="nav-buttons">
          <button onClick={handleProfileClick} className="profile-button">
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

      <div className="admin-content">
        {error && <div className="error-message">{error}</div>}
        
        <div className="admin-header">
          <h2>System Overview</h2>
          <button onClick={fetchDashboardData} className="refresh-button">
            Refresh Data
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Users</h3>
            <p className="stat-value">{statistics.totalUsers}</p>
          </div>
          <div className="stat-card">
            <h3>Medication Records</h3>
            <p className="stat-value">{statistics.medicationRecords}</p>
          </div>
          <div className="stat-card">
            <h3>Health Records</h3>
            <p className="stat-value">{statistics.healthRecords}</p>
          </div>
        </div>

        <div className="admin-section">
          <h2>User Management</h2>
          
          {selectedUser && (
            <div className="selected-user-info">
              <h3>Selected User: {selectedUser.name || selectedUser.email}</h3>
              <p>You are viewing as this user. Use the sidebar to navigate to different pages.</p>
              <button onClick={deselectUser} className="deselect-button">
                Deselect User
              </button>
            </div>
          )}
          
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Sex</th>
                  <th>Role</th>
                  <th>Last Login</th>
                  <th>Records</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr 
                    key={user.id} 
                    className={`
                      ${selectedUser && selectedUser.id === user.id ? 'selected-row' : ''}
                      ${user.role === 'admin' ? 'admin-row' : ''}
                    `}
                  >
                    <td>{user.id}</td>
                    <td title={user.email}>{user.email}</td>
                    <td title={user.name || 'Not set'}>{user.name || 'Not set'}</td>
                    <td>{user.age || 'Not set'}</td>
                    <td>{user.sex || 'Not set'}</td>
                    <td>{user.role}</td>
                    <td title={user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}>
                      {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                    </td>
                    <td>{user.records_count}</td>
                    <td>
                      {user.role !== 'admin' && (
                        <button 
                          onClick={() => selectUser(user)} 
                          className="select-user-button"
                          disabled={selectedUser && selectedUser.id === user.id}
                        >
                          {selectedUser && selectedUser.id === user.id ? 'Selected' : 'Select'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan="9" className="no-data">No user data available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Menu</h2>
        </div>
        <nav className="sidebar-nav">
          <button onClick={() => navigate('/admin-dashboard')} className="active">
            <span className="menu-icon">🏠</span> Home
          </button>
          <button onClick={() => navigateAsUser('/recording-indicators')} disabled={!selectedUser}>
            <span className="menu-icon">📊</span> Recording Indicators
          </button>
          <button onClick={() => navigateAsUser('/exacerbation-forecast')} disabled={!selectedUser}>
            <span className="menu-icon">🔮</span> Exacerbation Forecast
          </button>
          <button onClick={() => navigateAsUser('/graphs-of-changes')} disabled={!selectedUser}>
            <span className="menu-icon">📈</span> Graphs of Changes
          </button>
          <button onClick={() => navigateAsUser('/medication-diary')} disabled={!selectedUser}>
            <span className="menu-icon">💊</span> Medication Diary
          </button>
        </nav>
      </div>
      
      {/* Backdrop for mobile */}
      <div className="sidebar-backdrop" onClick={closeSidebar}></div>
    </div>
  );
}


export default AdminDashboard; 