# backend/ml/models/anomaly_detector.py
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from data.dataset_builder import build_asset_dataset, FEATURE_COLS

MODEL_PATH = 'trained/anomaly_detector.pkl'

def train():
    df = build_asset_dataset()
    if len(df) < 10:
        print('[AnomalyDetector] Pas assez de données.')
        return

    X = df[FEATURE_COLS].fillna(0).values
    model = IsolationForest(
        n_estimators=100,
        contamination=0.1,   # 10% d'anomalies attendues
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X)

    os.makedirs('trained', exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f'[AnomalyDetector ML] Modèle entraîné sur {len(df)} assets.')

def predict(features: dict) -> dict:
    if not os.path.exists(MODEL_PATH):
        return {'is_anomaly': False, 'anomaly_score': 0.0}

    model = joblib.load(MODEL_PATH)
    X = pd.DataFrame([features])[FEATURE_COLS].fillna(0).values
    # score_samples retourne un score négatif — plus négatif = plus anormal
    raw_score = float(model.score_samples(X)[0])
    # Normaliser : score entre 0 (normal) et 100 (très anormal)
    anomaly_score = round(max(0, min(100, (-raw_score - 0.3) * 200)), 1)
    is_anomaly = model.predict(X)[0] == -1

    return {
        'is_anomaly':    is_anomaly,
        'anomaly_score': anomaly_score,
    }