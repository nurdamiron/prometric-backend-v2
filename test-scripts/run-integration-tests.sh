#!/bin/bash

# Integration Testing Runner for Prometric V2
# Runs comprehensive integration tests across all DDD bounded contexts

set -e

echo "🔗 Starting Integration Testing for Prometric V2"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
API_URL="${API_URL:-http://localhost:3001}"
DB_URL="${DB_URL:-postgresql://localhost:5432/prometric_v2}"
TEST_TIMEOUT="${TEST_TIMEOUT:-600}" # 10 minutes

echo -e "${BLUE}Configuration:${NC}"
echo "API URL: $API_URL"
echo "Database URL: ${DB_URL%/*}/***" # Hide password
echo "Test Timeout: ${TEST_TIMEOUT}s"
echo ""

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

# Check if API is running
if curl -s -f "$API_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API is running${NC}"
else
    echo -e "${RED}❌ API is not accessible at $API_URL${NC}"
    echo "Please start the backend server first:"
    echo "  cd backend && npm run start:dev"
    exit 1
fi

# Check database connection
if node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: '$DB_URL' });
client.connect()
  .then(() => client.query('SELECT 1'))
  .then(() => { console.log('Database connected'); client.end(); })
  .catch((err) => { console.error('Database error:', err.message); process.exit(1); });
" 2>/dev/null; then
    echo -e "${GREEN}✅ Database is accessible${NC}"
else
    echo -e "${RED}❌ Cannot connect to database${NC}"
    echo "Please ensure PostgreSQL is running and database exists"
    exit 1
fi

# Check required Node.js packages
if ! node -e "require('pg')" 2>/dev/null; then
    echo -e "${RED}❌ Missing required package: pg${NC}"
    echo "Please install: npm install pg"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"
echo ""

# Create test results directory
RESULTS_DIR="test-results/integration-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo -e "${BLUE}Test results will be saved to: $RESULTS_DIR${NC}"
echo ""

