# backend/ml/app.py
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import models.risk_scorer      as risk_scorer
import models.failure_predictor as failure_predictor
import models.anomaly_detector  as anomaly_detector
from data.dataset_builder import FEATURE_COLS
from data.readiness_checker import check_data_readiness
from models.model_manager import load_training_history, get_current_version

app = FastAPI(title='DRESI ML Service', version='1.4.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:3000'],
    allow_methods=['*'],
    allow_headers=['*'],
)

class AssetFeatures(BaseModel):
    asset_id:               int
    age_years:              Optional[float] = 0
    total_tickets:          Optional[int]   = 0
    tickets_6m:             Optional[int]   = 0
    high_priority_6m:       Optional[int]   = 0
    avg_resolution_hours:   Optional[float] = 24
    total_anomalies:        Optional[int]   = 0
    anomalies_3m:           Optional[int]   = 0
    high_severity_anomalies:Optional[int]   = 0
    cpu_usage:              Optional[float] = 50
    ram_usage:              Optional[float] = 50
    disk_usage_pct:         Optional[float] = 50
    uptime_hours:           Optional[float] = 0
    is_online:              Optional[int]   = 1
    type_enc:               Optional[int]   = 0
    status_enc:             Optional[int]   = 0

@app.get('/health')
def health():
    return {
        'status': 'ok',
        'service': 'DRESI ML Service',
        'version': '1.4.0',
        'models': {
            'risk_scorer': risk_scorer.is_trained(),
            'failure_predictor': failure_predictor.is_trained(),
            'anomaly_detector': anomaly_detector.is_trained(),
        },
        'current_version': get_current_version(),
    }

@app.get('/metrics')
def metrics():
    return {
        'models': {
            'risk_scorer': risk_scorer.get_model_info(),
            'failure_predictor': failure_predictor.get_model_info(),
            'anomaly_detector': anomaly_detector.get_model_info(),
        },
        'features': FEATURE_COLS,
        'current_version': get_current_version(),
    }

@app.get('/readiness')
def readiness():
    result = check_data_readiness()
    result['current_version'] = get_current_version()
    return result

@app.get('/training-history')
def training_history():
    history = load_training_history()
    current = get_current_version()
    return {
        'current_version': current,
        'total_trainings': history.get('total_trainings', 0),
        'versions': history.get('versions', []),
    }

@app.get('/training-history/{version_id}')
def training_history_version(version_id: str):
    from models.model_manager import get_version_metrics
    meta = get_version_metrics(version_id)
    if meta is None:
        raise HTTPException(status_code=404, detail=f'Version {version_id} introuvable')
    return meta

@app.post('/predict/risk')
def predict_risk(data: AssetFeatures):
    features = data.dict()
    result = risk_scorer.predict_with_source(features)
    score = result['score']
    source = result['source']
    level = (
        'critique' if score >= 75 else
        'élevé'    if score >= 50 else
        'modéré'   if score >= 25 else
        'faible'
    )
    return {
        'asset_id':   data.asset_id,
        'risk_score': score,
        'risk_level': level,
        'source':     source,
    }

@app.post('/predict/failure')
def predict_failure(data: AssetFeatures):
    result = failure_predictor.predict_with_source(data.dict())
    return {'asset_id': data.asset_id, **result}

@app.post('/predict/anomaly')
def predict_anomaly(data: AssetFeatures):
    result = anomaly_detector.predict_with_source(data.dict())
    return {'asset_id': data.asset_id, **result}

@app.post('/predict/full')
def predict_full(data: AssetFeatures):
    features = data.dict()
    risk_result = risk_scorer.predict_with_source(features)
    failure_result = failure_predictor.predict_with_source(features)
    anomaly_result = anomaly_detector.predict_with_source(features)
    
    return {
        'asset_id': data.asset_id,
        'risk':     {
            'score': risk_result['score'],
            'level': _risk_level(risk_result['score']),
            'source': risk_result['source'],
        },
        'failure':  failure_result,
        'anomaly':  anomaly_result,
    }

@app.post('/train')
def train_all(background_tasks: BackgroundTasks):
    def _train():
        print('[ML] Début entraînement...')
        try:
            from auto_trainer import run_training
            result = run_training()
            if result.get('trained'):
                print(f'[ML] ✅ Entraînement terminé — Version {result["version"]}')
            else:
                print(f'[ML] ℹ️  {result.get("reason", "Entraînement non effectué")}')
        except ImportError:
            risk_scorer.train()
            failure_predictor.train()
            anomaly_detector.train()
            print('[ML] Entraînement terminé (mode legacy).')
    background_tasks.add_task(_train)
    return {'message': 'Entraînement lancé en arrière-plan.'}

def _risk_level(score):
    if score >= 75: return 'critique'
    if score >= 50: return 'élevé'
    if score >= 25: return 'modéré'
    return 'faible'

if __name__ == '__main__':
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser(description='DRESI ML Service')
    parser.add_argument('--host', type=str, default='0.0.0.0')
    parser.add_argument('--port', type=int, default=8001)
    parser.add_argument('--auto-train', action='store_true')
    parser.add_argument('--train-interval', type=int, default=604800)
    args = parser.parse_args()

    print(f'[ML] Démarrage du service ML sur {args.host}:{args.port}')
    print(f'[ML] Modèles : risk={risk_scorer.is_trained()}, failure={failure_predictor.is_trained()}, anomaly={anomaly_detector.is_trained()}')
    
    if args.auto_train:
        print(f'[ML] Auto-trainer activé (intervalle: {args.train_interval}s)')
        import threading
        def start_auto_trainer():
            from auto_trainer import run_daemon
            run_daemon(interval=args.train_interval)
        t = threading.Thread(target=start_auto_trainer, daemon=True)
        t.start()
        print(f'[ML] Auto-trainer démarré en arrière-plan')

    uvicorn.run(app, host=args.host, port=args.port, log_level='info')