#!/usr/bin/env python3
"""
auto_trainer.py — Auto-Trainer Scheduler simplifié pour l'entraînement automatique des modèles ML.

Fonctionnement :
1. Au démarrage, vérifie le volume de données (readiness_checker)
2. Si les seuils de volume sont atteints → lance l'entraînement
3. Sinon → log explicite + continue en fallback
4. Planifie un réentraînement périodique (configurable, défaut: 7 jours)
5. Après chaque entraînement, vide le cache des modèles
6. Versionne chaque entraînement (model_manager)

Usage :
    python auto_trainer.py                    # Exécution unique
    python auto_trainer.py --daemon           # Mode démon (boucle infinie)
    python auto_trainer.py --interval 3600    # Intervalle personnalisé (secondes)
    python auto_trainer.py --force            # Forcer l'entraînement
"""
import os
import sys
import json
import time
import argparse
import signal
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data.readiness_checker import check_data_readiness
from data.dataset_builder import build_asset_dataset, FEATURE_COLS
from models.model_manager import save_models, load_training_history, get_current_version
import models.risk_scorer as risk_scorer
import models.failure_predictor as failure_predictor
import models.anomaly_detector as anomaly_detector

DEFAULT_INTERVAL = 7 * 24 * 3600
MIN_INTERVAL = 3600
STATUS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'trained', 'auto_trainer_status.json')
_running = True


def signal_handler(signum, frame):
    global _running
    print('\n[AutoTrainer] Arrêt demandé...')
    _running = False


def write_status(status_data):
    os.makedirs(os.path.dirname(STATUS_FILE), exist_ok=True)
    with open(STATUS_FILE, 'w') as f:
        json.dump(status_data, f, indent=2, ensure_ascii=False, default=str)


def should_retrain():
    history = load_training_history()
    current_version = get_current_version()

    if current_version is None:
        return True, "Premier entraînement"

    last_meta = None
    if current_version:
        from models.model_manager import get_version_metrics
        last_meta = get_version_metrics(current_version)

    if last_meta is None:
        return True, "Version courante sans métadonnées"

    last_timestamp = last_meta.get('timestamp', '2000-01-01')
    last_time = datetime.fromisoformat(last_timestamp.replace('Z', '+00:00'))
    elapsed = (datetime.now(timezone.utc) - last_time).total_seconds()

    if elapsed < DEFAULT_INTERVAL:
        return False, f"Dernier entraînement trop récent ({int(elapsed/3600)}h)"

    last_dataset = last_meta.get('dataset_info', {})
    last_size = last_dataset.get('dataset_size', 0)

    try:
        current_df = build_asset_dataset(for_training=True)
        current_size = len(current_df)
        if current_size > last_size * 1.2:
            return True, f"Nouvelles données: {current_size} assets (était {last_size})"
    except Exception as e:
        print(f'[AutoTrainer] Erreur vérification dataset: {e}')

    return False, "Aucune donnée significative nouvelle"


