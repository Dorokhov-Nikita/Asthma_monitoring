from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv
import bcrypt
import json
import sys
from pathlib import Path
import datetime
import os
import numpy as np
import random
import joblib

# Add import for SHAP
try:
    import shap
    SHAP_AVAILABLE = True
    print("===== [STARTUP] SHAP is available and will be used for feature importance analysis =====")
except ImportError:
    SHAP_AVAILABLE = False
    print("===== [STARTUP] SHAP not available, will use alternative feature importance methods =====")

# Try to import TensorFlow, but continue if it's not available
TF_AVAILABLE = False
try:
    import tensorflow as tf
    from sklearn.preprocessing import StandardScaler
    TF_AVAILABLE = True
    print("===== [STARTUP] TensorFlow is available and will be used for predictions =====")
    print(f"===== [STARTUP] TensorFlow version: {tf.__version__} =====")
except ImportError as e:
    TF_AVAILABLE = False
    print("===== [STARTUP] TensorFlow import error: " + str(e) + " =====")
    print("===== [STARTUP] Using rule-based predictions instead =====")

# Load environment variables
load_dotenv()

app = Flask(__name__)
# Налаштування CORS для всіх маршрутів
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Global variables for model and scaler
MODEL = None
SCALER = None
FEATURE_NAMES = [
    'Age', 'Gender', 'Smoking', 
    'FEV1', 'FVC', 'PEF', 
    'Respiratory_Rate', 'Pulse',
    'Cough', 'Breathlessness', 'Wheezing', 'Chest_Tightness', 'Nighttime_Awakenings',
    'Mold', 'Animal_Dander', 'Aspirin', 'Food', 'Dust', 'Pollen',
    'Medication_Budesonide', 'Medication_Fluticasone', 'Medication_Formoterol', 'Medication_Ipratropium', 'Medication_Salbutamol'
]

# Load the trained model at application startup if TensorFlow is available
def load_model():
    global MODEL, SCALER
    if not TF_AVAILABLE:
        print("===== [MODEL] TensorFlow not available, skipping model loading =====")
        return False
        
    try:
        model_path = os.path.join(os.path.dirname(__file__), 'ml_data', 'best_asthma_model.h5')
        print(f"===== [MODEL] Attempting to load model from {model_path} =====")
        
        if not os.path.exists(model_path):
            print(f"===== [ERROR] Model file not found: {model_path} =====")
            return False
            
        MODEL = tf.keras.models.load_model(model_path)
        print("===== [MODEL] Neural network model loaded successfully =====")
        
        # Завантажуємо SCALER з файлу, якщо він існує
        scaler_path = os.path.join(os.path.dirname(__file__), 'ml_data', 'scaler.joblib')
        print(f"===== [MODEL] Checking for scaler at {scaler_path} =====")
        
        if os.path.exists(scaler_path):
            try:
                SCALER = joblib.load(scaler_path)
                print("===== [MODEL] Scaler loaded successfully =====")
            except Exception as e:
                print(f"===== [ERROR] Error loading scaler: {e} =====")
                SCALER = None
        else:
            print("===== [WARNING] Scaler file not found, will use raw feature values =====")
            SCALER = None
            
        # Додаємо детальну інформацію про модель
        print(f"===== [MODEL] Neural network structure: =====")
        MODEL.summary()
        print(f"===== [MODEL] Model input shape: {MODEL.input_shape} =====")
        print(f"===== [MODEL] Model output shape: {MODEL.output_shape} =====")
        
        # Перевіримо, чи очікується правильна кількість вхідних ознак
        expected_features = len(FEATURE_NAMES)
        actual_features = MODEL.input_shape[1] if MODEL.input_shape is not None and len(MODEL.input_shape) > 1 else 0
        
        if expected_features != actual_features:
            print(f"===== [WARNING] Feature count mismatch. Model expects {actual_features} features, but we have {expected_features} in FEATURE_NAMES =====")
            print(f"===== [WARNING] Feature names: {FEATURE_NAMES} =====")
            print(f"===== [WARNING] This may cause prediction errors. Please check model configuration. =====")
            return False  # Повертаємо False, якщо кількість ознак не відповідає
        else:
            print(f"===== [SUCCESS] Feature count matches model input: {expected_features} =====")
        
        print(f"===== [SUCCESS] Model initialization complete! =====")
        return True
    except Exception as e:
        print(f"===== [ERROR] Error loading model: {e} =====")
        import traceback
        traceback.print_exc()
        return False

# Initialize model on startup if TensorFlow is available
if TF_AVAILABLE:
    print("\n===== [STARTUP] Initializing neural network model... =====")
    model_loaded = load_model()
    print(f"===== [STARTUP] Neural network model loaded: {model_loaded} =====")
    
    # Додаємо тестування моделі, щоб виявити проблеми з узагальненням
    if MODEL is not None:
        print("===== [STARTUP] Starting model validation tests... =====")
        
        # Створюємо тестові вхідні дані з нулями та одиницями
        test_zeros = np.zeros((1, len(FEATURE_NAMES)))
        test_ones = np.ones((1, len(FEATURE_NAMES)))
        
        # Виконуємо прогнози
        try:
            # Використовуємо сирі (ненормалізовані) дані для тестування
            # Це дозволяє оцінити роботу моделі з даними різних типів
            prediction_zeros = MODEL.predict(test_zeros, verbose=0)[0][0]
            print(f"===== [TEST] Prediction for all zeros: {prediction_zeros:.4f} =====")
            
            # Використовуємо SCALER, якщо він доступний
            if SCALER is not None:
                test_ones_normalized = SCALER.transform(test_ones)
                prediction_ones = MODEL.predict(test_ones_normalized, verbose=0)[0][0]
                print(f"===== [TEST] Prediction for all ones (normalized with SCALER): {prediction_ones:.4f} =====")
            else:
                prediction_ones = MODEL.predict(test_ones, verbose=0)[0][0]
                print(f"===== [TEST] Prediction for all ones (not normalized): {prediction_ones:.4f} =====")
            
            # Створимо тестовий вектор з високими значеннями симптомів
            test_symptoms = test_zeros.copy()
            test_symptoms[0, 8:13] = 5.0  # Високі значення для всіх симптомів
            prediction_symptoms = MODEL.predict(test_symptoms, verbose=0)[0][0]
            print(f"===== [TEST] Prediction for high symptoms only: {prediction_symptoms:.4f} =====")
            
            # Створимо тестовий вектор з усіма алергіями
            test_allergies = test_zeros.copy()
            test_allergies[0, 13:19] = 1.0  # Усі алергії
            prediction_allergies = MODEL.predict(test_allergies, verbose=0)[0][0]
            print(f"===== [TEST] Prediction for all allergies only: {prediction_allergies:.4f} =====")
            
            # Створимо тестовий вектор з низькими значеннями легеневої функції
            test_lung = test_zeros.copy()
            test_lung[0, 3] = 0.5  # Низький FEV1
            test_lung[0, 4] = 0.8  # Низький FVC
            test_lung[0, 5] = 100.0  # Низький PEF
            prediction_lung = MODEL.predict(test_lung, verbose=0)[0][0]
            print(f"===== [TEST] Prediction for poor lung function only: {prediction_lung:.4f} =====")
            
            # Перевіряємо чутливість моделі - наскільки змінюється вихід при зміні входу
            test_sensitivity = test_zeros.copy()
            sensitivity_results = {}
            
            # Перевіряємо чутливість до кожної ознаки
            for i, feature_name in enumerate(FEATURE_NAMES):
                test_sensitivity_copy = test_zeros.copy()
                
                # Встановлюємо типові значення для даної ознаки
                if i in [0, 3, 4, 5, 6, 7]:  # Числові ознаки з великими значеннями
                    test_sensitivity_copy[0, i] = 1.0  # Типове значення
                else:
                    test_sensitivity_copy[0, i] = 1.0  # Для бінарних ознак
                
                pred = MODEL.predict(test_sensitivity_copy, verbose=0)[0][0]
                sensitivity_results[feature_name] = float(pred) - float(prediction_zeros)
            
            # Виведемо 5 ознак з найбільшим впливом
            sorted_sensitivity = sorted(sensitivity_results.items(), key=lambda x: abs(x[1]), reverse=True)
            print("\n===== [TEST] Model feature sensitivity (top 5): =====")
            for feature, impact in sorted_sensitivity[:5]:
                print(f"===== [TEST] {feature}: Impact = {impact:.6f} =====")
                
            if all(abs(impact) < 0.01 for _, impact in sorted_sensitivity):
                print("\n===== [WARNING] Model shows very low sensitivity to all features! =====")
                print("===== [WARNING] This may indicate overfitting or other issues with the model. =====")
                print("===== [WARNING] Consider retraining the model or using the rule-based approach instead. =====")
            else:
                print("\n===== [SUCCESS] Model shows good sensitivity to features. =====")
            
        except Exception as e:
            print(f"===== [ERROR] Error testing model: {e} =====")
            import traceback
            traceback.print_exc()
        
        print("===== [STARTUP] Model validation tests completed =====")
