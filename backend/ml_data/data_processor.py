import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout, BatchNormalization
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, Callback
from sklearn.preprocessing import StandardScaler
import mysql.connector
from mysql.connector import Error
import json
from sklearn.metrics import precision_score, recall_score, f1_score
import datetime
import shap
import joblib
from tensorflow.keras.regularizers import l2

# Database configuration
db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': '',
    'database': 'asthma_monitor'
}

def get_db_connection():
    try:
        connection = mysql.connector.connect(**db_config)
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

# Custom callback to store training metrics
class TrainingMetricsCallback(Callback):
    def on_train_begin(self, logs=None):
        # Clear existing training metrics in database
        conn = get_db_connection()
        if conn:
            try:
                # Start transaction
                conn.start_transaction()
                
                cursor = conn.cursor()
                cursor.execute("DELETE FROM training_metrics")
                
                # Verify deletion
                cursor.execute("SELECT COUNT(*) FROM training_metrics")
                count = cursor.fetchone()[0]
                
                if count == 0:
                    # Commit if deletion was successful
                    conn.commit()
                    print("Cleared previous training metrics")
                else:
                    # Rollback if not all records were deleted
                    conn.rollback()
                    print("WARNING: Failed to clear all previous training metrics")
            except Error as e:
                if conn.is_connected():
                    conn.rollback()
                print(f"Error clearing training metrics: {e}")
                # Log the error for debugging
                try:
                    with open('ml_training_errors.log', 'a') as error_log:
                        error_log.write(f"{datetime.datetime.now()}: Error clearing metrics - {str(e)}\n")
                except:
                    pass
            finally:
                if conn.is_connected():
                    cursor.close()
                    conn.close()
    
    def on_epoch_end(self, epoch, logs=None):
        logs = logs or {}
        
        # Store metrics in database
        conn = get_db_connection()
        if conn:
            try:
                # Start transaction
                conn.start_transaction()
                
                cursor = conn.cursor()
                
                # Insert metrics for this epoch
                cursor.execute(
                    """INSERT INTO training_metrics 
                       (epoch, accuracy, auc, val_accuracy, val_auc, loss, val_loss) 
                       VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                    (
                        epoch + 1,  # Epoch (1-indexed)
                        logs.get('accuracy', 0),
                        logs.get('auc', 0),
                        logs.get('val_accuracy', 0),
                        logs.get('val_auc', 0),
                        logs.get('loss', 0),
                        logs.get('val_loss', 0)
                    )
                )
                
                # Verify the insertion
                cursor.execute("SELECT COUNT(*) FROM training_metrics WHERE epoch = %s", (epoch + 1,))
                count = cursor.fetchone()[0]
                
                if count > 0:
                    # Commit if insertion was successful
                    conn.commit()
                    print(f"Saved metrics for epoch {epoch + 1}")
                else:
                    # Rollback if verification failed
                    conn.rollback()
                    print(f"WARNING: Failed to save metrics for epoch {epoch + 1}")
            except Error as e:
                if conn.is_connected():
                    conn.rollback()
                print(f"Error saving training metrics: {e}")
                # Log the error for debugging
                try:
                    with open('ml_training_errors.log', 'a') as error_log:
                        error_log.write(f"{datetime.datetime.now()}: Error saving epoch {epoch + 1} metrics - {str(e)}\n")
                except:
                    pass
            finally:
                if conn.is_connected():
                    cursor.close()
                    conn.close()
    

class AsthmaDataProcessor:
    def __init__(self, file_path):
        self.file_path = file_path
        self.data = None
        self.patients_data = {}
        self.scaler = StandardScaler()
        self.feature_names = None
        
    def load_data(self):
        """Load data from Excel file and perform initial preprocessing"""
        try:
            self.data = pd.read_excel(self.file_path)
            print(f"Data loaded successfully. Shape: {self.data.shape}")
            print("Class distribution (Exacerbation = 0/1):")
            print(self.data['Exacerbation'].value_counts())
            
            # Expected columns from the Excel file
            expected_columns = [
                'ID', 'Record_Date', 'Age', 'Gender', 'Smoking', 
                'FEV1', 'FVC', 'PEF', 'Respiratory_Rate', 'Pulse',
                'Cough', 'Breathlessness', 'Wheezing', 'Chest_Tightness', 
                'Nighttime_Awakenings', 'Mold', 'Animal_Dander', 'Aspirin', 
                'Food', 'Dust', 'Pollen', 'Medication_Budesonide', 
                'Medication_Fluticasone', 'Medication_Formoterol', 
                'Medication_Ipratropium', 'Medication_Salbutamol', 'Exacerbation'
            ]
            
            # Check if the file has the expected columns
            if set(expected_columns).issubset(set(self.data.columns)):
                # Use only required columns in the correct order
                self.data = self.data[expected_columns]
            else:
                # If column names don't match, assume they're in the right order and rename
                self.data.columns = expected_columns
            
            print("Column names after processing:")
            print(self.data.columns.tolist())
            
            # Convert dates to datetime objects
            self.data['Record_Date'] = pd.to_datetime(self.data['Record_Date'])
            
            # Sort data by ID and date
            self.data = self.data.sort_values(['ID', 'Record_Date'])
            
            # Drop rows with missing values or handle them
            missing_counts = self.data.isnull().sum()
            print("\nMissing values before handling:")
            print(missing_counts[missing_counts > 0])
            
            # For this exercise, we'll drop rows with missing values in key columns
            key_features = ['FEV1', 'FVC', 'PEF', 'Exacerbation']
            self.data = self.data.dropna(subset=key_features)
            
            # Fill remaining missing values with appropriate defaults
            numeric_cols = self.data.select_dtypes(include=['float64', 'int64']).columns
            for col in numeric_cols:
                if col not in key_features:
                    self.data[col] = self.data[col].fillna(self.data[col].median())
            
            print(f"Data shape after handling missing values: {self.data.shape}")
            
            return True
        except Exception as e:
            print(f"Error loading data: {str(e)}")
            return False
    
    def split_by_patients(self):
        """Split data by patient IDs"""
        if self.data is None:
            print("Please load data first using load_data()")
            return
        
        unique_patients = self.data['ID'].unique()
        print(f"Found {len(unique_patients)} unique patients")
        
        for patient_id in unique_patients:
            patient_data = self.data[self.data['ID'] == patient_id].copy()
            self.patients_data[patient_id] = patient_data
            
        return self.patients_data
    
    def prepare_model_data(self):
        """Prepare data for the neural network model"""
        if not self.patients_data:
            print("Please split data by patients first using split_by_patients()")
            return None, None
        
        # Split patients into training and testing sets
        patient_ids = list(self.patients_data.keys())
        train_ids, test_ids = train_test_split(
            patient_ids, 
            test_size=0.2, 
            random_state=42
        )
        
        # Combine data for train and test sets
        train_data = pd.concat([self.patients_data[pid] for pid in train_ids])
        test_data = pd.concat([self.patients_data[pid] for pid in test_ids])
        
        # Define features and target
        feature_cols = [
            'Age', 'Gender', 'Smoking', 'FEV1', 'FVC', 'PEF', 
            'Respiratory_Rate', 'Pulse', 'Cough', 'Breathlessness', 
            'Wheezing', 'Chest_Tightness', 'Nighttime_Awakenings', 
            'Mold', 'Animal_Dander', 'Aspirin', 'Food', 'Dust', 'Pollen',
            'Medication_Budesonide', 'Medication_Fluticasone', 
            'Medication_Formoterol', 'Medication_Ipratropium', 
            'Medication_Salbutamol'
        ]
        
        target_col = 'Exacerbation'
        
        # Extract features and target
        X_train = train_data[feature_cols].values
        y_train = train_data[target_col].values
        X_test = test_data[feature_cols].values
        y_test = test_data[target_col].values
        
        print(f"[CHECK] Частка позитивного класу у train: {np.mean(y_train):.4f}")
        print(f"[CHECK] Частка позитивного класу у test:  {np.mean(y_test):.4f}")

        # Standardize features
        X_train = self.scaler.fit_transform(X_train)
        X_test = self.scaler.transform(X_test)
        joblib.dump(self.scaler, 'scaler.joblib')

        print("Середні значення нормалізованих симптомів (Cough, Breathlessness, Wheezing, Chest_Tightness, Nighttime_Awakenings):")
        print(X_train[:, 8:13].mean(axis=0))
        
        print(f"Training set shape: X={X_train.shape}, y={y_train.shape}")
        print(f"Testing set shape: X={X_test.shape}, y={y_test.shape}")
        
        self.feature_names = feature_cols
        
        # Зберігаємо тестовий набір даних для подальшого використання в SHAP аналізі
        self.X_train = X_train
        self.y_train = y_train
        self.X_test = X_test
        self.y_test = y_test
        
        # Створюємо вибірку тестових даних для SHAP аналізу
        if X_test.shape[0] > 100:
            self.X_test_sample = X_test[:100]  # Обмежуємо до 100 зразків для швидкості
        else:
            self.X_test_sample = X_test
        
        print(f"SHAP test sample size: {self.X_test_sample.shape}")
        
        return (X_train, y_train), (X_test, y_test), feature_cols
    
    def build_model(self, input_dim):
        """Build a MLP neural network model with L2 regularization and increased dropout"""
        model = Sequential([
            Dense(32, activation='relu', input_shape=(input_dim,), 
                  kernel_regularizer=l2(0.05), bias_regularizer=l2(0.05)),
            BatchNormalization(),
            Dropout(0.5),
            Dense(16, activation='relu', 
                  kernel_regularizer=l2(0.05), bias_regularizer=l2(0.05)),
            BatchNormalization(),
            Dropout(0.4), 
            Dense(8, activation='relu', 
                  kernel_regularizer=l2(0.05), bias_regularizer=l2(0.05)),
            BatchNormalization(),
            Dense(1, activation='sigmoid')
        ])
        
        model.compile(
            optimizer=Adam(learning_rate=0.0005),
            loss='binary_crossentropy',
            metrics=['accuracy', tf.keras.metrics.AUC()]
        )
        
        print("===== Архітектура нейронної мережі з L2 регуляризацією, BatchNormalization та збільшеним Dropout =====")
        print(model.summary())
        return model
    
    def train_model(self, model, X_train, y_train, X_test, y_test):
        """Train the neural network model"""
        # Create metrics callback
        metrics_callback = TrainingMetricsCallback()
        
        callbacks = [
            EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True),
            ModelCheckpoint('best_asthma_model.h5', save_best_only=True, monitor='val_loss'),
            metrics_callback
        ]
        
        history = model.fit(
            X_train, y_train,
            validation_data=(X_test, y_test),
            epochs=30,
            batch_size=32,
            callbacks=callbacks,
            verbose=1
        )
        
        # Evaluate the model on test data
        test_loss, test_acc, test_auc = model.evaluate(X_test, y_test)
        print(f"\nTest accuracy: {test_acc:.4f}")
        print(f"Test AUC: {test_auc:.4f}")
        
        # Calculate additional metrics
        y_pred_prob = model.predict(X_test)
        y_pred = (y_pred_prob > 0.5).astype(int)
        
        # Calculate precision, recall, F1 score
        precision = precision_score(y_test, y_pred)
        recall = recall_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred)
        
        # Print these metrics
        print(f"Precision: {precision:.4f}")
        print(f"Recall: {recall:.4f}")
        print(f"F1 Score: {f1:.4f}")
        
        # Get final training values from history
        final_train_acc = history.history['accuracy'][-1] if history.history['accuracy'] else 0
        final_train_auc = history.history['auc'][-1] if history.history['auc'] else 0
        final_train_loss = history.history['loss'][-1] if history.history['loss'] else 0
        
        # Save final evaluation metrics with all columns
        conn = get_db_connection()
        if conn:
            try:
                # Start transaction
                conn.start_transaction()
                
                cursor = conn.cursor()
                
                # Insert final evaluation metrics including precision_val, recall_val, f1_score
                cursor.execute(
                    """INSERT INTO training_metrics 
                       (epoch, accuracy, auc, val_accuracy, val_auc, loss, val_loss, precision_val, recall_val, f1_score) 
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (
                        -1,  # Special epoch value to indicate final metrics
                        final_train_acc,  # Use actual final training accuracy
                        final_train_auc,  # Use actual final training AUC
                        test_acc,
                        test_auc,
                        final_train_loss, # Use actual final training loss
                        test_loss,
                        precision, # Save precision as precision_val
                        recall,    # Save recall as recall_val 
                        f1         # Save f1 as f1_score
                    )
                )
                
                # Verify the insertion
                cursor.execute("""SELECT * FROM training_metrics WHERE epoch = -1""")
                verification = cursor.fetchone()
                
                if verification:
                    # Commit the transaction if verification succeeded
                    conn.commit()
                    print("Saved and verified final evaluation metrics with precision, recall, and f1 score")
                else:
                    # Rollback if verification failed
                    conn.rollback()
                    print("ERROR: Failed to save final metrics - verification failed")
            except Error as e:
                # Rollback in case of error
                conn.rollback()
                print(f"Error saving final metrics: {e}")
                # Try to log error details for debugging
                try:
                    with open('ml_training_errors.log', 'a') as error_log:
                        error_log.write(f"{datetime.datetime.now()}: Error saving metrics - {str(e)}\n")
                except:
                    pass
            finally:
                if conn.is_connected():
                    cursor.close()
                    conn.close()
        
        return history
    
    def analyze_feature_importance(self, model, feature_names):
        """Analyze feature importance using SHAP values"""
        # Створюємо пакет тестових даних для пояснення моделі (використовуємо 100 записів)
        # У реальному додатку тут буде набір тестових даних з prepare_model_data
        if not hasattr(self, 'X_test_sample') or self.X_test_sample is None:
            print("Creating test sample for SHAP explanations...")
            # Використовуємо збережений X_test або створюємо тестовий датасет
            if hasattr(self, 'X_test') and self.X_test is not None:
                # Обмежуємо кількість зразків для продуктивності
                self.X_test_sample = self.X_test[:100]
            else:
                print("Warning: No test data available. Please run prepare_model_data first.")
                # Створюємо штучний набір даних як резервний варіант
                self.X_test_sample = np.random.rand(100, len(feature_names))
        
        try:
            # Створюємо SHAP explainer
            background = self.X_test_sample[:50]  # Використовуємо перші 50 записів як тло
            
            # Переконуємося, що background має правильну форму (2D array)
            if len(background.shape) != 2:
                print(f"Reshaping background data from {background.shape}")
                background = background.reshape(background.shape[0], -1)
                
            print(f"Background shape for DeepExplainer: {background.shape}")
            deep_explainer = shap.DeepExplainer(model, background)
            
            # Переконуємося, що тестовий зразок має правильну форму (2D array)
            test_sample = self.X_test_sample
            if len(test_sample.shape) != 2:
                print(f"Reshaping test sample from {test_sample.shape}")
                test_sample = test_sample.reshape(test_sample.shape[0], -1)
                
            print(f"Test sample shape for shap_values: {test_sample.shape}")
            
            # Обчислюємо SHAP values для тестового набору
            shap_values = deep_explainer.shap_values(test_sample)
            
            # SHAP values повертаються як список для кожного виходу,
            # в нашому випадку це бінарна класифікація, тому беремо перший елемент
            if isinstance(shap_values, list):
                print(f"SHAP values is a list with length {len(shap_values)}")
                for i, sv in enumerate(shap_values):
                    print(f"Shape of shap_values[{i}]: {sv.shape}")
                shap_values = shap_values[0]
            
            print(f"Final SHAP values shape: {shap_values.shape}")
            
            # Виправляємо проблему з 3D-масивом SHAP values (100, 24, 1)
            if len(shap_values.shape) == 3 and shap_values.shape[2] == 1:
                print(f"Reshaping 3D SHAP values from {shap_values.shape} to 2D")
                shap_values = shap_values.reshape(shap_values.shape[0], shap_values.shape[1])
                print(f"Reshaped SHAP values shape: {shap_values.shape}")
            
            # Обчислюємо середнє абсолютне значення SHAP для кожної ознаки
            feature_importance = np.mean(np.abs(shap_values), axis=0)
            
            print(f"Feature importance shape: {feature_importance.shape}")
            
            # Переконуємося, що feature_importance має правильну форму (1D array з довжиною feature_names)
            if len(feature_importance) != len(feature_names):
                print(f"Warning: Feature importance length ({len(feature_importance)}) doesn't match feature names length ({len(feature_names)})")
                # Якщо потрібно, обрізаємо або доповнюємо
                if len(feature_importance) > len(feature_names):
                    feature_importance = feature_importance[:len(feature_names)]
                    print(f"Truncated feature importance to length {len(feature_importance)}")
            
            # Створюємо DataFrame для відображення важливості ознак
            importance_df = pd.DataFrame({
                'Feature': feature_names,
                'Importance': feature_importance
            })
            
            # Сортуємо за важливістю
            importance_df = importance_df.sort_values('Importance', ascending=False)
            
            print("\nFeature Importance (SHAP):")
            print(importance_df.head(10))  # Показуємо топ-10 ознак
            
            # Зберігаємо SHAP explainer та values для подальшого використання
            self.shap_explainer = deep_explainer
            self.shap_values = shap_values
            self.feature_importance_df = importance_df
            
            # Візуалізація SHAP summary plot (опціонально)
            try:
                if test_sample is not None:
                    print("Saving SHAP summary plot...")
                    shap.summary_plot(
                        shap_values, 
                        test_sample, 
                        feature_names=feature_names,
                        show=False
                    )
                    import matplotlib.pyplot as plt
                    plt.savefig('shap_summary_plot.png', bbox_inches='tight')
                    plt.close()
                    print("SHAP summary plot saved as 'shap_summary_plot.png'")
            except Exception as e:
                print(f"Failed to create SHAP visualization: {e}")
            
            return importance_df
        
        except Exception as e:
            print(f"Error in SHAP analysis: {e}")
            # Якщо SHAP не працює, повертаємось до базового методу
            print("Falling back to basic feature importance calculation...")
            
            # Простий метод на основі ваг першого шару
            weights = model.layers[0].get_weights()[0]
            feature_importance = np.mean(np.abs(weights), axis=1)
            
            importance_df = pd.DataFrame({
                'Feature': feature_names,
                'Importance': feature_importance
            })
            
            importance_df = importance_df.sort_values('Importance', ascending=False)
            print("\nFeature Importance (Fallback method):")
            print(importance_df.head(10))
            
            return importance_df
    
    def save_prediction(self, user_id, features, prediction, record_id):
        """Save prediction to database"""
        risk_score = float(prediction)
        
        # Determine risk level
        if risk_score < 0.4:
            risk_level = "Low"
        elif risk_score <= 0.7:
            risk_level = "Medium"
        else:
            risk_level = "High"
        
        # Get top 5 critical features
        if self.feature_names is not None:
            try:
                # Перевіряємо чи є доступним SHAP explainer
                if hasattr(self, 'shap_explainer') and self.shap_explainer is not None:
                    # Підготовлюємо дані для пояснення
                    features_array = np.array([features])
                    
                    # Переконуємося, що features_array має правильну форму (2D array)
                    if len(features_array.shape) != 2:
                        print(f"Reshaping features_array from {features_array.shape}")
                        features_array = features_array.reshape(1, -1)
                    
                    print(f"Features array shape for SHAP: {features_array.shape}")
                    
                    # Отримуємо SHAP values для цього конкретного прогнозу
                    shap_values = self.shap_explainer.shap_values(features_array)
                    
                    # Якщо SHAP values - список, беремо перший елемент (для бінарної класифікації)
                    if isinstance(shap_values, list):
                        print(f"SHAP values is a list with length {len(shap_values)}")
                        shap_values = shap_values[0]
                    
                    print(f"SHAP values shape: {shap_values.shape}")
                    
                    # Виправляємо проблему з 3D-масивом SHAP values
                    if len(shap_values.shape) == 3 and shap_values.shape[2] == 1:
                        print(f"Reshaping 3D SHAP values from {shap_values.shape} to 2D")
                        shap_values = shap_values.reshape(shap_values.shape[0], shap_values.shape[1])
                        print(f"Reshaped SHAP values shape: {shap_values.shape}")
                    
                    # Створюємо словник важливості ознак на основі SHAP values
                    feature_importance = {}
                    
                    for i, feature_name in enumerate(self.feature_names):
                        # Беремо абсолютне значення SHAP value
                        importance = float(abs(shap_values[0][i]))
                        feature_importance[feature_name] = importance
                    
                    print("Using SHAP values for feature importance calculation")
                else:
                    # Запасний варіант, якщо SHAP explainer недоступний
                    # Для простого наближення використовуємо ваги першого шару
                    weights = self.model.layers[0].get_weights()[0]
                    
                    feature_importance = {}
                    for i, feature_name in enumerate(self.feature_names):
                        # Множимо значення ознаки на її ваговий вплив
                        importance = abs(features[i] * np.mean(np.abs(weights[i])))
                        feature_importance[feature_name] = float(importance)
                    
                    print("Using weights-based feature importance calculation")
                
                # Сортуємо за важливістю та вибираємо top 5
                critical_features = dict(sorted(feature_importance.items(), 
                                              key=lambda item: item[1], 
                                              reverse=True)[:5])
            except Exception as e:
                print(f"Error calculating feature importance: {e}")
                critical_features = {}
        else:
            critical_features = {}
        
        # Convert critical features to JSON
        critical_features_json = json.dumps(critical_features)
        
        # Save to database
        conn = get_db_connection()
        if conn:
            try:
                cursor = conn.cursor()
                
                # Insert prediction
                cursor.execute(
                    """INSERT INTO predictions 
                       (user_id, prediction_date, risk_score, risk_level, critical_features, record_id) 
                       VALUES (%s, %s, %s, %s, %s, %s)""",
                    (
                        user_id,
                        datetime.datetime.now(),
                        risk_score,
                        risk_level,
                        critical_features_json,
                        record_id
                    )
                )
                prediction_id = cursor.lastrowid
                conn.commit()
                print(f"Saved prediction (ID: {prediction_id}) for user {user_id}")
                return prediction_id
            except Error as e:
                print(f"Error saving prediction: {e}")
            finally:
                if conn.is_connected():
                    cursor.close()
                    conn.close()
        
        return None

def main():
    # Path to your Excel file
    excel_file = '../asthma_data.xlsx'
    
    # Initialize processor
    processor = AsthmaDataProcessor(excel_file)
    
    # Process data
    if processor.load_data():
        processor.split_by_patients()
        
        # Prepare data for model
        (X_train, y_train), (X_test, y_test), feature_names = processor.prepare_model_data()
        
        # Build and train model
        model = processor.build_model(input_dim=len(feature_names))
        history = processor.train_model(model, X_train, y_train, X_test, y_test)
        
        # Analyze feature importance
        processor.analyze_feature_importance(model, feature_names)
        
        print("\nModel training complete. The model can now be used for asthma exacerbation prediction.")
        print("The model is saved as 'best_asthma_model.h5'.")

if __name__ == "__main__":
    main()