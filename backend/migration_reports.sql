-- Migration for AI Reports module
-- Create reports table

CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('monthly', 'weekly', 'custom')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    generated_at TIMESTAMP DEFAULT NOW(),
    file_path VARCHAR(500),
    status VARCHAR(20) DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed')),
    error_message TEXT
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_generated_at ON reports(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_generated_by ON reports(generated_by);

-- Insert comment
COMMENT ON TABLE reports IS 'Stores generated AI reports metadata';
COMMENT ON COLUMN reports.report_type IS 'Type of report: monthly, weekly, or custom';
COMMENT ON COLUMN reports.file_path IS 'Path to the generated PDF file';
COMMENT ON COLUMN reports.status IS 'Generation status: generating, completed, or failed';