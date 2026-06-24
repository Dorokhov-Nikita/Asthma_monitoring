import numpy as np
import pandas as pd
import os
import json
import matplotlib.pyplot as plt
import shap
import tensorflow as tf
import joblib

def test_shap_analysis():
    """Create a more comprehensive SHAP analysis for model interpretability"""
    print("Running comprehensive SHAP analysis...")
    
    # Load the model if available
    model_path = os.path.join(os.path.dirname(__file__), 'best_asthma_model.h5')
    if not os.path.exists(model_path):
        print(f"Model file not found: {model_path}")
        return
    
    # Load the model
    try:
        model = tf.keras.models.load_model(model_path)
        print("Model loaded successfully")
    except Exception as e:
        print(f"Error loading model: {e}")
        return
    
    # Feature names based on the expected model input
    feature_names = [
        'Age', 'Gender', 'Smoking', 
        'FEV1', 'FVC', 'PEF', 
        'Respiratory_Rate', 'Pulse',
        'Cough', 'Breathlessness', 'Wheezing', 'Chest_Tightness', 'Nighttime_Awakenings',
        'Mold', 'Animal_Dander', 'Aspirin', 'Food', 'Dust', 'Pollen',
        'Medication_Budesonide', 'Medication_Fluticasone', 'Medication_Formoterol', 'Medication_Ipratropium', 'Medication_Salbutamol'
    ]
    
    # Load the scaler if available
    scaler_path = os.path.join(os.path.dirname(__file__), 'scaler.joblib')
    scaler = None
    if os.path.exists(scaler_path):
        try:
            scaler = joblib.load(scaler_path)
            print("Scaler loaded successfully")
        except Exception as e:
            print(f"Error loading scaler: {e}")
    
    # Create test data - one standard patient and various modifications
    base_patient = np.zeros((1, len(feature_names)))
    
    # Standard patient with moderate symptoms
    base_patient[0, 0] = 45  # Age
    base_patient[0, 1] = 0   # Male (0)
    base_patient[0, 2] = 0   # Non-smoker
    base_patient[0, 3] = 2.5  # FEV1
    base_patient[0, 4] = 3.5  # FVC
    base_patient[0, 5] = 400  # PEF
    base_patient[0, 6] = 18   # Respiratory_Rate
    base_patient[0, 7] = 80   # Pulse
    # All symptoms at moderate level (2)
    base_patient[0, 8:13] = 2
    
    # Create 10 test patients with variations
    test_patients = []
    descriptions = []
    
    # 1. Base patient
    test_patients.append(base_patient.copy())
    descriptions.append("Base patient (moderate symptoms)")
    
    # 2. High symptom patient
    high_symptoms = base_patient.copy()
    high_symptoms[0, 8:13] = 4  # High symptoms (4/5)
    test_patients.append(high_symptoms)
    descriptions.append("High symptoms (4/5)")
    
    # 3. Poor lung function
    poor_lung = base_patient.copy()
    poor_lung[0, 3] = 1.5  # Low FEV1
    poor_lung[0, 4] = 2.5  # Low FVC
    poor_lung[0, 5] = 250  # Low PEF
    test_patients.append(poor_lung)
    descriptions.append("Poor lung function")
    
    # 4. Elderly smoker
    elderly_smoker = base_patient.copy()
    elderly_smoker[0, 0] = 70  # Age
    elderly_smoker[0, 2] = 1   # Smoker
    test_patients.append(elderly_smoker)
    descriptions.append("Elderly smoker")
    
    # 5. Multiple allergies
    allergic = base_patient.copy()
    allergic[0, 13:19] = 1  # All allergies
    test_patients.append(allergic)
    descriptions.append("Multiple allergies")
    
    # Combine all test patients into a single array
    X_test = np.vstack(test_patients)
    
    # Apply scaling if available
    if scaler is not None:
        X_test_scaled = scaler.transform(X_test)
    else:
        X_test_scaled = X_test
    
    # Create a background dataset (all zeros)
    background = np.zeros((1, len(feature_names)))
    
    # Run SHAP analysis
    try:
        # Create explainer
        explainer = shap.DeepExplainer(model, background)
        
        # Calculate SHAP values
        shap_values = explainer.shap_values(X_test_scaled)
        
        # Process SHAP values (they come as a list for binary classification)
        if isinstance(shap_values, list):
            shap_values = shap_values[0]
        
        # Print detailed SHAP analysis
        print("\n===== SHAP Analysis Results =====")
        for i, description in enumerate(descriptions):
            prediction = model.predict(X_test_scaled[i:i+1])[0][0]
            print(f"\nPatient: {description}")
            print(f"Prediction: {prediction:.4f} ({prediction*100:.1f}%)")
            
            # Get top 5 features by absolute SHAP value
            feature_impacts = [(feature_names[j], shap_values[i, j]) for j in range(len(feature_names))]
            sorted_impacts = sorted(feature_impacts, key=lambda x: abs(x[1]), reverse=True)
            
            print("Top 5 influential features:")
            for feature, impact in sorted_impacts[:5]:
                direction = "INCREASES" if impact > 0 else "DECREASES"
                print(f"  {feature}: {impact:.4f} ({direction} risk)")
        
        # Create a summary plot of feature importance
        plt.figure(figsize=(10, 8))
        shap.summary_plot(shap_values, X_test, feature_names=feature_names, show=False)
        plt.tight_layout()
        plt.savefig('shap_summary_plot.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        # Save global feature importance
        mean_abs_shap = np.mean(np.abs(shap_values), axis=0)
        importance_df = pd.DataFrame({
            'Feature': feature_names,
            'Importance': mean_abs_shap
        }).sort_values('Importance', ascending=False)
        
        importance_json = importance_df.to_json(orient='records')
        with open('feature_importance.json', 'w') as f:
            f.write(importance_json)
        
        print("\n===== SHAP Analysis Complete =====")
        print(f"Summary plot saved to shap_summary_plot.png")
        print(f"Feature importance saved to feature_importance.json")
        
    except Exception as e:
        print(f"Error in SHAP analysis: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_shap_analysis() 