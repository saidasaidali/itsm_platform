# backend/ml/models/risk_scorer.py
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import MinMaxScaler
from data.dataset_builder import build_asset_dataset, FEATURE_COLS

# Chemin du répertoire trained (relatif à ce fichier)
TRAINED_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'trained')
MODEL_PATH  = os.path.join(TRAINED_DIR, 'risk_scorer.pkl')
SCALER_PATH = os.path.join(TRAINED_DIR, 'risk_scaler.pkl')

# Cache du modèle chargé en mémoire pour éviter de recharger à chaque prédiction
_model_cache = None
_scaler_cache = None


def _load_models():
    """Charge les modèles depuis le disque avec cache mémoire."""
    global _model_cache, _scaler_cache
    if _model_cache is not None and _scaler_cache is not None:
        return _model_cache, _scaler_cache
    if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
        _model_cache = joblib.load(MODEL_PATH)
        _scaler_cache = joblib.load(SCALER_PATH)
        return _model_cache, _scaler_cache
    return None, None


def clear_cache():
    """Vide le cache mémoire (utile après un réentraînement)."""
    global _model_cache, _scaler_cache
    _model_cache = None
    _scaler_cache = None


def is_trained():
    """Vérifie si un modèle entraîné existe sur le disque."""
    return os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH)


def get_model_info():
    """Retourne les informations sur le modèle chargé."""
    model, _ = _load_models()
    if model is None:
        return {'status': 'not_trained', 'model': 'risk_scorer'}
    return {
        'status': 'trained',
        'model': 'risk_scorer',
        'algorithm': 'RandomForestRegressor',
        'n_estimators': model.n_estimators,
        'max_depth': model.max_depth,
        'n_features': model.n_features_in_,
    }


def train():
    """Entraîne le modèle Risk Scorer et sauvegarde les fichiers .pkl."""
    df = build_asset_dataset(for_training=True)
    if len(df) < 10:
        print('[RiskScorer] Pas assez de données pour entraîner (minimum 10 assets).')
        return

    X = df[FEATURE_COLS].values

    # Score de risque = combinaison pondérée de features normalisées
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

    os.makedirs(TRAINED_DIR, exist_ok=True)
    joblib.dump(model,  MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    
    # Vider le cache pour forcer le rechargement
    clear_cache()
    
    print(f'[RiskScorer] Modèle entraîné sur {len(df)} assets. Sauvegardé dans {MODEL_PATH}')


def predict(features: dict) -> float:
    """Prédit le score de risque.
    
    Retourne le score du modèle ML si disponible, sinon le score heuristique.
    """
    model, scaler = _load_models()
    
    if model is not None and scaler is not None:
        # Utiliser le vrai modèle ML
        X = pd.DataFrame([features])[FEATURE_COLS].fillna(0).values
        raw = model.predict(X)[0]
        score = float(np.clip(raw, 0, 100))
        return round(score, 1)
    
    # Fallback : score heuristique
    return _heuristic_score(features)


def predict_with_source(features: dict) -> dict:
    """Prédit le score de risque avec indication de la source.
    
    Retourne {'score': float, 'source': 'ml_model'|'heuristic_fallback'}.
    """
    model, scaler = _load_models()
    
    if model is not None and scaler is not None:
        X = pd.DataFrame([features])[FEATURE_COLS].fillna(0).values
        raw = model.predict(X)[0]
        score = float(np.clip(raw, 0, 100))
        return {'score': round(score, 1), 'source': 'ml_model'}
    
    return {'score': _heuristic_score(features), 'source': 'heuristic_fallback'}


def _heuristic_score(f: dict) -> float:
    """Score heuristique de secours quand le modèle ML n'est pas disponible."""
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