def run_training(force=False):
    print(f'\n[AutoTrainer] 🔄 Début du cycle d\'entraînement...')
    start_time = time.time()

    print('[AutoTrainer] 📊 Vérification des données...')
    readiness = check_data_readiness()

    if not readiness.get('ready') and not force:
        print(f'[AutoTrainer] ⏳ Données insuffisantes. Progression: {readiness.get("progress_pct", 0)}%')
        for m in readiness.get('missing', []):
            print(f'[AutoTrainer]    ❌ {m}')
        print('[AutoTrainer] ℹ️  Utilisation des fallbacks.')

        write_status({
            'status': 'skipped',
            'reason': 'insufficient_data',
            'progress_pct': readiness.get('progress_pct', 0),
            'missing': readiness.get('missing', []),
            'timestamp': datetime.now(timezone.utc).isoformat(),
        })
        return {
            'trained': False,
            'reason': 'Données insuffisantes',
            'progress_pct': readiness.get('progress_pct', 0),
        }

    print('[AutoTrainer] 📦 Chargement du dataset...')
    try:
        df = build_asset_dataset(for_training=True)
        print(f'[AutoTrainer]    → {len(df)} assets chargés')
    except Exception as e:
        print(f'[AutoTrainer] ❌ Erreur: {e}')
        write_status({'status': 'error', 'error': str(e), 'timestamp': datetime.now(timezone.utc).isoformat()})
        return {'trained': False, 'error': str(e)}

    if len(df) < 10 and not force:
        print(f'[AutoTrainer] ⏳ Moins de 10 assets ({len(df)}). Entraînement ignoré.')
        write_status({
            'status': 'skipped',
            'reason': 'too_few_assets',
            'dataset_size': len(df),
            'timestamp': datetime.now(timezone.utc).isoformat(),
        })
        return {'trained': False, 'reason': f'Moins de 10 assets ({len(df)})'}

    X = df[FEATURE_COLS].values
    y_failure = df['failure_label'].values

    from sklearn.model_selection import train_test_split
    X_train, X_test = train_test_split(X, test_size=0.2, random_state=42)

    print('[AutoTrainer] 🧠 Entraînement des modèles...')
    metrics = {}
    models = {}

    # Risk Scorer
    print('[AutoTrainer]    • Risk Scorer...')
    try:
        risk_proxy = (
            df['tickets_6m'] * 10 +
            df['high_priority_6m'] * 20 +
            df['anomalies_3m'] * 15 +
            df['high_severity_anomalies'] * 20 +
            df['cpu_usage'].clip(0, 100) * 0.1 +
            df['disk_usage_pct'].clip(0, 100) * 0.15 +
            df['age_years'] * 3
        )
        from sklearn.preprocessing import MinMaxScaler
        from sklearn.ensemble import RandomForestRegressor
        from sklearn.metrics import mean_absolute_error, mean_squared_error

        risk_scaler = MinMaxScaler(feature_range=(0, 100))
        y_risk = risk_scaler.fit_transform(risk_proxy.values.reshape(-1, 1)).ravel()

        risk_model = RandomForestRegressor(n_estimators=100, max_depth=8, random_state=42, n_jobs=-1)
        risk_model.fit(X, y_risk)

        y_pred = risk_model.predict(X_test)
        y_pred_clipped = np.clip(y_pred, 0, 100)
        _, y_test_risk = train_test_split(y_risk, test_size=0.2, random_state=42)
        mae = mean_absolute_error(y_test_risk, y_pred_clipped)
        rmse = np.sqrt(mean_squared_error(y_test_risk, y_pred_clipped))

        metrics['risk_scorer'] = {
            'mae': round(float(mae), 2),
            'rmse': round(float(rmse), 2),
        }
        models['risk_model'] = risk_model
        models['risk_scaler'] = risk_scaler
        print(f'[AutoTrainer]       ✅ MAE={mae:.2f}, RMSE={rmse:.2f}')
    except Exception as e:
        print(f'[AutoTrainer]       ❌ Erreur: {e}')

    # Failure Predictor
    print('[AutoTrainer]    • Failure Predictor...')
    try:
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.metrics import accuracy_score, f1_score

        if y_failure.sum() > 0:
            failure_model = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42, n_jobs=-1)
            failure_model.fit(X, y_failure)

            _, y_test_failure = train_test_split(y_failure, test_size=0.2, random_state=42)
            y_pred_failure = failure_model.predict(X_test)

            metrics['failure_predictor'] = {
                'accuracy': round(float(accuracy_score(y_test_failure, y_pred_failure)), 4),
                'f1_score': round(float(f1_score(y_test_failure, y_pred_failure, zero_division=0)), 4),
            }
            models['failure_model'] = failure_model
            print(f'[AutoTrainer]       ✅ Accuracy={metrics["failure_predictor"]["accuracy"]}, F1={metrics["failure_predictor"]["f1_score"]}')
        else:
            print('[AutoTrainer]       ⏳ Aucune panne labellisée')
    except Exception as e:
        print(f'[AutoTrainer]       ❌ Erreur: {e}')

    # Anomaly Detector
    print('[AutoTrainer]    • Anomaly Detector...')
    try:
        from sklearn.ensemble import IsolationForest

        anomaly_model = IsolationForest(n_estimators=100, contamination=0.1, random_state=42, n_jobs=-1)
        anomaly_model.fit(X)

        y_pred_anomaly = anomaly_model.predict(X_test)
        anomaly_rate = float((y_pred_anomaly == -1).sum() / len(y_pred_anomaly))

        metrics['anomaly_detector'] = {
            'anomaly_rate': round(anomaly_rate, 4),
        }
        models['anomaly_model'] = anomaly_model
        print(f'[AutoTrainer]       ✅ Taux anomalies={anomaly_rate:.2%}')
    except Exception as e:
        print(f'[AutoTrainer]       ❌ Erreur: {e}')

    print('[AutoTrainer] 💾 Sauvegarde...')
    dataset_info = {
        'dataset_size': len(df),
        'n_features': len(FEATURE_COLS),
        'failure_label_count': int(y_failure.sum()),
    }

    version = save_models(
        risk_model=models.get('risk_model'),
        risk_scaler=models.get('risk_scaler'),
        failure_model=models.get('failure_model'),
        anomaly_model=models.get('anomaly_model'),
        metrics=metrics,
        dataset_info=dataset_info,
    )

    print('[AutoTrainer] 🔄 Vidage du cache...')
    risk_scorer.clear_cache()
    failure_predictor.clear_cache()
    anomaly_detector.clear_cache()

    elapsed = time.time() - start_time
    print(f'[AutoTrainer] ✅ Terminé en {elapsed:.1f}s — Version {version}')

    write_status({
        'status': 'success',
        'version': version,
        'metrics': metrics,
        'dataset_size': len(df),
        'elapsed_seconds': round(elapsed, 1),
        'timestamp': datetime.now(timezone.utc).isoformat(),
    })

    return {
        'trained': True,
        'version': version,
        'metrics': metrics,
        'dataset_size': len(df),
        'elapsed_seconds': round(elapsed, 1),
    }


