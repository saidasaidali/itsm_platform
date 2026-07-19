#!/usr/bin/env python3
"""
train_models.py — Pipeline d'entraînement complet pour les 3 modèles ML.

Usage :
    python train_models.py                    # Entraîne les 3 modèles
    python train_models.py --risk             # Risk Scorer uniquement
    python train_models.py --failure          # Failure Predictor uniquement
    python train_models.py --anomaly          # Anomaly Detector uniquement
    python train_models.py --force            # Force l'entraînement même si < 10 assets
    python train_models.py --eval-only        # Évalue les modèles existants sans réentraîner

Les modèles entraînés sont sauvegardés dans backend/ml/trained/ :
  - risk_scorer.pkl + risk_scaler.pkl
  - failure_predictor.pkl
  - anomaly_detector.pkl

Un rapport d'évaluation est généré dans backend/ml/trained/evaluation_report.json
"""

import os
import sys
import json
import argparse
import numpy as np
import pandas as pd
from datetime import datetime

# Ajouter le répertoire courant au path pour les imports locaux
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data.dataset_builder import build_asset_dataset, FEATURE_COLS
import models.risk_scorer as risk_scorer
import models.failure_predictor as failure_predictor
import models.anomaly_detector as anomaly_detector

TRAINED_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'trained')
os.makedirs(TRAINED_DIR, exist_ok=True)

REPORT_PATH = os.path.join(TRAINED_DIR, 'evaluation_report.json')


def evaluate_risk_scorer(model, scaler, X_test, y_test):
    """Évalue le Risk Scorer (régression) avec MAE et RMSE."""
    from sklearn.metrics import mean_absolute_error, mean_squared_error
    import joblib

    if model is None:
        # Charger depuis le disque
        model_path = os.path.join(TRAINED_DIR, 'risk_scorer.pkl')
        scaler_path = os.path.join(TRAINED_DIR, 'risk_scaler.pkl')
        if not os.path.exists(model_path):
            return None
        model = joblib.load(model_path)
        scaler = joblib.load(scaler_path)

    y_pred = model.predict(X_test)
    y_pred_clipped = np.clip(y_pred, 0, 100)

    mae = mean_absolute_error(y_test, y_pred_clipped)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred_clipped))

    # Erreur moyenne en pourcentage
    mape = np.mean(np.abs((y_test - y_pred_clipped) / (y_test + 1e-6))) * 100

    return {
        'model': 'risk_scorer',
        'type': 'regression',
        'algorithm': 'RandomForestRegressor',
        'n_estimators': model.n_estimators,
        'max_depth': model.max_depth,
        'n_features': model.n_features_in_,
        'metrics': {
            'mae': round(float(mae), 2),
            'rmse': round(float(rmse), 2),
            'mape_pct': round(float(mape), 2),
        },
        'test_samples': len(y_test),
    }


def evaluate_failure_predictor(model, X_test, y_test):
    """Évalue le Failure Predictor (classification) avec Accuracy, Precision, Recall, F1."""
    from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                                 f1_score, confusion_matrix, roc_auc_score)
    import joblib

    if model is None:
        model_path = os.path.join(TRAINED_DIR, 'failure_predictor.pkl')
        if not os.path.exists(model_path):
            return None
        model = joblib.load(model_path)

    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1] if hasattr(model, 'predict_proba') else None

    metrics = {
        'accuracy': round(float(accuracy_score(y_test, y_pred)), 4),
        'precision': round(float(precision_score(y_test, y_pred, zero_division=0)), 4),
        'recall': round(float(recall_score(y_test, y_pred, zero_division=0)), 4),
        'f1_score': round(float(f1_score(y_test, y_pred, zero_division=0)), 4),
    }

    if y_proba is not None and len(np.unique(y_test)) > 1:
        metrics['roc_auc'] = round(float(roc_auc_score(y_test, y_proba)), 4)

    cm = confusion_matrix(y_test, y_pred)
    if cm.shape == (2, 2):
        tn, fp, fn, tp = cm.ravel()
        metrics['true_negatives'] = int(tn)
        metrics['false_positives'] = int(fp)
        metrics['false_negatives'] = int(fn)
        metrics['true_positives'] = int(tp)
        metrics['specificity'] = round(float(tn / (tn + fp + 1e-6)), 4)

    return {
        'model': 'failure_predictor',
        'type': 'classification',
        'algorithm': 'RandomForestClassifier',
        'n_estimators': model.n_estimators,
        'max_depth': model.max_depth,
        'n_features': model.n_features_in_,
        'metrics': metrics,
        'test_samples': len(y_test),
    }


