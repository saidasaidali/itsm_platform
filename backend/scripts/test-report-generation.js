// backend/scripts/test-report-generation.js
// Test script for report generation functionality
// Run with: node scripts/test-report-generation.js

import pool from '../src/db.js';
import { generateReport } from '../src/services/reportService.js';
import { getReportStatus, getReportHistory } from '../src/services/reportService.js';

const TEST_PERIOD_START = '2024-01-01';
const TEST_PERIOD_END = '2024-12-31';
const TEST_USER_ID = 1;

async function runTests() {
  console.log('=== REPORT GENERATION TEST SUITE ===\n');

  let passedTests = 0;
  let failedTests = 0;

  // Test 1: Database connection
  try {
    console.log('Test 1: Database connection...');
    const result = await pool.query('SELECT NOW()');
    console.log('✓ Database connected:', result.rows[0].now);
    passedTests++;
  } catch (err) {
    console.error('✗ Database connection failed:', err.message);
    failedTests++;
    return;
  }

  // Test 2: Generate report with empty database
  try {
    console.log('\nTest 2: Generate report with empty/minimal data...');
    const startTime = Date.now();
    const report = await generateReport('monthly', TEST_PERIOD_START, TEST_PERIOD_END, TEST_USER_ID);
    const duration = Date.now() - startTime;
    console.log(`✓ Report generated in ${duration}ms`);
    console.log('  - ID:', report.id);
    console.log('  - Status:', report.status);
    console.log('  - File path:', report.file_path);
    passedTests++;
  } catch (err) {
    console.error('✗ Report generation failed:', err.message);
    failedTests++;
  }

  // Test 3: Check report status
  try {
    console.log('\nTest 3: Check report status...');
    const reports = await getReportHistory(1, 1);
    if (reports.reports.length > 0) {
      const latestReport = reports.reports[0];
      console.log('✓ Latest report found:');
      console.log('  - ID:', latestReport.id);
      console.log('  - Type:', latestReport.report_type);
      console.log('  - Status:', latestReport.status);
      passedTests++;
    } else {
      console.log('⚠ No reports found (this is expected if Test 2 failed)');
    }
  } catch (err) {
    console.error('✗ Failed to get report history:', err.message);
    failedTests++;
  }

  // Test 4: Verify PDF file exists
  try {
    console.log('\nTest 4: Verify PDF file exists...');
    const reports = await getReportHistory(1, 1);
    if (reports.reports.length > 0) {
      const latestReport = reports.reports[0];
      if (latestReport.file_path && latestReport.status === 'completed') {
        const fs = await import('fs');
        const fileExists = await fs.access(latestReport.file_path).then(() => true).catch(() => false);
        if (fileExists) {
          const stats = await fs.stat(latestReport.file_path);
          console.log('✓ PDF file exists:');
          console.log('  - Path:', latestReport.file_path);
          console.log('  - Size:', (stats.size / 1024).toFixed(2), 'KB');
          passedTests++;
        } else {
          console.log('✗ PDF file not found at:', latestReport.file_path);
          failedTests++;
        }
      } else {
        console.log('⚠ Report not completed yet or no file path');
      }
    }
  } catch (err) {
    console.error('✗ Failed to verify PDF:', err.message);
    failedTests++;
  }

  // Test 5: Test with different report types
  try {
    console.log('\nTest 5: Generate weekly report...');
    const startTime = Date.now();
    const report = await generateReport('weekly', TEST_PERIOD_START, TEST_PERIOD_END, TEST_USER_ID);
    const duration = Date.now() - startTime;
    console.log(`✓ Weekly report generated in ${duration}ms`);
    console.log('  - ID:', report.id);
    passedTests++;
  } catch (err) {
    console.error('✗ Weekly report generation failed:', err.message);
    failedTests++;
  }

  // Test 6: Test custom report
  try {
    console.log('\nTest 6: Generate custom report...');
    const startTime = Date.now();
    const report = await generateReport('custom', TEST_PERIOD_START, TEST_PERIOD_END, TEST_USER_ID);
    const duration = Date.now() - startTime;
    console.log(`✓ Custom report generated in ${duration}ms`);
    console.log('  - ID:', report.id);
    passedTests++;
  } catch (err) {
    console.error('✗ Custom report generation failed:', err.message);
    failedTests++;
  }

  // Summary
  console.log('\n=== TEST SUMMARY ===');
  console.log(`Total tests: ${passedTests + failedTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Success rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(2)}%`);

  if (failedTests === 0) {
    console.log('\n✓ All tests passed!');
  } else {
    console.log('\n⚠ Some tests failed. Check the logs above for details.');
  }

  // Cleanup
  console.log('\n=== CLEANUP ===');
  console.log('Test reports have been created in the database.');
  console.log('You can view them with: SELECT * FROM reports ORDER BY generated_at DESC LIMIT 10;');

  await pool.end();
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run tests
runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});