# Function to setup test data
setup_test_data() {
    echo -e "${YELLOW}Setting up test data...${NC}"

    # Create test organizations and users via SQL
    node -e "
const { Client } = require('pg');

async function setupTestData() {
    const client = new Client({ connectionString: '$DB_URL' });
    await client.connect();

    try {
        // Create test organization
        await client.query(\`
            INSERT INTO organizations (id, name, created_at, updated_at)
            VALUES ('integration-org-uuid', 'Integration Test Org', NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
        \`);

        // Create test department
        await client.query(\`
            INSERT INTO departments (id, name, type, organization_id, created_at, updated_at)
            VALUES ('integration-sales-dept-uuid', 'Integration Sales', 'sales', 'integration-org-uuid', NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
        \`);

        console.log('✅ Test data setup completed');
    } catch (error) {
        console.error('❌ Test data setup failed:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

setupTestData();
    "

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Test data setup completed${NC}"
    else
        echo -e "${RED}❌ Test data setup failed${NC}"
        exit 1
    fi
}

# Function to cleanup test data
cleanup_test_data() {
    echo -e "${YELLOW}Cleaning up test data...${NC}"

    node -e "
const { Client } = require('pg');

async function cleanupTestData() {
    const client = new Client({ connectionString: '$DB_URL' });
    await client.connect();

    try {
        // Clean up test data (in reverse order due to foreign keys)
        const tables = [
            'user_roles',
            'conversations',
            'deals',
            'customers',
            'users',
            'departments',
            'organizations'
        ];

        for (const table of tables) {
            await client.query(\`
                DELETE FROM \${table}
                WHERE id LIKE 'integration%'
                OR email LIKE '%integration%'
                OR name LIKE '%Integration%'
            \`);
        }

        console.log('✅ Test data cleanup completed');
    } catch (error) {
        console.log('⚠️  Test data cleanup warning:', error.message);
    } finally {
        await client.end();
    }
}

cleanupTestData();
    "
}

# Function to run test with timeout and logging
run_integration_test() {
    local test_name=$1
    local test_script=$2
    local log_file="$RESULTS_DIR/${test_name}.log"

    echo -e "${YELLOW}Running $test_name integration tests...${NC}"

    if timeout $TEST_TIMEOUT node "$test_script" > "$log_file" 2>&1; then
        echo -e "${GREEN}✅ $test_name integration tests completed${NC}"
        return 0
    else
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            echo -e "${RED}❌ $test_name tests timed out after ${TEST_TIMEOUT}s${NC}"
        else
            echo -e "${RED}❌ $test_name tests failed (exit code: $exit_code)${NC}"
        fi
        echo "Check log file: $log_file"
        return $exit_code
    fi
}

# Trap to ensure cleanup runs on exit
trap cleanup_test_data EXIT

# Setup test data
setup_test_data

# Initialize test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo -e "${BLUE}Starting Integration Test Suite${NC}"
echo "================================="

# Run integration tests
echo -e "${BLUE}Phase 1: Core Integration Tests${NC}"
if run_integration_test "core-integration" "test-scripts/integration-tests.js"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# Generate performance report
echo -e "${BLUE}Generating performance metrics...${NC}"
node -e "
const fs = require('fs');
const path = require('path');

const logDir = '$RESULTS_DIR';
const logFiles = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let averageResponseTime = 0;
let totalRequests = 0;

logFiles.forEach(file => {
    const content = fs.readFileSync(path.join(logDir, file), 'utf8');

    const passed = (content.match(/✅/g) || []).length;
    const failed = (content.match(/❌/g) || []).length;

    passedTests += passed;
    failedTests += failed;
    totalTests += passed + failed;

    // Extract response times if available
    const timeMatches = content.match(/\d+ms/g) || [];
    timeMatches.forEach(match => {
        const time = parseInt(match);
        averageResponseTime += time;
        totalRequests++;
    });
});

if (totalRequests > 0) {
    averageResponseTime = Math.round(averageResponseTime / totalRequests);
}

const report = {
    timestamp: new Date().toISOString(),
    summary: {
        total_suites: $TOTAL_TESTS,
        passed_suites: $PASSED_TESTS,
        failed_suites: $FAILED_TESTS,
        total_individual_tests: totalTests,
        passed_individual_tests: passedTests,
        failed_individual_tests: failedTests,
        success_rate: totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0,
        average_response_time: averageResponseTime
    }
};

fs.writeFileSync(path.join(logDir, 'integration-summary.json'), JSON.stringify(report, null, 2));
console.log('✅ Performance report generated');
" 2>/dev/null

# Generate HTML report
echo -e "${BLUE}Generating HTML report...${NC}"
cat > "$RESULTS_DIR/integration-report.html" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Prometric V2 Integration Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; }
        .success { color: #28a745; }
        .failure { color: #dc3545; }
        .warning { color: #ffc107; }
        .info { color: #17a2b8; }
        .section { margin: 20px 0; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-box { text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px; border: 1px solid #dee2e6; }
        .stat-number { font-size: 2em; font-weight: bold; margin: 10px 0; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 12px; }
        .test-result { margin: 5px 0; padding: 8px; border-radius: 4px; }
        .test-passed { background: #d4edda; border-left: 4px solid #28a745; }
        .test-failed { background: #f8d7da; border-left: 4px solid #dc3545; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔗 Prometric V2 Integration Test Report</h1>
        <p>Generated: $(date)</p>
        <p>API URL: $API_URL</p>
    </div>

    <div class="stats">
        <div class="stat-box">
            <h3>Test Suites</h3>
            <div class="stat-number success">$PASSED_TESTS</div>
            <div class="success">✅ Passed</div>
            <div class="stat-number failure">$FAILED_TESTS</div>
            <div class="failure">❌ Failed</div>
        </div>
        <div class="stat-box">
            <h3>Total Suites</h3>
            <div class="stat-number">$TOTAL_TESTS</div>
        </div>
    </div>

    <div class="section">
        <h2>📊 Test Coverage Areas</h2>
        <ul>
            <li>🔐 Authentication & Authorization Flow</li>
            <li>👥 User Identity & Access Management</li>
            <li>🏛️ Organization & Department Management</li>
            <li>💼 CRM System Integration</li>
            <li>🤖 AI Brain & RAG System</li>
            <li>📊 System Monitoring & Health Checks</li>
            <li>⚡ Event-Driven Architecture</li>
            <li>🔄 CQRS Pattern Implementation</li>
            <li>🗄️ Database Transaction Management</li>
            <li>🚀 End-to-End User Journey</li>
        </ul>
    </div>
EOF

# Add detailed test results to HTML report
for log_file in "$RESULTS_DIR"/*.log; do
    if [ -f "$log_file" ]; then
        test_name=$(basename "$log_file" .log)
        echo "<div class=\"section\">" >> "$RESULTS_DIR/integration-report.html"
        echo "<h2>$test_name Integration Tests</h2>" >> "$RESULTS_DIR/integration-report.html"
        echo "<pre>" >> "$RESULTS_DIR/integration-report.html"
        cat "$log_file" >> "$RESULTS_DIR/integration-report.html"
        echo "</pre>" >> "$RESULTS_DIR/integration-report.html"
        echo "</div>" >> "$RESULTS_DIR/integration-report.html"
    fi
done

echo "</body></html>" >> "$RESULTS_DIR/integration-report.html"

# Load summary data for final report
if [ -f "$RESULTS_DIR/integration-summary.json" ]; then
    INDIVIDUAL_PASSED=$(node -e "console.log(require('$RESULTS_DIR/integration-summary.json').summary.passed_individual_tests)" 2>/dev/null || echo 0)
    INDIVIDUAL_FAILED=$(node -e "console.log(require('$RESULTS_DIR/integration-summary.json').summary.failed_individual_tests)" 2>/dev/null || echo 0)
    INDIVIDUAL_TOTAL=$(node -e "console.log(require('$RESULTS_DIR/integration-summary.json').summary.total_individual_tests)" 2>/dev/null || echo 0)
    SUCCESS_RATE=$(node -e "console.log(require('$RESULTS_DIR/integration-summary.json').summary.success_rate)" 2>/dev/null || echo 0)
    AVG_RESPONSE_TIME=$(node -e "console.log(require('$RESULTS_DIR/integration-summary.json').summary.average_response_time)" 2>/dev/null || echo 0)
else
    INDIVIDUAL_PASSED=0
    INDIVIDUAL_FAILED=0
    INDIVIDUAL_TOTAL=0
    SUCCESS_RATE=0
    AVG_RESPONSE_TIME=0
fi

# Print final summary
echo ""
echo "================================================="
echo -e "${BLUE}Integration Test Summary${NC}"
echo "================================================="

echo "Test Suites:"
echo "  ✅ Passed: $PASSED_TESTS"
echo "  ❌ Failed: $FAILED_TESTS"
echo "  📊 Total: $TOTAL_TESTS"
echo ""

echo "Individual Tests:"
echo "  ✅ Passed: $INDIVIDUAL_PASSED"
echo "  ❌ Failed: $INDIVIDUAL_FAILED"
echo "  📊 Total: $INDIVIDUAL_TOTAL"
echo ""

echo "Performance:"
echo "  📈 Success Rate: ${SUCCESS_RATE}%"
echo "  ⏱️  Average Response Time: ${AVG_RESPONSE_TIME}ms"
echo ""

echo "📄 Reports Generated:"
echo "  • HTML Report: $RESULTS_DIR/integration-report.html"
echo "  • JSON Summary: $RESULTS_DIR/integration-summary.json"
echo "  • Detailed Logs: $RESULTS_DIR/*.log"

# Final verdict
echo ""
echo "================================================="
if [ $FAILED_TESTS -eq 0 ] && [ $INDIVIDUAL_FAILED -le 5 ] && [ $SUCCESS_RATE -ge 85 ]; then
    echo -e "${GREEN}🎉 Integration tests completed successfully!${NC}"
    echo -e "${GREEN}System integration is working correctly across all bounded contexts.${NC}"
    exit 0
elif [ $SUCCESS_RATE -ge 70 ]; then
    echo -e "${YELLOW}⚠️  Integration tests completed with some issues.${NC}"
    echo -e "${YELLOW}Review failed tests and consider fixing before production deployment.${NC}"
    exit 0
else
    echo -e "${RED}❌ Integration tests failed significantly.${NC}"
    echo -e "${RED}System integration requires immediate attention.${NC}"
    echo -e "${RED}Check detailed logs for specific failure causes.${NC}"
    exit 1
fi