def evaluate_anomaly_detector(model, X_test):
    """Évalue l'Anomaly Detector (non supervisé) avec le score moyen et le taux d'anomalies."""
    import joblib

    if model is None:
        model_path = os.path.join(TRAINED_DIR, 'anomaly_detector.pkl')
        if not os.path.exists(model_path):
            return None
        model = joblib.load(model_path)

    y_pred = model.predict(X_test)
    anomaly_rate = float((y_pred == -1).sum() / len(y_pred))

    # Score d'anomalie moyen
    if hasattr(model, 'score_samples'):
        raw_scores = model.score_samples(X_test)
        anomaly_scores = np.clip((-raw_scores - 0.3) * 200, 0, 100)
        mean_anomaly_score = float(np.mean(anomaly_scores))
        max_anomaly_score = float(np.max(anomaly_scores))
    else:
        mean_anomaly_score = 0.0
        max_anomaly_score = 0.0

    return {
        'model': 'anomaly_detector',
        'type': 'unsupervised',
        'algorithm': 'IsolationForest',
        'n_estimators': model.n_estimators,
        'contamination': model.contamination,
        'n_features': model.n_features_in_,
        'metrics': {
            'anomaly_rate': round(anomaly_rate, 4),
            'mean_anomaly_score': round(mean_anomaly_score, 2),
            'max_anomaly_score': round(max_anomaly_score, 2),
            'total_samples': len(X_test),
            'anomalies_detected': int((y_pred == -1).sum()),
        },
        'test_samples': len(X_test),
    }