else:
    print("===== [STARTUP] TensorFlow not available, neural network will not be used =====")
    MODEL = None
    SCALER = None

# Database configuration
db_config = {
    'host': 'localhost',
    'user': 'root',  # Default XAMPP MySQL username
    'password': '',  # Default XAMPP MySQL password is empty
    'database': 'asthma_monitor'
}

# Add path to ml_data directory
sys.path.append(str(Path(__file__).parent))

def get_db_connection():
    try:
        connection = mysql.connector.connect(**db_config)
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'user')  # Default role is 'user'

    if not email or not password:
        return jsonify({'error': 'All fields are required'}), 400
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor()
        
        # Check if email already exists
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({'error': 'Email already exists'}), 400
        
        # Hash the password
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        # Insert new user with hashed password
        cursor.execute(
            "INSERT INTO users (email, password, role) VALUES (%s, %s, %s)",
            (email, hashed_password, role)
        )
        user_id = cursor.lastrowid
        connection.commit()
        return jsonify({'message': 'Account created successfully', 'user_id': user_id}), 201
        
    except Error as e:
        print(f"Error: {e}")
        return jsonify({'error': 'Database error occurred'}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'All fields are required'}), 400
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        
        # Get user with the provided email
        cursor.execute(
            "SELECT id, password, role FROM users WHERE email = %s",
            (email,)
        )
        user = cursor.fetchone()
        
        if not user or not bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Update last_login timestamp
        cursor.execute(
            "UPDATE users SET last_login = NOW() WHERE id = %s",
            (user['id'],)
        )
        connection.commit()
        
        return jsonify({
            'message': 'Login successful', 
            'user_id': user['id'],
            'role': user['role']
        }), 200
        
    except Error as e:
        print(f"Error: {e}")
        return jsonify({'error': 'Database error occurred'}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/survey', methods=['POST'])
def survey():
    data = request.json
    
    # Отримання даних з запиту
    user_id = data.get('user_id')
    name = data.get('name', '').strip()
    age = data.get('age')
    sex = data.get('sex', '').strip()
    smoking = data.get('smoking')
    allergy = data.get('allergy', '').strip()
    
    # Перевірка на валідність даних
    if not user_id or not name or not age or not sex or not allergy:
        return jsonify({'error': 'All fields are required'}), 400
    
    # Переконуємося, що user_id та age є цілими числами
    try:
        user_id = int(user_id)
        age = int(age)
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid user_id or age format'}), 400
    
    # Переконуємося, що smoking має коректне значення (0 або 1)
    if smoking not in [0, 1]:
        return jsonify({'error': 'Smoking field must be 0 or 1'}), 400
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor()
        
        # Перевіряємо, чи існує користувач з таким ID
        cursor.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Перевіряємо, чи вже є запис для цього користувача
        cursor.execute("SELECT id FROM users_data WHERE user_id = %s", (user_id,))
        existing_data = cursor.fetchone()
        
        if existing_data:
            # Якщо запис вже існує, оновлюємо його
            cursor.execute(
                """UPDATE users_data 
                   SET name = %s, age = %s, sex = %s, smoking = %s, allergy = %s
                   WHERE user_id = %s""",
                (name, age, sex, smoking, allergy, user_id)
            )
        else:
            # Інакше вставляємо новий запис
            cursor.execute(
                """INSERT INTO users_data 
                   (user_id, name, age, sex, smoking, allergy) 
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (user_id, name, age, sex, smoking, allergy)
            )
        
        connection.commit()
        return jsonify({'message': 'Survey data saved successfully'}), 201
        
    except Error as e:
        print(f"Error in survey API: {e}")
        return jsonify({'error': 'Database error occurred'}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/user-data/<int:user_id>', methods=['GET'])
def get_user_data(user_id):
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        
        # Перевіряємо, чи існує користувач з таким ID
        cursor.execute(
            "SELECT id, email, role FROM users WHERE id = %s",
            (user_id,)
        )
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Отримуємо дані користувача
        cursor.execute(
            """SELECT name, age, sex, smoking, allergy 
               FROM users_data 
               WHERE user_id = %s""",
            (user_id,)
        )
        user_data = cursor.fetchone()
        
        # Якщо даних користувача немає, повертаємо базові дані
        if not user_data:
            return jsonify({
                'name': f"User {user_id}",  # Базове ім'я
                'email': user['email'],     # Email з таблиці users
                'role': user['role']        # Роль з таблиці users
            }), 200
        
        # Додаємо email та роль до даних користувача
        user_data['email'] = user['email']
        user_data['role'] = user['role']
        
        return jsonify(user_data), 200
        
    except Error as e:
        print(f"Error: {e}")
        return jsonify({'error': 'Database error occurred'}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/user-email/<int:user_id>', methods=['GET'])
def get_user_email(user_id):
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        
        # Get user email
        cursor.execute(
            "SELECT email FROM users WHERE id = %s",
            (user_id,)
        )
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify(user), 200
        
    except Error as e:
        print(f"Error: {e}")
        return jsonify({'error': 'Database error occurred'}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/update-user-data/<int:user_id>', methods=['PUT'])
def update_user_data(user_id):
    data = request.json
    name = data.get('name')
    age = data.get('age')
    sex = data.get('sex')
    smoking = data.get('smoking')
    allergy = data.get('allergy')

    if not all([name, age, sex, allergy]) or smoking not in [0, 1]:
        return jsonify({'error': 'All fields are required'}), 400
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor()
        
        # Update user data
        cursor.execute(
            """UPDATE users_data 
               SET name = %s, age = %s, sex = %s, smoking = %s, allergy = %s
               WHERE user_id = %s""",
            (name, age, sex, smoking, allergy, user_id)
        )
        
        if cursor.rowcount == 0:
            return jsonify({'error': 'User data not found'}), 404
        
        connection.commit()
        return jsonify({'message': 'User data updated successfully'}), 200
        
    except Error as e:
        print(f"Error: {e}")
        return jsonify({'error': 'Database error occurred'}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/update-email/<int:user_id>', methods=['PUT'])
def update_email(user_id):
    data = request.json
    email = data.get('email')

    if not email:
        return jsonify({'error': 'Email is required'}), 400
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor()
        
        # Check if email already exists
        cursor.execute(
            "SELECT id FROM users WHERE email = %s AND id != %s",
            (email, user_id)
        )
        if cursor.fetchone():
            return jsonify({'error': 'Email already exists'}), 400
        
        # Update email
        cursor.execute(
            "UPDATE users SET email = %s WHERE id = %s",
            (email, user_id)
        )
        
        if cursor.rowcount == 0:
            return jsonify({'error': 'User not found'}), 404
        
        connection.commit()
        return jsonify({'message': 'Email updated successfully'}), 200
        
    except Error as e:
        print(f"Error: {e}")
        return jsonify({'error': 'Database error occurred'}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/health-records/<int:user_id>', methods=['GET'])
def get_health_records(user_id):
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        
        cursor.execute(
            """SELECT * FROM health_records 
               WHERE user_id = %s 
               ORDER BY id ASC""",
            (user_id,)
        )
        records = cursor.fetchall()
        
        return jsonify(records), 200
        
    except Error as e:
        print(f"Error: {e}")
        return jsonify({'error': 'Database error occurred'}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/health-records', methods=['POST'])
def add_health_record():
    data = request.json
    user_id = data.get('user_id')
    
    if not user_id:
        return jsonify({'error': 'User ID is required'}), 400
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor()
        
        # Визначаємо поля та їх типи
        fields_types = {
            'user_id': int,
            'date': str,
            'FEV1': float,
            'FVC': float,
            'PEF': float,
            'respiratory_rate': int,
            'pulse': int,
            'cough': int,
            'breathlessness': int,
            'wheezing': int,
            'chest_tightness': int,
            'nighttime_awakenings': int,
            'medicine': str
        }
        
        # Підготовка даних з конвертацією типів
        values = []
        for field, field_type in fields_types.items():
            value = data.get(field, '')
            # Перевіряємо на пусте значення або None
            if value == '' or value is None:
                values.append(None)
            else:
                # Конвертуємо значення в правильний тип, якщо це не None
                try:
                    if field_type in (int, float):
                        values.append(field_type(value))
                    else:
                        values.append(value)
                except (ValueError, TypeError):
                    values.append(None)
        
        cursor.execute(
            """INSERT INTO health_records 
               (user_id, date, FEV1, FVC, PEF, respiratory_rate, pulse, 
                cough, breathlessness, wheezing, chest_tightness, 
                nighttime_awakenings, medicine)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            values
        )
        
        record_id = cursor.lastrowid
        connection.commit()
        
        return jsonify({
            'message': 'Health record added successfully',
            'id': record_id
        }), 201
        
    except Error as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/update-health-record/<int:record_id>', methods=['PUT'])
def update_health_record(record_id):
    data = request.json
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor()
        
        # Створюємо список полів та значень для оновлення
        update_fields = []
        values = []
        
        # Перевіряємо кожне поле в отриманих даних
        fields = {
            'date': str,
            'FEV1': float,
            'FVC': float,
            'PEF': float,
            'respiratory_rate': int,
            'pulse': int,
            'cough': int,
            'breathlessness': int,
            'wheezing': int,
            'chest_tightness': int,
            'nighttime_awakenings': int,
            'medicine': str
        }
        
        for field, field_type in fields.items():
            if field in data:
                value = data[field]
                # Перевіряємо на пусте значення або None
                if value == '' or value is None:
                    update_fields.append(f'{field} = NULL')
                else:
                    update_fields.append(f'{field} = %s')
                    # Конвертуємо значення в правильний тип
                    if field_type in (int, float) and isinstance(value, str):
                        value = field_type(value)
                    values.append(value)
        
        if not update_fields:
            return jsonify({'error': 'No fields to update'}), 400
        
        # Додаємо record_id до значень
        values.append(record_id)
        
        # Створюємо та виконуємо SQL запит
        query = f"""
            UPDATE health_records 
            SET {', '.join(update_fields)}
            WHERE id = %s
        """
        cursor.execute(query, values)
        connection.commit()
        
        if cursor.rowcount == 0:
            return jsonify({'error': 'Record not found'}), 404
        
        return jsonify({'message': 'Record updated successfully'}), 200
        
    except Error as e:
        print(f"Error: {e}")
        return jsonify({'error': 'Database error occurred'}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/health-records/<int:record_id>', methods=['DELETE'])
def delete_health_record(record_id):
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor()
        
        # Перевіряємо, чи існує запис з таким ID
        cursor.execute(
            "SELECT id FROM health_records WHERE id = %s",
            (record_id,)
        )
        record = cursor.fetchone()
        
        if not record:
            return jsonify({'error': 'Record not found'}), 404
        
        # Видаляємо запис
        cursor.execute(
            "DELETE FROM health_records WHERE id = %s",
            (record_id,)
        )
        
        connection.commit()
        
        return jsonify({
            'success': True,
            'message': 'Health record deleted successfully'
        }), 200
        
    except Error as e:
        print(f"Error: {e}")
        return jsonify({'error': 'Database error occurred'}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/medications', methods=['GET'])
def get_medications():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID is required'}), 400
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        
        cursor.execute(
            """SELECT id, user_id, medication, dose, time_slot, date, taken, comment 
               FROM users_medications 
               WHERE user_id = %s 
               ORDER BY date DESC""",
            (user_id,)
        )
        medications = cursor.fetchall()
        
        # Convert date objects to strings for JSON serialization
        for med in medications:
            if 'date' in med and med['date']:
                med['date'] = med['date'].isoformat()
        
        return jsonify({
            'success': True,
            'medications': medications
        }), 200
        
    except Error as e:
        print(f"Error: {e}")
        return jsonify({'error': 'Database error occurred'}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/medications', methods=['POST'])
def add_medication():
    data = request.json
    user_id = data.get('user_id')
    medication = data.get('medication')
    dose = data.get('dose')
    time_slot = data.get('time_slot')
    date = data.get('date')
    taken = data.get('taken', 0)
    comment = data.get('comment', '')
    
    if not all([user_id, medication, dose, time_slot, date]):
        return jsonify({'error': 'Required fields are missing'}), 400
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor()
        
        cursor.execute(
            """INSERT INTO users_medications 
               (user_id, medication, dose, time_slot, date, taken, comment) 
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (user_id, medication, dose, time_slot, date, taken, comment)
        )
        
        medication_id = cursor.lastrowid
        connection.commit()
        
        return jsonify({
            'success': True,
            'message': 'Medication added successfully',
            'id': medication_id
        }), 201
        
    except Error as e:
        print(f"Error: {e}")
        return jsonify({'error': 'Database error occurred'}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/medications/<int:medication_id>', methods=['PUT'])
def update_medication(medication_id):
    data = request.json
    medication = data.get('medication')
    dose = data.get('dose')
    time_slot = data.get('time_slot')
    comment = data.get('comment', '')
    
    if not all([medication, dose, time_slot]):
        return jsonify({'error': 'Required fields are missing'}), 400
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor()
        
        cursor.execute(
            """UPDATE users_medications 
               SET medication = %s, dose = %s, time_slot = %s, comment = %s 
               WHERE id = %s""",
            (medication, dose, time_slot, comment, medication_id)
        )
        
        if cursor.rowcount == 0:
            return jsonify({'error': 'Medication not found'}), 404
        
        connection.commit()
        
        return jsonify({
            'success': True,
            'message': 'Medication updated successfully'
        }), 200
        
    except Error as e:
        print(f"Error: {e}")
        return jsonify({'error': 'Database error occurred'}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/medications/<int:medication_id>', methods=['DELETE'])
def delete_medication(medication_id):
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor()
        
        cursor.execute(
            "DELETE FROM users_medications WHERE id = %s",
            (medication_id,)
        )
        
        if cursor.rowcount == 0:
            return jsonify({'error': 'Medication not found'}), 404
        
        connection.commit()
        
        return jsonify({
            'success': True,
            'message': 'Medication deleted successfully'
        }), 200
        
    except Error as e:
        print(f"Error: {e}")
        return jsonify({'error': 'Database error occurred'}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/medications/<int:medication_id>/toggle-taken', methods=['PUT'])
def toggle_medication_taken(medication_id):
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        
        # Get current taken status
        cursor.execute(
            "SELECT taken FROM users_medications WHERE id = %s",
            (medication_id,)
        )
        medication = cursor.fetchone()
        
        if not medication:
            return jsonify({'error': 'Medication not found'}), 404
        
        # Toggle taken status (0 to 1, 1 to 0)
        new_taken = 1 if medication['taken'] == 0 else 0
        
        cursor.execute(
            "UPDATE users_medications SET taken = %s WHERE id = %s",
            (new_taken, medication_id)
        )
        
        connection.commit()
        
        return jsonify({
            'success': True,
            'message': 'Medication status updated successfully',
            'taken': new_taken
        }), 200
        
    except Error as e:
        print(f"Error: {e}")
        return jsonify({'error': 'Database error occurred'}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/admin/statistics', methods=['GET'])
def get_admin_statistics():
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        
        cursor.execute("SELECT COUNT(*) as total_users FROM users")
        users_count = cursor.fetchone()['total_users']
        
        cursor.execute("SELECT COUNT(*) as total_records FROM health_records")
        health_records_count = cursor.fetchone()['total_records']
        
        cursor.execute("SELECT COUNT(*) as medication_records FROM users_medications")
        medication_records = cursor.fetchone()['medication_records']
        
        statistics = {
            'totalUsers': users_count,
            'medicationRecords': medication_records,
            'healthRecords': health_records_count
        }
        
        return jsonify(statistics), 200
        
    except Error as e:
        print(f"Error: {e}")
        return jsonify({'error': 'Database error occurred'}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/admin/recent-users', methods=['GET'])
def get_recent_users():
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        
        # Отримуємо всіх зареєстрованих користувачів з розширеною інформацією
        cursor.execute("""
            SELECT 
                u.id, 
                u.email, 
                u.role, 
                u.last_login,
                COALESCE(ud.name, CONCAT('User ', u.id)) as name,
                ud.age,
                ud.sex,
                (SELECT COUNT(*) FROM health_records hr WHERE hr.user_id = u.id) AS records_count
            FROM users u
            LEFT JOIN users_data ud ON u.id = ud.user_id
            ORDER BY u.id
        """)
        
        users = cursor.fetchall()
        
        # Конвертуємо datetime в строку для JSON
        for user in users:
            if 'last_login' in user and user['last_login']:
                user['last_login'] = user['last_login'].isoformat()
        
        return jsonify(users), 200
        
    except Error as e:
        print(f"Error: {e}")
        return jsonify({'error': 'Database error occurred'}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/admin/model-performance', methods=['GET'])
def get_model_performance():
    # В реальній системі ці дані мали б приходити з результатів оцінки моделі
    # Наразі повертаємо тестові дані
    performance_data = {
        "accuracy": 0.92,
        "precision": 0.89,
        "recall": 0.94,
        "f1Score": 0.91
    }
    
    return jsonify(performance_data), 200

@app.route('/api/user-role/<int:user_id>', methods=['GET'])
def get_user_role(user_id):
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        
        # Get user role
        cursor.execute(
            "SELECT role FROM users WHERE id = %s",
            (user_id,)
        )
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({'role': user['role']}), 200
        
    except Error as e:
        print(f"Error: {e}")
        return jsonify({'error': 'Database error occurred'}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/predict-exacerbation/<int:user_id>/<int:record_id>', methods=['GET'])
def predict_exacerbation(user_id, record_id):
    # Додаємо логування у файл для відстеження
    with open('prediction_log.txt', 'a') as log_file:
        log_file.write(f"\n\n===== PREDICTION START: user_id={user_id}, record_id={record_id}, time={datetime.datetime.now()} =====\n")
        
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        # Спочатку перевіряємо, чи доступна нейронна мережа
        use_ml_model = TF_AVAILABLE
        if use_ml_model and MODEL is None:
            if not load_model():
                use_ml_model = False
                print("===== [PREDICTION] Neural network model not available, will try to use rule-based prediction =====")
                with open('prediction_log.txt', 'a') as log_file:
                    log_file.write("Neural network model not available, using rule-based prediction\n")
        else:
            print(f"===== [PREDICTION] TensorFlow available: {TF_AVAILABLE}, MODEL available: {MODEL is not None} =====")
            with open('prediction_log.txt', 'a') as log_file:
                log_file.write(f"TensorFlow available: {TF_AVAILABLE}, MODEL available: {MODEL is not None}\n")
                
        cursor = connection.cursor(dictionary=True)
        
        # Check if user exists
        cursor.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        if not cursor.fetchone():
            return jsonify({'error': 'User not found'}), 404
        
        # Get user data
        cursor.execute(
            """SELECT age, sex, smoking, allergy 
               FROM users_data 
               WHERE user_id = %s""",
            (user_id,)
        )
        user_data = cursor.fetchone()
        
        if not user_data:
            return jsonify({'error': 'User profile data not found'}), 404
        
        # Get health record
        cursor.execute(
            """SELECT * FROM health_records 
               WHERE id = %s AND user_id = %s""",
            (record_id, user_id)
        )
        health_record = cursor.fetchone()
        
        if not health_record:
            return jsonify({'error': 'Health record not found'}), 404
        
        # Process data for prediction
        # Convert gender to binary (0 for male, 1 for female)
        gender_value = 1 if user_data['sex'].lower() == 'female' else 0
        
        # Process allergies
        allergy_text = user_data['allergy'] or ''
        allergies = [item.strip().lower() for item in allergy_text.split(',')]
        
        # Specific allergies as used in the trained model
        allergy_mold = 0
        allergy_animal = 0
        allergy_aspirin = 0
        allergy_food = 0
        allergy_dust = 0
        allergy_pollen = 0
        
        # Перевіряємо кожну алергію окремо
        for item in allergies:
            # Перевірка на алергію цвілі
            if 'mold' in item or 'fungus' in item or 'fungi' in item:
                allergy_mold = 1
            # Перевірка на алергію на тварин
            if 'animal' in item or 'dander' in item or 'pet' in item or 'fur' in item or 'cat' in item or 'dog' in item:
                allergy_animal = 1
            # Перевірка на алергію на аспірин
            if 'aspirin' in item or 'nsaid' in item or 'ibuprofen' in item:
                allergy_aspirin = 1
            # Перевірка на харчову алергію
            if 'food' in item or 'egg' in item or 'milk' in item or 'nut' in item or 'wheat' in item or 'seafood' in item:
                allergy_food = 1
            # Перевірка на алергію на пил
            if 'dust' in item or 'mite' in item:
                allergy_dust = 1
            # Перевірка на алергію на пилок
            if 'pollen' in item or 'grass' in item or 'weed' in item or 'tree' in item:
                allergy_pollen = 1
                
        # Зберігаємо результати
        allergy_values = [
            allergy_mold,
            allergy_animal,
            allergy_aspirin,
            allergy_food,
            allergy_dust,
            allergy_pollen
        ]
        
        # Debugging - показуємо виявлені алергії
        print(f"Allergy text: {allergy_text}")
        print(f"Processed allergies: {allergies}")
        print(f"Detected allergies: Mold={allergy_mold}, Animal={allergy_animal}, Aspirin={allergy_aspirin}, Food={allergy_food}, Dust={allergy_dust}, Pollen={allergy_pollen}")
        
        # Process medicine info
        medicine_text = health_record['medicine'] or ''
        medicine_lower = medicine_text.lower()
        print(f"Medicine text: {medicine_text}")
        
        # Specific medications as used in the trained model
        budesonide = 1 if 'budesonide' in medicine_lower or 'pulmicort' in medicine_lower else 0
        fluticasone = 1 if 'fluticasone' in medicine_lower or 'flixotide' in medicine_lower or 'flovent' in medicine_lower else 0
        formoterol = 1 if 'formoterol' in medicine_lower or 'foradil' in medicine_lower or 'oxis' in medicine_lower or 'symbicort' in medicine_lower else 0
        ipratropium = 1 if 'ipratropium' in medicine_lower or 'atrovent' in medicine_lower else 0
        salbutamol = 1 if any(med in medicine_lower for med in ['salbutamol', 'albuterol', 'ventolin', 'proair', 'proventil']) else 0
        
        medicine_values = [
            budesonide,
            fluticasone,
            formoterol,
            ipratropium,
            salbutamol
        ]
        
        print(f"Detected medications: Budesonide={budesonide}, Fluticasone={fluticasone}, Formoterol={formoterol}, Ipratropium={ipratropium}, Salbutamol={salbutamol}")
    
        
        # Prepare feature vector according to the expected model order
        features = [
            int(user_data['age']),                  # Age
            gender_value,                           # Gender
            int(user_data['smoking']),              # Smoking
            float(health_record['FEV1']),           # FEV1
            float(health_record['FVC']),            # FVC
            int(health_record['PEF']),              # PEF
            int(health_record['respiratory_rate']), # Respiratory_Rate
            int(health_record['pulse']),            # Pulse
            int(health_record['cough']),            # Cough
            int(health_record['breathlessness']),   # Breathlessness
            int(health_record['wheezing']),         # Wheezing
            int(health_record['chest_tightness']),  # Chest_Tightness
            int(health_record['nighttime_awakenings']), # Nighttime_Awakenings
            allergy_mold,                           # Mold
            allergy_animal,                         # Animal_Dander
            allergy_aspirin,                        # Aspirin
            allergy_food,                           # Food
            allergy_dust,                           # Dust
            allergy_pollen,                         # Pollen
            budesonide,                             # Medication_Budesonide
            fluticasone,                            # Medication_Fluticasone
            formoterol,                             # Medication_Formoterol
            ipratropium,                            # Medication_Ipratropium
            salbutamol                              # Medication_Salbutamol
        ]

        # Debug output to verify the input data
        print(f"Feature vector shape: {len(features)}")
        print(f"Feature names: {FEATURE_NAMES}")
        print(f"Features: {features}")
        
        # ЗАВЖДИ спочатку спробуємо використати нейронну мережу
        risk_score = None
        neural_network_success = False
        
        # Спробуємо використати нейронну мережу, якщо вона доступна
        if use_ml_model:
            try:
                print("\n===== [NEURAL NETWORK] Attempting to use neural network for prediction... =====")
                with open('prediction_log.txt', 'a') as log_file:
                    log_file.write("Attempting to use neural network for prediction...\n")
                
                # Перевіряємо розмірність вектора ознак для уникнення помилок
                if len(features) != MODEL.input_shape[1]:
                    print(f"===== [ERROR] Feature vector size mismatch. Model expects {MODEL.input_shape[1]} features, but got {len(features)}. =====")
                    raise ValueError("Feature size mismatch")
                else:
                    print(f"===== [SUCCESS] Feature vector size matches model input: {len(features)} =====")
                
                # Підготовка даних для моделі
                features_array = np.array([features])
                print(f"===== [NEURAL NETWORK] Features array shape: {features_array.shape} =====")
                
                # Перевірка та нормалізація вхідних даних
                if SCALER is not None:
                    try:
                        print("===== [NEURAL NETWORK] Using SCALER for normalization =====")
                        # Додаємо моніторинг вхідних та нормалізованих даних для діагностики
                        print(f"===== [INPUT DATA] First 5 raw features: {features[:5]} =====")
                        features_array_scaled = SCALER.transform(features_array)
                        print(f"===== [NORMALIZED] First 5 normalized features: {features_array_scaled[0][:5]} =====")
                    except Exception as e:
                        print(f"===== [ERROR] SCALER.transform failed: {e} =====")
                        print("===== [FALLBACK] Using raw features instead =====")
                        features_array_scaled = features_array
                else:
                    print("===== [NEURAL NETWORK] SCALER not available, using raw features =====")
                    features_array_scaled = features_array
                
                # Прогнозування з обробкою помилок
                print("===== [NEURAL NETWORK] Making prediction... =====")
                with open('prediction_log.txt', 'a') as log_file:
                    log_file.write(f"Features array shape: {features_array.shape}\n")
                    
                prediction_prob = MODEL.predict(features_array_scaled)[0][0]
                print(f"===== [NEURAL NETWORK] Raw prediction probability: {prediction_prob:.6f} =====")
                with open('prediction_log.txt', 'a') as log_file:
                    log_file.write(f"Raw prediction probability: {prediction_prob:.6f}\n")
                
                # Perform SHAP analysis if available to understand what drives the prediction
                if SHAP_AVAILABLE:
                    shap_importance = perform_shap_analysis(MODEL, features_array_scaled, FEATURE_NAMES)
                    if shap_importance:
                        print("===== [NEURAL NETWORK] SHAP analysis completed successfully =====")
                        with open('prediction_log.txt', 'a') as log_file:
                            log_file.write("SHAP analysis performed successfully\n")
                    else:
                        print("===== [NEURAL NETWORK] SHAP analysis failed or was skipped =====")
                
                print("::::--------------------------------------------------")
                # Перевірка якості прогнозу - якщо результат близький до крайніх значень
                # для вхідних даних, які не мають бути такими, це може свідчити про проблеми моделі
                if (prediction_prob > 0.95 or prediction_prob < 0.05) and sum(features[8:13]) < 5:
                    print(f"===== [WARNING] Extreme prediction value detected: {prediction_prob:.4f} =====")
                    print(f"===== [WARNING] But symptom sum is only: {sum(features[8:13])} =====")
                    print("===== [WARNING] This may indicate model overfitting. Calculating rule-based score for comparison. =====")
                    with open('prediction_log.txt', 'a') as log_file:
                        log_file.write(f"Extreme prediction detected: {prediction_prob:.4f}, symptom sum: {sum(features[8:13])}\n")
                    
                    # Порівнюємо з правило-базованим підходом для впевненості
                    rule_score = calculate_risk(features) / 100.0
                    print(f"===== [COMPARISON] Neural network: {prediction_prob:.4f}, Rule-based: {rule_score:.4f} =====")
                    with open('prediction_log.txt', 'a') as log_file:
                        log_file.write(f"Neural network vs. Rule-based: {prediction_prob:.4f}, {rule_score:.4f}\n")
                    
                    # Якщо різниця занадто велика, використовуємо правило-базований підхід
                    if abs(prediction_prob - rule_score) > 0.4:
                        print(f"===== [DECISION] Large discrepancy between methods: {abs(prediction_prob - rule_score):.4f} =====")
                        print("===== [DECISION] Using rule-based prediction instead =====")
                        risk_score = rule_score * 100
                    else:
                        risk_score = prediction_prob * 100  # Приводимо до шкали 0–100%
                        neural_network_success = True
                        print(f"===== [DECISION] Neural network prediction accepted: {risk_score:.1f}% =====")
                        with open('prediction_log.txt', 'a') as log_file:
                            log_file.write(f"Neural network prediction successful: {risk_score:.1f}%\n")
                else:
                    risk_score = prediction_prob * 100  # Приводимо до шкали 0–100%
                    neural_network_success = True
                    print(f"===== [SUCCESS] Neural network prediction: {risk_score:.1f}% =====")
                    with open('prediction_log.txt', 'a') as log_file:
                        log_file.write(f"Neural network prediction successful: {risk_score:.1f}%\n")
                
            except Exception as e:
                print(f"===== [ERROR] Neural network prediction failed: {e} =====")
                with open('prediction_log.txt', 'a') as log_file:
                    log_file.write(f"ERROR: Neural network prediction failed: {e}\n")
                print("===== [FALLBACK] Falling back to rule-based approach =====")
                import traceback
                traceback.print_exc()
        else:
            print("===== [PREDICTION] Neural network not available, skipping attempt =====")
            
        print(":::--------------------------------------------------")
        # Якщо нейронна мережа не змогла зробити прогноз, використовуємо правило-базований підхід
        if risk_score is None or not neural_network_success:
            print("===== [RULE-BASED] Using rule-based approach for prediction =====")
            with open('prediction_log.txt', 'a') as log_file:
                log_file.write("Using rule-based approach for prediction\n")
            
            risk_score = calculate_risk(features)
            print(f"===== [RULE-BASED] Calculated risk score: {risk_score:.1f}% =====")
            with open('prediction_log.txt', 'a') as log_file:
                log_file.write(f"Rule-based risk score: {risk_score:.1f}%\n")
        
        # Determine risk level based on prediction
        if risk_score < 40:
            risk_level = "Low"
        elif risk_score <= 70:
            risk_level = "Medium"
        else:
            risk_level = "High"
        print(f"===== [RESULT] Final risk level: {risk_level}, score: {risk_score:.1f}% =====")
        with open('prediction_log.txt', 'a') as log_file:
            log_file.write(f"Final risk level: {risk_level}, score: {risk_score:.1f}%\n")
        
        # Calculate feature importance
        importance_values = {}
        
        # Use SHAP values for feature importance if we did a successful SHAP analysis
        if neural_network_success and SHAP_AVAILABLE and 'shap_importance' in locals() and shap_importance:
            importance_values = shap_importance
            print("===== [FEATURE IMPORTANCE] Using SHAP analysis results for feature importance =====")
            with open('prediction_log.txt', 'a') as log_file:
                log_file.write("Using SHAP analysis for feature importance\n")
        else:
            # Fallback to rule-based importance
            importance_values = calculate_feature_importance(features, FEATURE_NAMES)
            print("===== [FEATURE IMPORTANCE] Using rule-based approach for feature importance =====")
            with open('prediction_log.txt', 'a') as log_file:
                log_file.write("Using rule-based approach for feature importance\n")
        
        # ЗАВЖДИ використовуємо rule-based підхід для critical_features
        rule_based_importance = calculate_feature_importance(features, FEATURE_NAMES)
        
        # Get top 5 critical features
        critical_features = dict(sorted(rule_based_importance.items(), key=lambda x: x[1], reverse=True)[:5])
        critical_features_json = json.dumps(critical_features)
        
        # Check if prediction for this record already exists
        cursor.execute(
            """SELECT id FROM predictions 
               WHERE user_id = %s AND record_id = %s""",
            (user_id, record_id)
        )
        existing_prediction = cursor.fetchone()
        
        # Update or insert prediction
        current_time = datetime.datetime.now()
        print("::--------------------------------------------------")
        risk_score = float(risk_score)
        if existing_prediction:
            # Update existing prediction
            cursor.execute(
                """UPDATE predictions 
                   SET prediction_date = %s, risk_score = %s, risk_level = %s, critical_features = %s
                   WHERE id = %s""",
                (
                    current_time,
                    risk_score,
                    risk_level,
                    critical_features_json,
                    existing_prediction['id']
                )
            )
            prediction_id = existing_prediction['id']
            connection.commit()
        else:
            # Insert new prediction
            cursor.execute(
                """INSERT INTO predictions 
                   (user_id, prediction_date, risk_score, risk_level, critical_features, record_id) 
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (
                    user_id,
                    current_time,
                    risk_score,
                    risk_level,
                    critical_features_json,
                    record_id
                )
            )
            prediction_id = cursor.lastrowid
            connection.commit()
        
        print(":--------------------------------------------------")
        print(f"===== [FINAL] Returning prediction with risk score: {risk_score:.1f}%, method: {'neural_network' if neural_network_success else 'rule_based'} =====")
        with open('prediction_log.txt', 'a') as log_file:
            log_file.write(f"FINAL: Returning prediction with risk score: {risk_score:.1f}%, method: {'neural_network' if neural_network_success else 'rule_based'}\n")
            log_file.write(f"===== PREDICTION END: time={datetime.datetime.now()} =====\n\n")
        
        # Return prediction results
        return jsonify({
            'prediction_id': prediction_id,
            'risk_score': round(risk_score * 10) / 10,  # Округлюємо до одного знаку після коми
            'risk_level': risk_level,
            'critical_features': critical_features,
            'record_id': record_id,
            'prediction_method': 'neural_network' if neural_network_success else 'rule_based',
            'prediction_date': current_time.isoformat(),
            'is_updated': bool(existing_prediction)
        }), 200
        
    except Exception as e:
        print(f"Error in prediction: {e}")
        return jsonify({'error': 'Error during prediction processing'}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

def calculate_risk(features):
    """Enhanced clinical rule-based risk calculation for asthma exacerbation"""
    try:
        # Extract key values
        age = int(features[0])
        gender = int(features[1])  # 0 for male, 1 for female
        smoking = int(features[2])  # 0 or 1
        
        # Get lung function values
        fev1 = float(features[3])
        fvc = float(features[4])
        pef = int(features[5])
        
        # Get vital signs
        resp_rate = int(features[6])
        pulse = int(features[7])
        
        # Get symptoms (scored 0-5 typically)
        cough = int(features[8])
        breathlessness = int(features[9])
        wheezing = int(features[10])
        chest_tightness = int(features[11])
        night_awakenings = int(features[12])
        
        # Count allergies (indices 13-18)
        mold = int(features[13])
        animal_dander = int(features[14])
        aspirin = int(features[15])
        food = int(features[16])
        dust = int(features[17])
        pollen = int(features[18])
        allergies_count = mold + animal_dander + aspirin + food + dust + pollen
        
        # Medications (protective factors)
        budesonide = int(features[19])
        fluticasone = int(features[20])
        formoterol = int(features[21])
        ipratropium = int(features[22])
        salbutamol = int(features[23])
        preventive_meds = budesonide + fluticasone  # Контроль-препарати (інгаляційні стероїди)
        emergency_meds = formoterol + ipratropium + salbutamol  # Препарати негайної дії
        
        # Start with a base risk of 30%
        risk_score = 30
        
        # Clinical categorization - FEV1 as percent of predicted normal (using 3 liters as average adult normal)
        # In practice, this would use age/height/gender-specific norms
        fev1_percent = min(100, max(0, (fev1 / 3.0) * 100))
        print(f"FEV1: {fev1} L, estimated as {fev1_percent:.1f}% of predicted")
        
        # FEV1/FVC ratio - important clinical metric
        fev_fvc_ratio = fev1/fvc if fvc > 0 else 0
        print(f"FEV1/FVC ratio: {fev_fvc_ratio:.2f}")
        
        # Calculated symptom severity score (combining multiple symptoms)
        symptom_score = (breathlessness * 2 + wheezing * 1.5 + cough + chest_tightness + night_awakenings * 1.5) / 6
        print(f"Symptom severity score: {symptom_score:.1f}/5")
        
        # Age risk
        if age < 5:
            risk_score += 10  # Very young children
        elif age < 12:
            risk_score += 5   # Children
        elif age > 65:
            risk_score += 8   # Elderly
        elif age > 50:
            risk_score += 3   # Older adults
        
        # Gender adjustment (small effect in asthma)
        if gender == 0:  # Male
            risk_score += 1  # Slightly higher risk
        
        # Smoking - major risk factor
        if smoking == 1:
            risk_score += 12
        
        # Allergy factors - cumulative effect
        risk_score += allergies_count * 2
        # Specific allergies with higher impact
        if dust == 1:
            risk_score += 2  # Dust mites are a common trigger
        if pollen == 1 and (3 <= datetime.datetime.now().month <= 9):  # Pollen season (approx)
            risk_score += 3  # Seasonal effect
        
        # Lung function - nonlinear effects with thresholds based on clinical guidelines
        # FEV1 < 50% predicted is severe, <80% is moderate reduction
        if fev1_percent < 30:
            risk_score += 25  # Severe obstruction
        elif fev1_percent < 50:
            risk_score += 15  # Moderate-to-severe obstruction
        elif fev1_percent < 70:
            risk_score += 8   # Moderate obstruction
        elif fev1_percent < 80:
            risk_score += 3   # Mild obstruction
            
        # FEV1/FVC < 0.7 indicates obstruction
        if fev_fvc_ratio < 0.5:
            risk_score += 10  # Severe obstruction
        elif fev_fvc_ratio < 0.7:
            risk_score += 5   # Moderate obstruction
            
        # PEF - reduce risk if peak flow is good
        pef_percent = min(100, max(0, (pef / 450) * 100))  # Rough estimate of percent
        print(f"PEF: {pef} L/min, estimated as {pef_percent:.1f}% of predicted")
        
        if pef_percent < 40:
            risk_score += 15  # Severe reduction
        elif pef_percent < 60:
            risk_score += 8   # Moderate reduction
        elif pef_percent < 80:
            risk_score += 3   # Mild reduction
            
        # Vital signs
        if resp_rate > 28:
            risk_score += 12  # Severe tachypnea
        elif resp_rate > 24:
            risk_score += 8   # Moderate tachypnea
        elif resp_rate > 20:
            risk_score += 3   # Mild tachypnea
        
        if pulse > 120:
            risk_score += 10  # Severe tachycardia
        elif pulse > 100:
            risk_score += 5   # Moderate tachycardia
        elif pulse > 90:
            risk_score += 2   # Mild tachycardia
        
        # Symptoms - major predictors with nonlinear effects
        if breathlessness >= 4:
            risk_score += 15  # Severe breathlessness
        elif breathlessness >= 2:
            risk_score += breathlessness * 3  # Moderate breathlessness
        elif breathlessness > 0:
            risk_score += breathlessness * 2  # Mild breathlessness
            
        if wheezing >= 3:
            risk_score += 10  # Significant wheezing
        elif wheezing > 0:
            risk_score += wheezing * 2.5  # Some wheezing
            
        if cough >= 4:
            risk_score += 8  # Severe cough
        elif cough > 0:
            risk_score += cough * 1.5  # Some cough
            
        if chest_tightness >= 3:
            risk_score += 8  # Significant chest tightness
        elif chest_tightness > 0:
            risk_score += chest_tightness * 2  # Some chest tightness
            
        if night_awakenings >= 2:
            risk_score += night_awakenings * 4  # Night symptoms are significant
        elif night_awakenings > 0:
            risk_score += 3  # Any night symptoms
        
        # Symptom threshold effects - clinical guideline-based
        # Multiple moderate-severe symptoms indicate poor control
        if (breathlessness >= 2 and wheezing >= 2) or (breathlessness >= 2 and night_awakenings >= 1):
            risk_score += 5  # Combination of significant symptoms
        
        # Overall symptom score influence
        if symptom_score > 3:
            risk_score += 5  # Very high symptom burden
        
        # Medication effects - protective
        # People on appropriate treatment may have reduced risk
        if preventive_meds > 0:  # Controller medications
            reduction = 10 if preventive_meds > 1 else 6
            risk_score -= reduction
            
        # However, high reliance on rescue meds can indicate poor control
        if emergency_meds > 0:
            if symptom_score > 2:  # Using rescue meds with significant symptoms
                risk_score += 3
            else:  # Using rescue meds preventively
                risk_score -= 3
        
        # Final bounds for clinical realism - cap range to avoid extremes
        risk_score = min(max(risk_score, 5), 95)
        
        # Add small random variation for clinical realism
        import random
        risk_score += random.uniform(-2, 2)
        risk_score = min(max(risk_score, 5), 95)  # Re-enforce bounds
        
        # Округлюємо до одного десяткового знаку
        risk_score = round(risk_score * 10) / 10
        
        print(f"===== [RULE-BASED] Final calculated risk score: {risk_score:.1f}% =====")
        return risk_score
        
    except Exception as e:
        print(f"===== [ERROR] Error in risk calculation: {e} =====")
        # Return a default value in case of error (with one decimal place)
        return 50.0

def calculate_feature_importance(features, feature_names):
    """Calculate feature importance for the prediction using rule-based approach"""
    # Завжди використовуємо rule-based підхід, оскільки нейронна мережа не дає корисних значень
    return calculate_rule_based_importance(features, feature_names)

def calculate_rule_based_importance(features, feature_names):
    """Rule-based feature importance calculation with improved sensitivity to feature values"""
    # Define base importance for each feature
    base_importance = {
        'Breathlessness': 0.18,
        'FEV1': 0.15,
        'Wheezing': 0.12,
        'PEF': 0.10,
        'Cough': 0.09,
        'Smoking': 0.08,
        'Chest_Tightness': 0.07,
        'Nighttime_Awakenings': 0.07,
        'Respiratory_Rate': 0.06,
        'Pulse': 0.05,
        'Age': 0.05,
        'FVC': 0.04,
        'Dust': 0.03,
        'Pollen': 0.03,
        'Mold': 0.02,
        'Animal_Dander': 0.02,
        'Aspirin': 0.01,
        'Food': 0.01,
        'Medication_Budesonide': -0.03,
        'Medication_Fluticasone': -0.02,
        'Medication_Formoterol': -0.03,
        'Medication_Ipratropium': -0.02,
        'Medication_Salbutamol': -0.02,
        'Gender': 0.02
    }
    
    # Calculate importance based on feature values
    feature_importance = {}
    for i, name in enumerate(feature_names):
        if name in base_importance:
            # Нормалізуємо числові значення до діапазону 0-1 і множимо на базову важливість
            value = features[i]
            
            # Логіка важливості для різних типів ознак
            if name == 'FEV1':
                # Нижчий FEV1 означає вищу важливість (інвертована залежність)
                norm_value = max(0, min(1, 1 - (value / 5)))
                # Якщо FEV1 дуже низький, збільшуємо значення
                if value < 1.5:
                    norm_value = 1.0
                elif value < 2.5:
                    norm_value = 0.7
            elif name == 'FVC':
                # Нижчий FVC означає вищу важливість
                norm_value = max(0, min(1, 1 - (value / 6)))
            elif name == 'PEF':
                # Нижчий PEF означає вищу важливість
                norm_value = max(0, min(1, 1 - (value / 600)))
                # Якщо PEF дуже низький, збільшуємо значення
                if value < 200:
                    norm_value = 1.0
                elif value < 350:
                    norm_value = 0.7
            elif name in ['Respiratory_Rate', 'Pulse']:
                # Вищі значення означають вищу важливість
                if name == 'Respiratory_Rate':
                    norm_value = 0.3  # базове значення
                    if value > 25:  # тахіпное
                        norm_value = 1.0
                    elif value > 20:  # прискорене дихання
                        norm_value = 0.7
                    elif value < 12:  # сповільнене дихання
                        norm_value = 0.5
                else:  # Pulse
                    norm_value = 0.3  # базове значення
                    if value > 100:  # тахікардія
                        norm_value = 0.8
                    elif value > 90:  # прискорений пульс
                        norm_value = 0.6
            elif name == 'Age':
                # Екстремальні вікові групи мають вищу важливість
                age = value
                if age < 12 or age > 65:
                    norm_value = 0.8
                elif age < 18 or age > 50:
                    norm_value = 0.6
                else:
                    norm_value = 0.3
            elif name == 'Smoking':
                # Куріння - важливий фактор ризику
                norm_value = 1.0 if value > 0 else 0.0
            elif name.startswith('Medication_'):
                # Ліки зменшують ризик (інвертована залежність)
                norm_value = 0.0 if value > 0 else 1.0
            elif name in ['Breathlessness', 'Wheezing', 'Cough', 'Chest_Tightness', 'Nighttime_Awakenings']:
                # Симптоми (шкала 0-5) - найвищі ваги
                # Нелінійна шкала - вищі значення мають непропорційно більший вплив
                if value > 3:
                    norm_value = 1.0
                elif value > 1:
                    norm_value = 0.7 * value / 3
                elif value > 0:
                    norm_value = 0.4
                else:
                    norm_value = 0.0
            elif name in ['Mold', 'Animal_Dander', 'Aspirin', 'Food', 'Dust', 'Pollen']:
                # Алергії - бінарні значення
                norm_value = 1.0 if value > 0 else 0.0
            else:
                # Інші бінарні ознаки
                norm_value = min(1.0, value)
            
            # Розраховуємо кінцеву важливість і округляємо до 4 знаків
            importance = abs(base_importance[name]) * norm_value
            
            # Інвертуємо вплив ліків (вони зменшують ризик)
            if name.startswith('Medication_') and value > 0:
                importance = -importance
                
            feature_importance[name] = round(importance, 4)
    
    # Нормалізуємо важливості до суми 1.0 (тільки для позитивних значень)
    positive_sum = sum(v for v in feature_importance.values() if v > 0)
    negative_sum = sum(v for v in feature_importance.values() if v < 0)
    
    if positive_sum > 0:
        for name in feature_importance:
            if feature_importance[name] > 0:
                feature_importance[name] /= positive_sum
    
    # Для наочності залишаємо негативний вплив ліків без нормалізації
            
    # Логуємо для діагностики
    print("Rule-based importance calculation:")
    for name, importance in sorted(feature_importance.items(), key=lambda x: -abs(x[1])):
        value = features[feature_names.index(name)]
        print(f"{name}: value={value}, importance={importance:.4f}")
    
    return feature_importance

def perform_shap_analysis(model, features_normalized, feature_names):
    """
    Perform SHAP analysis on a prediction to see which features push the prediction higher
    
    Args:
        model: The neural network model
        features_normalized: Normalized feature vector (array shape [1, n_features])
        feature_names: List of feature names
    
    Returns:
        Dictionary with feature importance values
    """
    if not SHAP_AVAILABLE:
        print("===== [SHAP] SHAP not available, skipping analysis =====")
        return None
        
    try:
        print("\n===== [SHAP] Starting SHAP analysis =====")
        
        # Create a background dataset for SHAP (using zeros as baseline)
        # This simplifies interpretation - how much each feature contributes above baseline
        background = np.zeros((1, len(feature_names)))
        
        # Create SHAP explainer
        explainer = shap.DeepExplainer(model, background)
        
        # Calculate SHAP values
        shap_values = explainer.shap_values(features_normalized)
        
        # Process SHAP values (get first element if it's a list)
        if isinstance(shap_values, list):
            print(f"===== [SHAP] SHAP values is a list with length {len(shap_values)} =====")
            shap_values = shap_values[0]
            
        # Reshape if needed
        if len(shap_values.shape) == 3 and shap_values.shape[2] == 1:
            print(f"===== [SHAP] Reshaping 3D SHAP values from {shap_values.shape} to 2D =====")
            shap_values = shap_values.reshape(shap_values.shape[0], shap_values.shape[1])
            
        print(f"===== [SHAP] Final SHAP values shape: {shap_values.shape} =====")
        
        # Create a feature importance dictionary
        importance_dict = {}
        
        # Get the base value (explainer's expected value)
        if hasattr(explainer, 'expected_value'):
            base_value = explainer.expected_value
            if isinstance(base_value, list):
                base_value = base_value[0]
            base_value = float(base_value[0]) if isinstance(base_value, (np.ndarray, list)) else float(base_value)
            
            print(f"===== [SHAP] Base value: {base_value} =====")
        else:
            base_value = 0
            print("===== [SHAP] Using default base value: 0 =====")
        
        # Calculate actual prediction probability for comparison
        actual_prediction = model.predict(features_normalized)[0][0]
        actual_prediction = float(actual_prediction[0]) if isinstance(actual_prediction, (np.ndarray, list)) else float(actual_prediction)
        print("\n===== [SHAP] Feature impact analysis =====")
        print(f"===== [SHAP] Base value: {base_value:.4f}, prediction: {actual_prediction:.4f} =====")
        print("===== [SHAP] Features pushing prediction UP (positive impact): =====")
        
        # Store contributions by feature
        for i, feature_name in enumerate(feature_names):
            importance_dict[feature_name] = float(shap_values[0][i])
            
            # Print features that push the prediction up
            if shap_values[0][i] > 0:
                print(f"  {feature_name}: +{shap_values[0][i]:.6f}")
                
        # Print features pushing prediction down
        print("\n===== [SHAP] Features pushing prediction DOWN (negative impact): =====")
        for i, feature_name in enumerate(feature_names):
            if shap_values[0][i] < 0:
                print(f"  {feature_name}: {shap_values[0][i]:.6f}")
        
        # Show total contribution
        total_shap = np.sum(shap_values)
        print(f"\n===== [SHAP] Sum of SHAP values: {total_shap:.6f} =====")
        print(f"===== [SHAP] Prediction minus base value: {actual_prediction - base_value:.6f} =====")
        
        # Return the importance dictionary
        return importance_dict
        
    except Exception as e:
        print(f"===== [SHAP] Error in SHAP analysis: {e} =====")
        import traceback
        traceback.print_exc()
        return None

@app.route('/api/training-metrics', methods=['GET'])
def get_training_metrics():
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        
        # Get epoch metrics
        cursor.execute(
            """SELECT epoch, accuracy, auc, val_accuracy, val_auc, loss, val_loss 
               FROM training_metrics 
               WHERE epoch >= 0 
               ORDER BY epoch"""
        )
        epoch_metrics = cursor.fetchall()
        
        # Get final evaluation metrics - включити нові колонки precision_val, recall_val, і f1_score
        cursor.execute(
            """SELECT val_accuracy, val_auc, loss, val_loss, precision_val, recall_val, f1_score 
               FROM training_metrics 
               WHERE epoch = -1"""
        )
        final_metrics = cursor.fetchone()
        
        # Return formatted results
        return jsonify({
            'epoch_metrics': epoch_metrics,
            'final_metrics': final_metrics or {}
        }), 200
        
    except Exception as e:
        print(f"Error retrieving training metrics: {e}")
        return jsonify({'error': 'Error retrieving training metrics'}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/predictions/<int:user_id>', methods=['GET'])
def get_user_predictions(user_id):
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        
        # Check if user exists
        cursor.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        if not cursor.fetchone():
            return jsonify({'error': 'User not found'}), 404
        
        # Get predictions for this user
        cursor.execute(
            """SELECT p.id, p.prediction_date, p.risk_score, p.risk_level, 
                      p.critical_features, p.record_id, h.date as record_date
               FROM predictions p
               JOIN health_records h ON p.record_id = h.id
               WHERE p.user_id = %s
               ORDER BY p.prediction_date DESC""",
            (user_id,)
        )
        predictions = cursor.fetchall()
        
        # Convert datetime objects to strings for JSON serialization
        for prediction in predictions:
            prediction['prediction_date'] = prediction['prediction_date'].isoformat()
            prediction['record_date'] = prediction['record_date'].isoformat()
            
            # Parse JSON string of critical features
            if prediction['critical_features']:
                prediction['critical_features'] = json.loads(prediction['critical_features'])
        
        return jsonify(predictions), 200
        
    except Exception as e:
        print(f"Error retrieving predictions: {e}")
        return jsonify({'error': 'Error retrieving predictions'}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/model-plots/shap-summary', methods=['GET'])
def get_shap_summary_plot():
    try:
        # Шлях до згенерованого SHAP зображення
        plot_path = os.path.join(os.path.dirname(__file__), 'ml_data', 'shap_summary_plot.png')
        return send_file(plot_path, mimetype='image/png')
    except Exception as e:
        print(f"Error retrieving SHAP plot: {e}")
        return jsonify({'error': 'Failed to retrieve SHAP plot'}), 500

if __name__ == '__main__':
    app.run(debug=True) 