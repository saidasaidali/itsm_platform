# backend/ml/data/dataset_builder.py
import os
import pandas as pd
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', 5432),
        dbname=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
    )

def build_asset_dataset():
    """
    Construit le dataset principal par asset pour entraînement et scoring.
    Chaque ligne = un asset avec ses features agrégées.
    """
    conn = get_connection()
    query = """
        SELECT
            a.id                                        AS asset_id,
            a.type,
            a.status,
            EXTRACT(YEAR FROM AGE(NOW(), a.purchase_date))
                                                        AS age_years,

            -- Tickets liés
            COUNT(DISTINCT t.id)                        AS total_tickets,
            COUNT(DISTINCT t.id) FILTER (
                WHERE t.created_at > NOW() - INTERVAL '6 months'
            )                                           AS tickets_6m,
            COUNT(DISTINCT t.id) FILTER (
                WHERE t.priority = 'Haute'
                AND   t.created_at > NOW() - INTERVAL '6 months'
            )                                           AS high_priority_6m,
            AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600)
                FILTER (WHERE t.resolved_at IS NOT NULL)
                                                        AS avg_resolution_hours,

            -- Anomalies détectées
            COUNT(DISTINCT an.id)                       AS total_anomalies,
            COUNT(DISTINCT an.id) FILTER (
                WHERE an.detected_at > NOW() - INTERVAL '3 months'
            )                                           AS anomalies_3m,
            COUNT(DISTINCT an.id) FILTER (
                WHERE an.severity = 'high'
            )                                           AS high_severity_anomalies,

            -- État en direct (si disponible)
            ls.cpu_usage,
            ls.ram_usage,
            ls.disk_free_gb,
            ls.disk_total_gb,
            CASE WHEN ls.disk_total_gb > 0
                 THEN (1 - ls.disk_free_gb / ls.disk_total_gb) * 100
                 ELSE NULL
            END                                         AS disk_usage_pct,
            ls.uptime_hours,
            ls.is_online,

            -- Label : panne dans les 30 prochains jours
            -- (1 si un ticket Haute priorité a été créé dans les 30j qui ont suivi)
            CASE WHEN EXISTS (
                SELECT 1 FROM tickets t2
                WHERE t2.asset_id = a.id
                  AND t2.priority = 'Haute'
                  AND t2.created_at BETWEEN NOW() AND NOW() + INTERVAL '30 days'
            ) THEN 1 ELSE 0 END                         AS failure_label

        FROM assets a
        LEFT JOIN tickets t          ON t.asset_id = a.id
        LEFT JOIN asset_anomalies an ON an.asset_id = a.id
        LEFT JOIN asset_live_state ls ON ls.asset_id = a.id
        WHERE a.type IN ('Ordinateur', 'Serveur', 'Imprimante')
        GROUP BY a.id, a.type, a.status, a.purchase_date,
                 ls.cpu_usage, ls.ram_usage, ls.disk_free_gb,
                 ls.disk_total_gb, ls.uptime_hours, ls.is_online
    """
    df = pd.read_sql(query, conn)
    conn.close()

    # Remplir les valeurs manquantes
    df['age_years']            = df['age_years'].fillna(0)
    df['cpu_usage']            = df['cpu_usage'].fillna(50)
    df['ram_usage']            = df['ram_usage'].fillna(50)
    df['disk_usage_pct']       = df['disk_usage_pct'].fillna(50)
    df['uptime_hours']         = df['uptime_hours'].fillna(0)
    df['avg_resolution_hours'] = df['avg_resolution_hours'].fillna(24)
    df['is_online']            = df['is_online'].fillna(True).astype(int)

    # Encodage du type et statut
    df['type_enc']   = df['type'].map(
        {'Ordinateur': 0, 'Serveur': 1, 'Imprimante': 2}
    ).fillna(0)
    df['status_enc'] = df['status'].map(
        {'En service': 0, 'En maintenance': 1, 'Hors service': 2, 'En stock': 3}
    ).fillna(0)

    return df

FEATURE_COLS = [
    'age_years', 'total_tickets', 'tickets_6m', 'high_priority_6m',
    'avg_resolution_hours', 'total_anomalies', 'anomalies_3m',
    'high_severity_anomalies', 'cpu_usage', 'ram_usage', 'disk_usage_pct',
    'uptime_hours', 'is_online', 'type_enc', 'status_enc',
]