def train_all(force=False, skip_risk=False, skip_failure=False, skip_anomaly=False, eval_only=False):
    """Pipeline d'entraînement complet."""
    print('=' * 60)
    print('  Pipeline d\'entraînement des modèles ML')
    print(f'  Date : {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print('=' * 60)

    # Étape 1 : Charger le dataset (mode entraînement)
    print('\n[1/5] Chargement du dataset depuis PostgreSQL...')
    try:
        df = build_asset_dataset(for_training=True)
        print(f'       → {len(df)} assets chargés')
    except Exception as e:
        print(f'       ❌ Erreur : {e}')
        print('       Vérifiez que PostgreSQL est en cours d\'exécution et que les')
        print('       identifiants dans .env sont corrects.')
        sys.exit(1)

    if len(df) < 10 and not force:
        print(f'       ⚠️  Moins de 10 assets ({len(df)}). Entraînement ignoré.')
        print('       Utilisez --force pour forcer l\'entraînement.')
        return

    X = df[FEATURE_COLS].values
    print(f'       → {X.shape[1]} features, {X.shape[0]} échantillons')

    # Étape 2 : Split train/test
    print('\n[2/5] Split train/test (80/20)...')
    from sklearn.model_selection import train_test_split
    X_train, X_test = train_test_split(X, test_size=0.2, random_state=42)
    print(f'       → Train : {len(X_train)}, Test : {len(X_test)}')

    results = {}

    # Étape 3 : Risk Scorer
    if not skip_risk:
        print('\n[3/5] Risk Scorer (RandomForestRegressor)...')
        if eval_only:
            print('       Mode évaluation uniquement...')
            result = evaluate_risk_scorer(None, None, X_test, np.zeros(len(X_test)))
            if result:
                print(f'       ✅ Modèle existant évalué')
                results['risk_scorer'] = result
            else:
                print('       ⚠️  Aucun modèle existant trouvé')
        else:
            try:
                risk_scorer.train()
                # Évaluer
                model_path = os.path.join(TRAINED_DIR, 'risk_scorer.pkl')
                scaler_path = os.path.join(TRAINED_DIR, 'risk_scaler.pkl')
                if os.path.exists(model_path):
                    import joblib
                    model = joblib.load(model_path)
                    scaler = joblib.load(scaler_path)
                    # Reconstruire y_test pour l'évaluation
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
                    temp_scaler = MinMaxScaler(feature_range=(0, 100))
                    y_all = temp_scaler.fit_transform(risk_proxy.values.reshape(-1, 1)).ravel()
                    _, y_test_eval = train_test_split(y_all, test_size=0.2, random_state=42)
                    result = evaluate_risk_scorer(model, scaler, X_test, y_test_eval)
                    if result:
                        results['risk_scorer'] = result
                        print(f'       ✅ MAE={result["metrics"]["mae"]}, RMSE={result["metrics"]["rmse"]}')
            except Exception as e:
                print(f'       ❌ Erreur : {e}')
    else:
        print('\n[3/5] Risk Scorer : ignoré')

    # Étape 4 : Failure Predictor
    if not skip_failure:
        print('\n[4/5] Failure Predictor (RandomForestClassifier)...')
        if eval_only:
            print('       Mode évaluation uniquement...')
            y_all = df['failure_label'].values
            _, y_test_eval = train_test_split(y_all, test_size=0.2, random_state=42)
            result = evaluate_failure_predictor(None, X_test, y_test_eval)
            if result:
                print(f'       ✅ Modèle existant évalué')
                results['failure_predictor'] = result
            else:
                print('       ⚠️  Aucun modèle existant trouvé')
        else:
            try:
                failure_predictor.train()
                # Évaluer
                model_path = os.path.join(TRAINED_DIR, 'failure_predictor.pkl')
                if os.path.exists(model_path):
                    import joblib
                    model = joblib.load(model_path)
                    y_all = df['failure_label'].values
                    _, y_test_eval = train_test_split(y_all, test_size=0.2, random_state=42)
                    result = evaluate_failure_predictor(model, X_test, y_test_eval)
                    if result:
                        results['failure_predictor'] = result
                        print(f'       ✅ Accuracy={result["metrics"]["accuracy"]}, F1={result["metrics"]["f1_score"]}')
            except Exception as e:
                print(f'       ❌ Erreur : {e}')
    else:
        print('\n[4/5] Failure Predictor : ignoré')

    # Étape 5 : Anomaly Detector
    if not skip_anomaly:
        print('\n[5/5] Anomaly Detector (IsolationForest)...')
        if eval_only:
            print('       Mode évaluation uniquement...')
            result = evaluate_anomaly_detector(None, X_test)
            if result:
                print(f'       ✅ Modèle existant évalué')
                results['anomaly_detector'] = result
            else:
                print('       ⚠️  Aucun modèle existant trouvé')
        else:
            try:
                anomaly_detector.train()
                # Évaluer
                model_path = os.path.join(TRAINED_DIR, 'anomaly_detector.pkl')
                if os.path.exists(model_path):
                    import joblib
                    model = joblib.load(model_path)
                    result = evaluate_anomaly_detector(model, X_test)
                    if result:
                        results['anomaly_detector'] = result
                        print(f'       ✅ Taux d\'anomalies={result["metrics"]["anomaly_rate"]}, Score moyen={result["metrics"]["mean_anomaly_score"]}')
            except Exception as e:
                print(f'       ❌ Erreur : {e}')
    else:
        print('\n[5/5] Anomaly Detector : ignoré')

    # Sauvegarder le rapport
    report = {
        'generated_at': datetime.now().isoformat(),
        'dataset_size': len(df),
        'n_features': len(FEATURE_COLS),
        'results': results,
    }
    with open(REPORT_PATH, 'w') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f'\n📊 Rapport sauvegardé : {REPORT_PATH}')

    # Résumé
    print('\n' + '=' * 60)
    print('  RÉSUMÉ DE L\'ENTRAÎNEMENT')
    print('=' * 60)
    for model_name, result in results.items():
        print(f'\n  {model_name} ({result["type"]}) :')
        for metric, value in result['metrics'].items():
            print(f'    {metric}: {value}')
    print('\n' + '=' * 60)

    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Pipeline d\'entraînement des modèles ML')
    parser.add_argument('--risk', action='store_true', help='Risk Scorer uniquement')
    parser.add_argument('--failure', action='store_true', help='Failure Predictor uniquement')
    parser.add_argument('--anomaly', action='store_true', help='Anomaly Detector uniquement')
    parser.add_argument('--force', action='store_true', help='Forcer l\'entraînement même si < 10 assets')
    parser.add_argument('--eval-only', action='store_true', help='Évaluer les modèles existants sans réentraîner')
    args = parser.parse_args()

    skip_risk = args.failure or args.anomaly
    skip_failure = args.risk or args.anomaly
    skip_anomaly = args.risk or args.failure

    # Si aucun modèle spécifique n'est demandé, tout entraîner
    if not args.risk and not args.failure and not args.anomaly:
        skip_risk = False
        skip_failure = False
        skip_anomaly = False

    train_all(
        force=args.force,
        skip_risk=skip_risk,
        skip_failure=skip_failure,
        skip_anomaly=skip_anomaly,
        eval_only=args.eval_only,
    )