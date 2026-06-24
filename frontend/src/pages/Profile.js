import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Profile.css';

function Profile() {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [userData, setUserData] = useState({
    email: '',
    name: '',
    age: '',
    sex: '',
    smoking: '',
    allergy: ''
  });
  const [originalData, setOriginalData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userRole, setUserRole] = useState('user');
  const [isViewingAsUser, setIsViewingAsUser] = useState(false);

  // Детектування мобільних пристроїв та оновлення стану
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    // Виклик обробника при монтуванні
    handleResize();

    // Додавання обробника при зміні розміру вікна
    window.addEventListener('resize', handleResize);

    // Прибираємо overflow: hidden з body при монтуванні
    document.body.style.overflow = '';

    // Видалення обробника при розмонтуванні
    return () => {
      window.removeEventListener('resize', handleResize);
      document.body.classList.remove('sidebar-open');
      document.body.style.overflow = '';
    };
  }, []);

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

    const fetchUserData = async () => {
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

        // Fetch user data
        const response = await fetch(`http://localhost:5000/api/user-data/${user_id}`);
        const data = await response.json();
        
        if (response.ok) {
          // Fetch email from users table
          const emailResponse = await fetch(`http://localhost:5000/api/user-email/${user_id}`);
          const emailData = await emailResponse.json();
          
          if (emailResponse.ok) {
            const completeData = {
              ...data,
              email: emailData.email,
              smoking: data.smoking === 1 ? 'yes' : 'no', // Convert smoking value to yes/no
              sex: data.sex // Keep the sex value as is from the database
            };
            setUserData(completeData);
            setOriginalData(completeData);
          } else {
            throw new Error(emailData.error);
          }
        } else {
          throw new Error(data.error);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError('Failed to load user data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
    checkUserRole();
  }, [navigate]);

  // Ефект для відстеження зміни стану sidebar і оновлення класу body
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.classList.add('sidebar-open');
      // На мобільних пристроях блокуємо прокрутку body
      if (isMobile) {
        document.body.style.overflow = 'hidden';
      }
    } else {
      document.body.classList.remove('sidebar-open');
      document.body.style.overflow = '';
    }
  }, [isSidebarOpen, isMobile]);

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

  const handleChange = (e) => {
    // Якщо переглядаємо як інший користувач, не дозволяємо зміни
    if (isViewingAsUser) return;
    
    const { name, value } = e.target;
    setUserData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Не дозволяємо відправку форми, якщо переглядаємо як інший користувач
    if (isViewingAsUser) {
      return;
    }
    
    setError('');
    setSuccess('');
    
    try {
      // Перевіряємо, чи переглядаємо як інший користувач
      const viewing_as_user_id = localStorage.getItem('viewing_as_user_id');
      const user_id = viewing_as_user_id || localStorage.getItem('user_id');
      
      if (!user_id) {
        navigate('/');
        return;
      }

      // Update user data
      const response = await fetch(`http://localhost:5000/api/update-user-data/${user_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: userData.name,
          age: userData.age,
          sex: userData.sex, // Send sex value as is to the database
          smoking: userData.smoking === 'yes' ? 1 : 0, // Convert smoking value back to 1/0
          allergy: userData.allergy
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user data');
      }

      // Update email if changed
      if (userData.email !== originalData.email) {
        const emailResponse = await fetch(`http://localhost:5000/api/update-email/${user_id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: userData.email }),
        });

        if (!emailResponse.ok) {
          throw new Error('Failed to update email');
        }
      }

      setSuccess('Changes saved successfully');
      setOriginalData(userData);
    } catch (error) {
      console.error('Error updating user data:', error);
      setError('Failed to save changes');
    }
  };

  const hasChanges = () => {
    if (!originalData) return false;
    return Object.keys(userData).some(key => userData[key] !== originalData[key]);
  };

  const handleLogout = () => {
    localStorage.removeItem('user_id');
    navigate('/');
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
    // Логіка додавання/видалення класу переміщена до useEffect з залежністю від isSidebarOpen
  };

  // Функція для закриття сайдбара при кліку на фон
  const closeSidebar = () => {
    if (isSidebarOpen) {
      setIsSidebarOpen(false);
      // Логіка видалення класу переміщена до useEffect з залежністю від isSidebarOpen
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

  if (isLoading) {
    return <div className="profile-container">Loading...</div>;
  }

  return (
    <div className={`profile-container ${isSidebarOpen ? 'sidebar-open' : ''}`}>
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
          <h1>Profile Settings</h1>
        </div>

        <div className="nav-buttons">
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
      
      <div className="profile-content">
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="profile-form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={userData.email}
              onChange={handleChange}
              required
              disabled={isViewingAsUser}
              className={isViewingAsUser ? 'view-only' : ''}
            />
          </div>
          <div className="profile-form-group">
            <label htmlFor="name">Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={userData.name}
              onChange={handleChange}
              required
              disabled={isViewingAsUser}
              className={isViewingAsUser ? 'view-only' : ''}
            />
          </div>
          <div className="profile-form-group">
            <label htmlFor="age">Age</label>
            <input
              type="number"
              id="age"
              name="age"
              value={userData.age}
              onChange={handleChange}
              required
              min="1"
              disabled={isViewingAsUser}
              className={isViewingAsUser ? 'view-only' : ''}
            />
          </div>
          <div className="profile-form-group">
            <label htmlFor="sex">Gender</label>
            <select
              id="sex"
              name="sex"
              value={userData.sex}
              onChange={handleChange}
              required
              disabled={isViewingAsUser}
              className={isViewingAsUser ? 'view-only' : ''}
            >
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div className="profile-form-group">
            <label className="radio-label">Smoking Status</label>
            <div className="radio-group">
              <label className={isViewingAsUser ? 'view-only' : ''}>
                <input
                  type="radio"
                  name="smoking"
                  value="yes"
                  checked={userData.smoking === 'yes'}
                  onChange={handleChange}
                  required
                  disabled={isViewingAsUser}
                />
                Yes
              </label>
              <label className={isViewingAsUser ? 'view-only' : ''}>
                <input
                  type="radio"
                  name="smoking"
                  value="no"
                  checked={userData.smoking === 'no'}
                  onChange={handleChange}
                  disabled={isViewingAsUser}
                />
                No
              </label>
            </div>
          </div>
          <div className="profile-form-group">
            <label htmlFor="allergy">Allergies</label>
            <input
              type="text"
              id="allergy"
              name="allergy"
              value={userData.allergy}
              onChange={handleChange}
              required
              disabled={isViewingAsUser}
              className={isViewingAsUser ? 'view-only' : ''}
            />
            <div className="allergies-hint">
              Please list your allergies separated by commas. Common allergies: pollen, dust, mold, pets, food. Write "none" if you don't have any allergies.
            </div>
          </div>
          {!isViewingAsUser && (
            <button 
              type="submit" 
              className="save-button"
              disabled={!hasChanges() || isViewingAsUser}
            >
              Save Changes
            </button>
          )}
        </form>
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
      
      <div className="floating-menu-button" onClick={toggleSidebar}>
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>

  );

}

export default Profile; 