def run_daemon(interval=DEFAULT_INTERVAL, force=False):
    global _running
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    print(f'[AutoTrainer] 🚀 Démon démarré (intervalle: {interval}s)')

    result = run_training(force=force)
    if result.get('trained'):
        print(f'[AutoTrainer] ✅ Modèles entraînés (version {result["version"]})')
    else:
        print(f'[AutoTrainer] ℹ️  {result.get("reason", "Non effectué")}')

    while _running:
        should, reasons = should_retrain()
        if should:
            print(f'[AutoTrainer] 🔄 Réentraînement: {", ".join(reasons) if isinstance(reasons, list) else reasons}')
            result = run_training(force=force)
            if result.get('trained'):
                print(f'[AutoTrainer] ✅ Réentraînés (version {result["version"]})')
            else:
                print(f'[AutoTrainer] ℹ️  {result.get("reason", "Non effectué")}')
        else:
            print(f'[AutoTrainer] 💤 {", ".join(reasons) if isinstance(reasons, list) else reasons}')

        for _ in range(interval // 60):
            if not _running:
                break
            time.sleep(60)

    print('[AutoTrainer] 👋 Arrêt')
    write_status({'status': 'stopped', 'timestamp': datetime.now(timezone.utc).isoformat()})


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Auto-Trainer ML')
    parser.add_argument('--daemon', action='store_true')
    parser.add_argument('--interval', type=int, default=DEFAULT_INTERVAL)
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()

    import numpy as np

    if args.daemon:
        interval = max(args.interval, MIN_INTERVAL)
        run_daemon(interval=interval, force=args.force)
    else:
        result = run_training(force=args.force)
        if result.get('trained'):
            print(f'\n✅ Succès — Version {result["version"]}')
        else:
            print(f'\nℹ️  {result.get("reason", "Aucun entraînement")}')