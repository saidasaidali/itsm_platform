# backend/ml/models/failure_predictor.py
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.utils.class_weight import compute_class_weight
from data.dataset_builder import build_asset_dataset, FEATURE_COLS

# Chemin du répertoire trained (relatif à ce fichier)
TRAINED_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'trained')
MODEL_PATH = os.path.join(TRAINED_DIR, 'failure_predictor.pkl')

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
        return {'status': 'not_trained', 'model': 'failure_predictor'}
    return {
        'status': 'trained',
        'model': 'failure_predictor',
        'algorithm': 'RandomForestClassifier',
        'n_estimators': model.n_estimators,
        'max_depth': model.max_depth,
        'n_features': model.n_features_in_,
    }


def train():
    """Entraîne le modèle Failure Predictor et sauvegarde le fichier .pkl."""
    df = build_asset_dataset(for_training=True)
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

    os.makedirs(TRAINED_DIR, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    
    # Vider le cache pour forcer le rechargement
    clear_cache()
    
    print(f'[FailurePredictor] Modèle entraîné. Pannes dans dataset: {y.sum()}/{len(y)}. Sauvegardé dans {MODEL_PATH}')


def predict(features: dict) -> dict:
    """Prédit la probabilité de panne.
    
    Retourne les prédictions du modèle ML si disponible, sinon les valeurs par défaut.
    """
    model = _load_model()
    
    if model is not None:
        X = pd.DataFrame([features])[FEATURE_COLS].fillna(0).values
        proba = float(model.predict_proba(X)[0][1])
        return {
            'failure_probability': round(proba * 100, 1),
            'failure_predicted':   proba >= 0.6,
        }
    
    return {'failure_probability': 0.0, 'failure_predicted': False}


def predict_with_source(features: dict) -> dict:
    """Prédit la probabilité de panne avec indication de la source.
    
    Retourne {'failure_probability': float, 'failure_predicted': bool, 'source': str}.
    """
    model = _load_model()
    
    if model is not None:
        X = pd.DataFrame([features])[FEATURE_COLS].fillna(0).values
        proba = float(model.predict_proba(X)[0][1])
        return {
            'failure_probability': round(proba * 100, 1),
            'failure_predicted':   proba >= 0.6,
            'source': 'ml_model',
        }
    
    return {
        'failure_probability': 0.0,
        'failure_predicted': False,
        'source': 'default_fallback',
    }