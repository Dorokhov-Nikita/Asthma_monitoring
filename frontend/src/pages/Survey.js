import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Survey.css';

function Survey() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    sex: '',
    smoking: '',
    allergy: ''
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    name: '',
    age: '',
    sex: '',
    smoking: '',
    allergy: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    let isValid = true;
    const newFieldErrors = { name: '', age: '', sex: '', smoking: '', allergy: '' };
    
    // Check each field
    if (!formData.name.trim()) {
      newFieldErrors.name = 'Please enter your name';
      isValid = false;
    }
    
    if (!formData.age) {
      newFieldErrors.age = 'Please enter your age';
      isValid = false;
    } else if (isNaN(parseInt(formData.age, 10)) || parseInt(formData.age, 10) <= 0 || parseInt(formData.age, 10) > 120) {
      newFieldErrors.age = 'Please enter a valid age between 1 and 120';
      isValid = false;
    }
    
    if (!formData.sex) {
      newFieldErrors.sex = 'Please select your gender';
      isValid = false;
    }
    
    if (!formData.smoking) {
      newFieldErrors.smoking = 'Please select your smoking status';
      isValid = false;
    }
    
    if (!formData.allergy.trim()) {
      newFieldErrors.allergy = 'Please enter your allergies or "none"';
      isValid = false;
    }
    
    setFieldErrors(newFieldErrors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Custom validation
    if (!validateForm()) {
      return;
    }

    // Get user_id from localStorage
    const user_id = localStorage.getItem('user_id');
    if (!user_id) {
      setError('User session expired. Please sign up again.');
      return;
    }

    // Підготовка даних для надсилання на сервер
    // Переконуємося, що всі дані мають правильний тип
    const dataToSubmit = {
      user_id: parseInt(user_id, 10), // Перетворення на число
      name: formData.name.trim(),
      age: parseInt(formData.age, 10), // Перетворення на число
      sex: formData.sex,
      smoking: formData.smoking === 'yes' ? 1 : 0, // Переконуємося, що це число
      allergy: formData.allergy.trim()
    };

    try {
      const response = await fetch('http://localhost:5000/api/survey', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSubmit),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'An error occurred. Please try again.');
      }

      navigate('/dashboard');
    } catch (err) {
      console.error('Survey submission error:', err);
      setError(err.message);
    }
  };

  return (
    <div className="survey-container">
      <div className="survey-form">
        <h2>Additional Information</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit} noValidate>
          <div className="survey-form-group">
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder=" "
            />
            <label>Name</label>
            {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
          </div>

          <div className="survey-form-group">
            <input
              type="number"
              name="age"
              value={formData.age}
              onChange={handleChange}
              min="0"
              max="120"
              placeholder=" "
            />
            <label>Age</label>
            {fieldErrors.age && <div className="field-error">{fieldErrors.age}</div>}
          </div>

          <div className="survey-form-group">
            <select
              name="sex"
              value={formData.sex}
              onChange={handleChange}
              placeholder=" "
            >
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <label>Gender</label>
            {fieldErrors.sex && <div className="field-error">{fieldErrors.sex}</div>}
          </div>

          <div className="survey-form-group">
            <div className="smoking-section">
              <p className="smoking-label">Smoking Status</p>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    name="smoking"
                    value="yes"
                    checked={formData.smoking === "yes"}
                    onChange={handleChange}
                  />
                  <span>Yes</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="smoking"
                    value="no"
                    checked={formData.smoking === "no"}
                    onChange={handleChange}
                  />
                  <span>No</span>
                </label>
              </div>
              {fieldErrors.smoking && <div className="field-error smoking-error">{fieldErrors.smoking}</div>}
            </div>
          </div>

          <div className="survey-form-group">
            <input
              type="text"
              name="allergy"
              value={formData.allergy}
              onChange={handleChange}
              placeholder=" "
            />
            <label>Allergies</label>
            {fieldErrors.allergy && <div className="field-error">{fieldErrors.allergy}</div>}
            <div className="allergies-hint">
              Please list your allergies separated by commas. Common allergies: pollen, dust, mold, pets, food. Write "none" if you don't have any allergies.
            </div>
          </div>

          <div className="button-group">
            <button type="submit" className="submit-button">
              Submit
            </button>
            <button 
              type="button" 
              className="clear-button"
              onClick={() => {
                setFormData({ name: '', age: '', sex: '', smoking: '', allergy: '' });
                setFieldErrors({ name: '', age: '', sex: '', smoking: '', allergy: '' });
              }}
            >
              Clear form
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Survey;
