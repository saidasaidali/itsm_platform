# backend/ml/data/readiness_checker.py
"""
Vérificateur de volume de données pour l'entraînement automatique des modèles ML.

Vérifie uniquement le volume de données (pas de contrôle de qualité complexe).
Utilisé par l'auto-trainer scheduler pour décider si les données sont suffisantes.

Seuils configurables via .env (préfixe ML_READINESS_*) ou system_settings.
"""
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data.dataset_builder import get_connection

DEFAULT_THRESHOLDS = {
    'min_assets': int(os.getenv('ML_READINESS_MIN_ASSETS', 10)),
    'min_tickets': int(os.getenv('ML_READINESS_MIN_TICKETS', 20)),
    'min_tickets_6m': int(os.getenv('ML_READINESS_MIN_TICKETS_6M', 5)),
    'min_high_priority': int(os.getenv('ML_READINESS_MIN_HIGH_PRIORITY', 2)),
    'min_anomalies': int(os.getenv('ML_READINESS_MIN_ANOMALIES', 5)),
    'min_failure_labels': int(os.getenv('ML_READINESS_MIN_FAILURE_LABELS', 2)),
    'min_days_history': int(os.getenv('ML_READINESS_MIN_DAYS_HISTORY', 7)),
    'min_live_state': int(os.getenv('ML_READINESS_MIN_LIVE_STATE', 3)),
    'min_asset_types': int(os.getenv('ML_READINESS_MIN_ASSET_TYPES', 2)),
}


def load_thresholds():
    thresholds = dict(DEFAULT_THRESHOLDS)
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT setting_value FROM system_settings WHERE setting_key = 'ml_training_thresholds'")
            row = cur.fetchone()
            if row and row[0]:
                import json
                custom = json.loads(row[0])
                thresholds.update(custom)
        conn.close()
    except Exception:
        pass
    return thresholds


