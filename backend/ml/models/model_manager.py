# backend/ml/models/model_manager.py
"""
Gestionnaire de modèles simplifié avec versionnement.

Chaque entraînement produit une version horodatée des modèles.
Les versions précédentes sont conservées dans des sous-dossiers.
"""
import os
import json
import joblib
from datetime import datetime, timezone

TRAINED_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'trained')
VERSIONS_DIR = os.path.join(TRAINED_DIR, 'versions')
METADATA_FILE = os.path.join(TRAINED_DIR, 'training_history.json')
CURRENT_LINK = os.path.join(TRAINED_DIR, 'current_version.txt')

os.makedirs(VERSIONS_DIR, exist_ok=True)


def _get_version_id():
    return datetime.now().strftime('v%Y%m%d_%H%M%S')


def save_models(risk_model=None, risk_scaler=None, failure_model=None, anomaly_model=None,
                metrics=None, dataset_info=None):
    """
    Sauvegarde les modèles avec versionnement simple.
    """
    version = _get_version_id()
    version_dir = os.path.join(VERSIONS_DIR, version)
    os.makedirs(version_dir, exist_ok=True)

    saved_files = []

    models_to_save = {
        'risk_scorer.pkl': risk_model,
        'risk_scaler.pkl': risk_scaler,
        'failure_predictor.pkl': failure_model,
        'anomaly_detector.pkl': anomaly_model,
    }

    for filename, model in models_to_save.items():
        if model is not None:
            version_path = os.path.join(version_dir, filename)
            joblib.dump(model, version_path)
            saved_files.append(filename)

            main_path = os.path.join(TRAINED_DIR, filename)
            joblib.dump(model, main_path)

    metadata = {
        'version': version,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'saved_files': saved_files,
        'metrics': metrics or {},
        'dataset_info': dataset_info or {},
    }

    version_meta_path = os.path.join(version_dir, 'version_metadata.json')
    with open(version_meta_path, 'w') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False, default=str)

    with open(CURRENT_LINK, 'w') as f:
        f.write(version)

    history = load_training_history()
    history['versions'].append(metadata)
    history['latest_version'] = version
    history['total_trainings'] = len(history['versions'])
    with open(METADATA_FILE, 'w') as f:
        json.dump(history, f, indent=2, ensure_ascii=False, default=str)

    print(f'[ModelManager] Version {version} sauvegardée ({len(saved_files)} fichiers)')
    return version


def load_training_history():
    if os.path.exists(METADATA_FILE):
        try:
            with open(METADATA_FILE, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, Exception):
            pass
    return {
        'created_at': datetime.now(timezone.utc).isoformat(),
        'latest_version': None,
        'total_trainings': 0,
        'versions': [],
    }


def get_current_version():
    if os.path.exists(CURRENT_LINK):
        with open(CURRENT_LINK, 'r') as f:
            return f.read().strip()
    return None


def get_version_metrics(version_id=None):
    if version_id is None:
        version_id = get_current_version()
    if version_id is None:
        return None

    meta_path = os.path.join(VERSIONS_DIR, version_id, 'version_metadata.json')
    if os.path.exists(meta_path):
        with open(meta_path, 'r') as f:
            return json.load(f)
    return None


def get_training_summary():
    history = load_training_history()
    current = get_current_version()

    lines = [
        f"\n{'='*50}",
        f"  HISTORIQUE DES ENTRAÎNEMENTS ML",
        f"{'='*50}",
        f"  Version courante : {current or 'Aucune (fallback)'}",
        f"  Nombre d'entraînements : {history['total_trainings']}",
        f"{'='*50}",
    ]

    for i, v in enumerate(reversed(history['versions'][-5:])):
        ts = v.get('timestamp', '?')[:19]
        ds = v.get('dataset_info', {})
        metrics = v.get('metrics', {})
        lines.append(f"\n  [{v['version']}] {ts}")
        lines.append(f"     Dataset: {ds.get('dataset_size', '?')} assets")
        for model_name, m in metrics.items():
            if isinstance(m, dict):
                vals = ', '.join(f"{k}={v}" for k, v in m.items() if isinstance(v, (int, float)))
                if vals:
                    lines.append(f"     {model_name}: {vals}")

    return '\n'.join(lines)


if __name__ == '__main__':
    print(get_training_summary())