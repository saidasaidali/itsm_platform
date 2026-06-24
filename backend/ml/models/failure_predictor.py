# backend/ml/models/failure_predictor.py
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.utils.class_weight import compute_class_weight
from data.dataset_builder import build_asset_dataset, FEATURE_COLS

MODEL_PATH = 'trained/failure_predictor.pkl'

def train():
    df = build_asset_dataset()
    if len(df) < 10:
        print('[FailurePredictor] Pas assez de données.')
        return

    X = df[FEATURE_COLS].values
    y = df['failure_label'].values

    if y.sum() == 0:
        print('[FailurePredictor] Aucune panne labellisée, entraînement ignoré.')
        return

    classes = np.unique(y)
    weights = compute_class_weight('balanced', classes=classes, y=y)
    class_weight = dict(zip(classes, weights))

    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=6,
        class_weight=class_weight,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X, y)

    os.makedirs('trained', exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f'[FailurePredictor] Modèle entraîné. Pannes dans dataset: {y.sum()}/{len(y)}')

def predict(features: dict) -> dict:
    if not os.path.exists(MODEL_PATH):
        return {'failure_probability': 0.0, 'failure_predicted': False}

    model = joblib.load(MODEL_PATH)
    X = pd.DataFrame([features])[FEATURE_COLS].fillna(0).values
    proba = float(model.predict_proba(X)[0][1])
    return {
        'failure_probability': round(proba * 100, 1),
        'failure_predicted':   proba >= 0.6,
    }