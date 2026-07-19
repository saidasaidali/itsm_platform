# backend/ml/models/anomaly_detector.py
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from data.dataset_builder import build_asset_dataset, FEATURE_COLS

# Chemin du répertoire trained (relatif à ce fichier)
TRAINED_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'trained')
MODEL_PATH = os.path.join(TRAINED_DIR, 'anomaly_detector.pkl')

# Cache du modèle chargé en mémoire
_model_cache = None


def _load_model():
    """Charge le modèle depuis le disque avec cache mémoire."""
    global _model_cache
    if _model_cache is not None:
        return _model_cache
    if os.path.exists(MODEL_PATH):
        _model_cache = joblib.load(MODEL_PATH)
        return _model_cache
    return None


def clear_cache():
    """Vide le cache mémoire (utile après un réentraînement)."""
    global _model_cache
    _model_cache = None


def is_trained():
    """Vérifie si un modèle entraîné existe sur le disque."""
    return os.path.exists(MODEL_PATH)


def get_model_info():
    """Retourne les informations sur le modèle chargé."""
    model = _load_model()
    if model is None:
        return {'status': 'not_trained', 'model': 'anomaly_detector'}
    return {
        'status': 'trained',
        'model': 'anomaly_detector',
        'algorithm': 'IsolationForest',
        'n_estimators': model.n_estimators,
        'contamination': model.contamination,
        'n_features': model.n_features_in_,
    }


def train():
    """Entraîne le modèle Anomaly Detector et sauvegarde le fichier .pkl."""
    df = build_asset_dataset(for_training=True)
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

    os.makedirs(TRAINED_DIR, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    
    # Vider le cache pour forcer le rechargement
    clear_cache()
    
    print(f'[AnomalyDetector ML] Modèle entraîné sur {len(df)} assets. Sauvegardé dans {MODEL_PATH}')


def predict(features: dict) -> dict:
    """Prédit si un asset est une anomalie.
    
    Retourne les prédictions du modèle ML si disponible, sinon les valeurs par défaut.
    """
    model = _load_model()
    
    if model is not None:
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
    
    return {'is_anomaly': False, 'anomaly_score': 0.0}


def predict_with_source(features: dict) -> dict:
    """Prédit si un asset est une anomalie avec indication de la source.
    
    Retourne {'is_anomaly': bool, 'anomaly_score': float, 'source': str}.
    """
    model = _load_model()
    
    if model is not None:
        X = pd.DataFrame([features])[FEATURE_COLS].fillna(0).values
        raw_score = float(model.score_samples(X)[0])
        anomaly_score = round(max(0, min(100, (-raw_score - 0.3) * 200)), 1)
        is_anomaly = model.predict(X)[0] == -1

        return {
            'is_anomaly':    is_anomaly,
            'anomaly_score': anomaly_score,
            'source': 'ml_model',
        }
    
    return {
        'is_anomaly': False,
        'anomaly_score': 0.0,
        'source': 'default_fallback',
    }