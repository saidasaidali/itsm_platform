# backend/ml/models/risk_scorer.py
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import MinMaxScaler
from data.dataset_builder import build_asset_dataset, FEATURE_COLS

MODEL_PATH  = 'trained/risk_scorer.pkl'
SCALER_PATH = 'trained/risk_scaler.pkl'

def train():
    df = build_asset_dataset()
    if len(df) < 10:
        print('[RiskScorer] Pas assez de données pour entraîner (minimum 10 assets).')
        return

    X = df[FEATURE_COLS].values

    # Score de risque = combinaison pondérée de features normalisées
    # Pas besoin d'un label externe — on calcule un proxy heuristique
    # que le modèle apprend à reproduire et extrapoler
    risk_proxy = (
        df['tickets_6m']             * 10 +
        df['high_priority_6m']       * 20 +
        df['anomalies_3m']           * 15 +
        df['high_severity_anomalies']* 20 +
        df['cpu_usage'].clip(0, 100) * 0.1 +
        df['disk_usage_pct'].clip(0, 100) * 0.15 +
        df['age_years']              * 3
    )

    # Normaliser entre 0 et 100
    scaler = MinMaxScaler(feature_range=(0, 100))
    y = scaler.fit_transform(risk_proxy.values.reshape(-1, 1)).ravel()

    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=8,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X, y)

    os.makedirs('trained', exist_ok=True)
    joblib.dump(model,  MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    print(f'[RiskScorer] Modèle entraîné sur {len(df)} assets.')

def predict(features: dict) -> float:
    if not os.path.exists(MODEL_PATH):
        # Modèle pas encore entraîné : score heuristique de secours
        return _heuristic_score(features)

    model  = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    X = pd.DataFrame([features])[FEATURE_COLS].fillna(0).values
    raw = model.predict(X)[0]
    score = float(np.clip(raw, 0, 100))
    return round(score, 1)

def _heuristic_score(f: dict) -> float:
    score = (
        f.get('tickets_6m', 0)             * 10 +
        f.get('high_priority_6m', 0)       * 20 +
        f.get('anomalies_3m', 0)           * 15 +
        f.get('high_severity_anomalies', 0)* 20 +
        f.get('cpu_usage', 50)             * 0.1 +
        f.get('disk_usage_pct', 50)        * 0.15 +
        f.get('age_years', 0)              * 3
    )
    return round(min(score, 100), 1)