def check_data_readiness():
    """
    Vérifie uniquement le volume de données.
    Retourne un dict avec 'ready', 'progress_pct', 'checks', 'missing'.
    """
    thresholds = load_thresholds()
    checks = {}
    ready = True
    missing = []

    try:
        conn = get_connection()

        # 1. Assets
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM assets WHERE type IN ('Ordinateur', 'Serveur', 'Imprimante')")
            total_assets = cur.fetchone()[0] or 0

        checks['min_assets'] = {
            'status': total_assets >= thresholds['min_assets'],
            'current': total_assets,
            'required': thresholds['min_assets'],
            'label': 'Équipements',
        }
        if not checks['min_assets']['status']:
            ready = False
            missing.append(f"Équipements: {total_assets}/{thresholds['min_assets']}")

        # 2. Types d'assets
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(DISTINCT type) FROM assets WHERE type IN ('Ordinateur', 'Serveur', 'Imprimante')")
            asset_types = cur.fetchone()[0] or 0

        checks['min_asset_types'] = {
            'status': asset_types >= thresholds['min_asset_types'],
            'current': asset_types,
            'required': thresholds['min_asset_types'],
            'label': 'Types d\'équipements',
        }
        if not checks['min_asset_types']['status']:
            ready = False
            missing.append(f"Types: {asset_types}/{thresholds['min_asset_types']}")

        # 3. Tickets
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM tickets")
            total_tickets = cur.fetchone()[0] or 0

        checks['min_tickets'] = {
            'status': total_tickets >= thresholds['min_tickets'],
            'current': total_tickets,
            'required': thresholds['min_tickets'],
            'label': 'Tickets',
        }
        if not checks['min_tickets']['status']:
            ready = False
            missing.append(f"Tickets: {total_tickets}/{thresholds['min_tickets']}")

        # 4. Tickets 6 mois
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM tickets WHERE created_at > NOW() - INTERVAL '6 months'")
            tickets_6m = cur.fetchone()[0] or 0

        checks['min_tickets_6m'] = {
            'status': tickets_6m >= thresholds['min_tickets_6m'],
            'current': tickets_6m,
            'required': thresholds['min_tickets_6m'],
            'label': 'Tickets (6 mois)',
        }
        if not checks['min_tickets_6m']['status']:
            ready = False
            missing.append(f"Tickets 6m: {tickets_6m}/{thresholds['min_tickets_6m']}")

        # 5. Haute priorité
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM tickets WHERE priority = 'Haute'")
            high_priority = cur.fetchone()[0] or 0

        checks['min_high_priority'] = {
            'status': high_priority >= thresholds['min_high_priority'],
            'current': high_priority,
            'required': thresholds['min_high_priority'],
            'label': 'Tickets Haute',
        }
        if not checks['min_high_priority']['status']:
            ready = False
            missing.append(f"Haute priorité: {high_priority}/{thresholds['min_high_priority']}")

        # 6. Anomalies
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM asset_anomalies")
            total_anomalies = cur.fetchone()[0] or 0

        checks['min_anomalies'] = {
            'status': total_anomalies >= thresholds['min_anomalies'],
            'current': total_anomalies,
            'required': thresholds['min_anomalies'],
            'label': 'Anomalies',
        }
        if not checks['min_anomalies']['status']:
            ready = False
            missing.append(f"Anomalies: {total_anomalies}/{thresholds['min_anomalies']}")

        # 7. Live state
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM asset_live_state")
            live_state_count = cur.fetchone()[0] or 0

        checks['min_live_state'] = {
            'status': live_state_count >= thresholds['min_live_state'],
            'current': live_state_count,
            'required': thresholds['min_live_state'],
            'label': 'Live state',
        }
        if not checks['min_live_state']['status']:
            ready = False
            missing.append(f"Live state: {live_state_count}/{thresholds['min_live_state']}")

        # 8. Ancienneté
        with conn.cursor() as cur:
            cur.execute("SELECT EXTRACT(DAY FROM AGE(NOW(), MIN(created_at))) FROM assets WHERE created_at IS NOT NULL")
            oldest_days = float(cur.fetchone()[0] or 0)

        checks['min_days_history'] = {
            'status': oldest_days >= thresholds['min_days_history'],
            'current': int(oldest_days),
            'required': thresholds['min_days_history'],
            'label': 'Historique (jours)',
        }
        if not checks['min_days_history']['status']:
            ready = False
            missing.append(f"Historique: {int(oldest_days)}j/{thresholds['min_days_history']}j")

        # 9. Pannes labellisées
        failure_count = 0
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT COUNT(*) FROM (
                        SELECT a.id,
                            CASE WHEN EXISTS (
                                SELECT 1 FROM tickets t2
                                WHERE t2.asset_id = a.id
                                  AND t2.priority = 'Haute'
                                  AND t2.created_at BETWEEN a.created_at AND a.created_at + INTERVAL '30 days'
                            ) THEN 1 ELSE 0 END AS failure_label
                        FROM assets a
                        WHERE a.type IN ('Ordinateur', 'Serveur', 'Imprimante')
                    ) sub WHERE failure_label = 1
                """)
                failure_count = cur.fetchone()[0] or 0
        except Exception:
            pass

        checks['min_failure_labels'] = {
            'status': failure_count >= thresholds['min_failure_labels'],
            'current': failure_count,
            'required': thresholds['min_failure_labels'],
            'label': 'Pannes labellisées',
        }
        if not checks['min_failure_labels']['status']:
            ready = False
            missing.append(f"Pannes: {failure_count}/{thresholds['min_failure_labels']}")

        conn.close()

    except Exception as e:
        return {
            'ready': False,
            'error': str(e),
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }

    total_checks = len(checks)
    passed_checks = sum(1 for c in checks.values() if c['status'])
    progress_pct = round((passed_checks / total_checks) * 100, 1) if total_checks > 0 else 0

    return {
        'ready': ready,
        'progress_pct': progress_pct,
        'checks': checks,
        'missing': missing,
        'dataset_size': total_assets,
        'failure_label_count': failure_count,
        'oldest_asset_days': int(oldest_days),
        'timestamp': datetime.now(timezone.utc).isoformat(),
    }


def get_readiness_summary():
    result = check_data_readiness()
    if result.get('error'):
        return f"⚠️ Erreur: {result['error']}"

    status = "✅ PRÊT" if result['ready'] else "⏳ EN ATTENTE"
    lines = [
        f"\n{'='*50}",
        f"  PRÉPARATION ML : {status}",
        f"  Progression : {result['progress_pct']}% ({result['dataset_size']} assets)",
        f"{'='*50}",
    ]
    for check_name, check in result['checks'].items():
        icon = "✅" if check['status'] else "⏳"
        lines.append(f"  {icon} {check['label']}: {check['current']}/{check['required']}")

    if result['missing']:
        lines.append(f"\n  ❌ Manquant ({len(result['missing'])}) :")
        for m in result['missing']:
            lines.append(f"     • {m}")

    if result['ready']:
        lines.append(f"\n  🚀 Entraînement possible !")
    else:
        lines.append(f"\n  📊 Fallback en attendant.")

    return '\n'.join(lines)


if __name__ == '__main__':
    print(get_readiness_summary())