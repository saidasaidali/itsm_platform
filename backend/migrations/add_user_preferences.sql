-- Migration pour ajouter les préférences utilisateur (langue et format de date)
-- Exécuter cette migration dans PostgreSQL

-- Ajouter la colonne language à la table users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'fr';

-- Ajouter la colonne date_format à la table users  
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY';
