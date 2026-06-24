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

app = FastAPI(title='DRESI ML Service', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:3000'],
    allow_methods=['*'],
    allow_headers=['*'],
)

# ── Schéma d'entrée commun ────────────────────────────────────────────────────
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

# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'DRESI ML Service'}

@app.post('/predict/risk')
def predict_risk(data: AssetFeatures):
    features = data.dict()
    score = risk_scorer.predict(features)
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
    }

@app.post('/predict/failure')
def predict_failure(data: AssetFeatures):
    result = failure_predictor.predict(data.dict())
    return {'asset_id': data.asset_id, **result}

@app.post('/predict/anomaly')
def predict_anomaly(data: AssetFeatures):
    result = anomaly_detector.predict(data.dict())
    return {'asset_id': data.asset_id, **result}

@app.post('/predict/full')
def predict_full(data: AssetFeatures):
    """Endpoint combiné — un seul appel pour les trois prédictions."""
    features = data.dict()
    return {
        'asset_id': data.asset_id,
        'risk':     {
            'score': risk_scorer.predict(features),
            'level': _risk_level(risk_scorer.predict(features)),
        },
        'failure':  failure_predictor.predict(features),
        'anomaly':  anomaly_detector.predict(features),
    }

@app.post('/train')
def train_all(background_tasks: BackgroundTasks):
    """Déclenche l'entraînement en arrière-plan."""
    def _train():
        print('[ML] Début entraînement...')
        risk_scorer.train()
        failure_predictor.train()
        anomaly_detector.train()
        print('[ML] Entraînement terminé.')
    background_tasks.add_task(_train)
    return {'message': 'Entraînement lancé en arrière-plan.'}

def _risk_level(score):
    if score >= 75: return 'critique'
    if score >= 50: return 'élevé'
    if score >= 25: return 'modéré'
    return 'faible'