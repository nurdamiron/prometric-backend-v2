#!/bin/bash

# Comprehensive Security Testing Runner for Prometric V2
# Runs all security, RBAC, and data isolation tests

set -e

echo "🔒 Starting Comprehensive Security Testing for Prometric V2"
echo "========================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
API_URL="${API_URL:-http://localhost:3333}"
TEST_EMAIL="${TEST_EMAIL:-test@prometric.kz}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@prometric.kz}"

echo -e "${BLUE}Configuration:${NC}"
echo "API URL: $API_URL"
echo "Test Email: $TEST_EMAIL"
echo "Admin Email: $ADMIN_EMAIL"
echo ""

# Check if API is running
echo -e "${BLUE}Checking API availability...${NC}"
if curl -s -f "$API_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API is running${NC}"
else
    echo -e "${RED}❌ API is not accessible at $API_URL${NC}"
    echo "Please start the backend server first: npm run start:dev"
    exit 1
fi

# Check Node.js version
node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
    echo -e "${YELLOW}⚠️  Warning: Node.js version $node_version detected. Recommended: v18 or higher${NC}"
fi

# Create test results directory
RESULTS_DIR="test-results/security-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo -e "${BLUE}Test results will be saved to: $RESULTS_DIR${NC}"
echo ""

# Function to run test and capture results
run_test() {
    local test_name=$1
    local test_script=$2
    local log_file="$RESULTS_DIR/${test_name}.log"

    echo -e "${YELLOW}Running $test_name tests...${NC}"

    if timeout 300 node "$test_script" > "$log_file" 2>&1; then
        echo -e "${GREEN}✅ $test_name tests completed${NC}"
        return 0
    else
        local exit_code=$?
        echo -e "${RED}❌ $test_name tests failed (exit code: $exit_code)${NC}"
        echo "Check log file: $log_file"
        return $exit_code
    fi
}

# Initialize test summary
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test 1: Basic Security Tests
echo -e "${BLUE}Phase 1: Basic Security Tests${NC}"
if run_test "security" "test-scripts/security-tests.js"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# Test 2: RBAC Tests
echo -e "${BLUE}Phase 2: RBAC Tests${NC}"
if run_test "rbac" "test-scripts/rbac-tests.js"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# Test 3: Data Isolation Tests
echo -e "${BLUE}Phase 3: Data Isolation Tests${NC}"
if run_test "data-isolation" "test-scripts/data-isolation-tests.js"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# Wait for any background processes
wait

# Generate summary report
echo ""
echo "========================================================="
echo -e "${BLUE}Security Test Summary${NC}"
echo "========================================================="

# Count individual test results from log files
total_individual_tests=0
passed_individual_tests=0
failed_individual_tests=0

for log_file in "$RESULTS_DIR"/*.log; do
    if [ -f "$log_file" ]; then
        # Extract test results from log files
        local_passed=$(grep -c "✅" "$log_file" 2>/dev/null || echo 0)
        local_failed=$(grep -c "❌" "$log_file" 2>/dev/null || echo 0)

        passed_individual_tests=$((passed_individual_tests + local_passed))
        failed_individual_tests=$((failed_individual_tests + local_failed))
        total_individual_tests=$((total_individual_tests + local_passed + local_failed))
    fi
done

echo "Test Suites:"
echo "  ✅ Passed: $PASSED_TESTS"
echo "  ❌ Failed: $FAILED_TESTS"
echo "  📊 Total: $TOTAL_TESTS"
echo ""

echo "Individual Tests:"
echo "  ✅ Passed: $passed_individual_tests"
echo "  ❌ Failed: $failed_individual_tests"
echo "  📊 Total: $total_individual_tests"
echo ""

if [ $total_individual_tests -gt 0 ]; then
    success_rate=$((passed_individual_tests * 100 / total_individual_tests))
    echo "Success Rate: ${success_rate}%"
else
    success_rate=0
    echo "Success Rate: N/A"
fi

# Generate detailed HTML report
echo -e "${BLUE}Generating detailed report...${NC}"
cat > "$RESULTS_DIR/security-report.html" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Prometric V2 Security Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .success { color: #28a745; }
        .failure { color: #dc3545; }
        .warning { color: #ffc107; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; }
        .stats { display: flex; justify-content: space-around; text-align: center; }
        .stat-box { padding: 15px; border: 1px solid #ddd; border-radius: 5px; min-width: 120px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔒 Prometric V2 Security Test Report</h1>
        <p>Generated: $(date)</p>
        <p>API URL: $API_URL</p>
    </div>

    <div class="stats">
        <div class="stat-box">
            <h3>Test Suites</h3>
            <div class="success">✅ $PASSED_TESTS Passed</div>
            <div class="failure">❌ $FAILED_TESTS Failed</div>
        </div>
        <div class="stat-box">
            <h3>Individual Tests</h3>
            <div class="success">✅ $passed_individual_tests Passed</div>
            <div class="failure">❌ $failed_individual_tests Failed</div>
        </div>
        <div class="stat-box">
            <h3>Success Rate</h3>
            <div style="font-size: 24px; font-weight: bold;">$success_rate%</div>
        </div>
    </div>
EOF

# Add individual test results to HTML report
for log_file in "$RESULTS_DIR"/*.log; do
    if [ -f "$log_file" ]; then
        test_name=$(basename "$log_file" .log)
        echo "<div class=\"section\">" >> "$RESULTS_DIR/security-report.html"
        echo "<h2>$test_name Tests</h2>" >> "$RESULTS_DIR/security-report.html"
        echo "<pre>" >> "$RESULTS_DIR/security-report.html"
        cat "$log_file" >> "$RESULTS_DIR/security-report.html"
        echo "</pre>" >> "$RESULTS_DIR/security-report.html"
        echo "</div>" >> "$RESULTS_DIR/security-report.html"
    fi
done

echo "</body></html>" >> "$RESULTS_DIR/security-report.html"

echo -e "${GREEN}📄 Detailed HTML report saved: $RESULTS_DIR/security-report.html${NC}"

# Generate JSON summary for CI/CD
cat > "$RESULTS_DIR/summary.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "api_url": "$API_URL",
  "test_suites": {
    "total": $TOTAL_TESTS,
    "passed": $PASSED_TESTS,
    "failed": $FAILED_TESTS
  },
  "individual_tests": {
    "total": $total_individual_tests,
    "passed": $passed_individual_tests,
    "failed": $failed_individual_tests,
    "success_rate": $success_rate
  }
}
EOF

echo "📄 JSON summary saved: $RESULTS_DIR/summary.json"

# Final verdict
echo ""
echo "========================================================="
if [ $FAILED_TESTS -eq 0 ] && [ $failed_individual_tests -eq 0 ]; then
    echo -e "${GREEN}🎉 All security tests passed! System is ready for production.${NC}"
    exit 0
elif [ $failed_individual_tests -le 2 ] && [ $success_rate -ge 90 ]; then
    echo -e "${YELLOW}⚠️  Most security tests passed with minor issues. Review failed tests.${NC}"
    exit 0
else
    echo -e "${RED}❌ Security tests failed. System requires immediate attention before production.${NC}"
    echo -e "${RED}Review the logs in $RESULTS_DIR for detailed information.${NC}"
    exit 1
fi