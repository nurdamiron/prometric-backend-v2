#!/usr/bin/env python3
"""
Prometric V2 Stress Testing Script
Tests system under high load and concurrent users
"""

import asyncio
import aiohttp
import time
import statistics
from typing import List, Dict, Any
import json

SERVER_URL = "http://localhost:3333"

class StressTester:
    def __init__(self):
        self.session = None
        self.results = {
            'response_times': [],
            'errors': [],
            'success_count': 0,
            'error_count': 0
        }

    async def setup_session(self):
        """Create HTTP session with proper configuration"""
        timeout = aiohttp.ClientTimeout(total=30)
        self.session = aiohttp.ClientSession(timeout=timeout)

    async def cleanup_session(self):
        """Clean up HTTP session"""
        if self.session:
            await self.session.close()

    async def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None) -> Dict:
        """Make HTTP request and track performance"""
        start_time = time.time()

        try:
            url = f"{SERVER_URL}{endpoint}"

            if method == "GET":
                async with self.session.get(url, headers=headers) as response:
                    body = await response.text()
                    status = response.status
            elif method == "POST":
                async with self.session.post(url, json=data, headers=headers) as response:
                    body = await response.text()
                    status = response.status
            else:
                raise ValueError(f"Unsupported method: {method}")

            response_time = (time.time() - start_time) * 1000  # Convert to ms
            self.results['response_times'].append(response_time)

            if status < 400:
                self.results['success_count'] += 1
            else:
                self.results['error_count'] += 1
                self.results['errors'].append({
                    'endpoint': endpoint,
                    'status': status,
                    'body': body[:200]  # First 200 chars
                })

            return {
                'status': status,
                'body': body,
                'response_time': response_time
            }

        except Exception as e:
            self.results['error_count'] += 1
            self.results['errors'].append({
                'endpoint': endpoint,
                'error': str(e)
            })
            return {
                'status': 0,
                'body': str(e),
                'response_time': 0
            }

    async def test_concurrent_registrations(self, count: int = 50):
        """Test concurrent user registrations"""
        print(f"\n🔥 Testing {count} concurrent registrations...")

        tasks = []
        for i in range(count):
            data = {
                "firstName": f"StressUser{i}",
                "lastName": "Test",
                "email": f"stress-user-{i}@load.test",
                "password": "SecurePass123!"
            }
            task = self.make_request("POST", "/auth/register", data)
            tasks.append(task)

        start_time = time.time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        total_time = time.time() - start_time

        successful = sum(1 for r in results if isinstance(r, dict) and r.get('status', 0) in [201, 429])
        print(f"✅ {successful}/{count} requests completed in {total_time:.2f}s")
        print(f"📊 Average: {total_time/count*1000:.2f}ms per request")

        return results

    async def test_authenticated_operations(self, token: str, count: int = 100):
        """Test authenticated operations under load"""
        print(f"\n📊 Testing {count} authenticated operations...")

        tasks = []
        endpoints = [
            ("GET", "/auth/profile"),
            ("GET", "/customers"),
            ("GET", "/pipelines"),
            ("GET", "/ai/capabilities")
        ]

        headers = {"Authorization": f"Bearer {token}"}

        for i in range(count):
            method, endpoint = endpoints[i % len(endpoints)]
            task = self.make_request(method, endpoint, headers=headers)
            tasks.append(task)

        start_time = time.time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        total_time = time.time() - start_time

        successful = sum(1 for r in results if isinstance(r, dict) and r.get('status', 0) == 200)
        print(f"✅ {successful}/{count} authenticated requests completed in {total_time:.2f}s")

        # Calculate statistics
        valid_times = [r['response_time'] for r in results if isinstance(r, dict) and r.get('response_time', 0) > 0]
        if valid_times:
            print(f"📈 Response Time Stats:")
            print(f"   Average: {statistics.mean(valid_times):.2f}ms")
            print(f"   Median: {statistics.median(valid_times):.2f}ms")
            print(f"   95th percentile: {sorted(valid_times)[int(len(valid_times) * 0.95)]:.2f}ms")
            print(f"   Max: {max(valid_times):.2f}ms")

        return results

    async def test_customer_operations(self, token: str, count: int = 20):
        """Test customer CRUD operations"""
        print(f"\n👥 Testing {count} customer operations...")

        headers = {"Authorization": f"Bearer {token}"}

        # Get organization ID from profile
        profile_response = await self.make_request("GET", "/auth/profile", headers=headers)
        org_id = json.loads(profile_response['body']).get('organizationId')

        if not org_id:
            print("❌ Could not get organization ID")
            return

        # Create customers concurrently
        create_tasks = []
        for i in range(count):
            customer_data = {
                "organizationId": org_id,
                "firstName": f"LoadCustomer{i}",
                "lastName": "Test",
                "email": f"load-customer-{i}@stress.test",
                "phone": f"+7700123{i:04d}",
                "companyName": f"Load Corp {i}"
            }
            task = self.make_request("POST", "/customers", customer_data, headers)
            create_tasks.append(task)

        start_time = time.time()
        create_results = await asyncio.gather(*create_tasks, return_exceptions=True)
        create_time = time.time() - start_time

        successful_creates = sum(1 for r in create_results if isinstance(r, dict) and r.get('status', 0) == 201)
        print(f"✅ Created {successful_creates}/{count} customers in {create_time:.2f}s")

        # Test customer listing performance
        list_tasks = []
        for i in range(10):  # 10 concurrent list requests
            task = self.make_request("GET", "/customers?page=1&limit=20", headers=headers)
            list_tasks.append(task)

        start_time = time.time()
        list_results = await asyncio.gather(*list_tasks, return_exceptions=True)
        list_time = time.time() - start_time

        successful_lists = sum(1 for r in list_results if isinstance(r, dict) and r.get('status', 0) == 200)
        print(f"✅ Listed customers {successful_lists}/10 times in {list_time:.2f}s")

        return create_results, list_results

    async def test_pipeline_operations(self, token: str):
        """Test sales pipeline operations"""
        print(f"\n📊 Testing pipeline operations...")

        headers = {"Authorization": f"Bearer {token}"}

        # Test pipeline listing
        pipeline_response = await self.make_request("GET", "/pipelines", headers=headers)

        if pipeline_response['status'] == 200:
            pipelines = json.loads(pipeline_response['body'])['data']
            if pipelines:
                pipeline_id = pipelines[0]['id']

                # Test stages listing
                stages_response = await self.make_request("GET", f"/pipelines/{pipeline_id}/stages", headers=headers)

                if stages_response['status'] == 200:
                    stages = json.loads(stages_response['body'])['data']['stages']
                    print(f"✅ Pipeline has {len(stages)} stages")

                    # Verify Kazakhstan localization
                    stage_names = [stage['name'] for stage in stages]
                    expected_stages = ['Лиды', 'Квалификация', 'Предложение', 'Переговоры']

                    if all(stage in stage_names for stage in expected_stages):
                        print("✅ Kazakhstan localization verified")
                    else:
                        print("❌ Kazakhstan localization missing")

    async def test_ai_performance(self, token: str, count: int = 20):
        """Test AI assistant performance"""
        print(f"\n🤖 Testing AI assistant with {count} requests...")

        headers = {"Authorization": f"Bearer {token}"}

        # Configure AI first
        config_response = await self.make_request("POST", "/ai/assistant/configure", {
            "assistantName": "Stress Test AI",
            "personality": "professional",
            "expertise": ["Sales & Marketing"],
            "voicePreference": "female"
        }, headers)

        if config_response['status'] != 201:
            print("❌ AI configuration failed")
            return

        # Test AI chat performance
        chat_tasks = []
        messages = [
            "Привет, как дела?",
            "Покажи статистику продаж",
            "Создай отчет по клиентам",
            "Анализируй performance",
            "Что нового в системе?"
        ]

        for i in range(count):
            message = messages[i % len(messages)]
            chat_data = {
                "message": f"{message} (запрос {i+1})",
                "context": "general"
            }
            task = self.make_request("POST", "/ai/chat", chat_data, headers)
            chat_tasks.append(task)

        start_time = time.time()
        chat_results = await asyncio.gather(*chat_tasks, return_exceptions=True)
        chat_time = time.time() - start_time

        successful_chats = sum(1 for r in chat_results if isinstance(r, dict) and r.get('status', 0) == 200)
        print(f"✅ {successful_chats}/{count} AI chat requests in {chat_time:.2f}s")

        return chat_results

    async def run_comprehensive_stress_test(self):
        """Run complete stress testing suite"""
        print("🚀 Starting Comprehensive Stress Testing...")
        print("=" * 50)

        await self.setup_session()

        try:
            # Phase 1: Setup authenticated user
            print("\n📋 Phase 1: Setting up test user...")

            # Register owner
            register_response = await self.make_request("POST", "/auth/register", {
                "firstName": "Stress",
                "lastName": "Owner",
                "email": "stress-owner@load.test",
                "password": "SecurePass123!"
            })

            if register_response['status'] == 429:
                print("⏳ Rate limited - waiting for reset...")
                await asyncio.sleep(10)
                return

            # Activate user
            await self.make_request("POST", "/test/activate-user", {
                "email": "stress-owner@load.test"
            })

            # Login
            login_response = await self.make_request("POST", "/auth/login", {
                "email": "stress-owner@load.test",
                "password": "SecurePass123!"
            })

            if login_response['status'] != 200:
                print("❌ Login failed")
                return

            token = json.loads(login_response['body'])['accessToken']

            # Complete onboarding
            await self.make_request("POST", "/auth/finish", {
                "onboardingData": {
                    "userType": "owner",
                    "companyName": "Stress Test Corp",
                    "companyBin": "999888777000",
                    "industry": "Load Testing"
                }
            }, {"Authorization": f"Bearer {token}"})

            # Phase 2: Stress testing
            print("\n🔥 Phase 2: Stress testing...")

            await self.test_authenticated_operations(token, 50)
            await self.test_customer_operations(token, 15)
            await self.test_pipeline_operations(token)
            await self.test_ai_performance(token, 10)

            # Phase 3: Results
            print(f"\n📊 STRESS TEST RESULTS:")
            print(f"Total Requests: {self.results['success_count'] + self.results['error_count']}")
            print(f"Successful: {self.results['success_count']}")
            print(f"Errors: {self.results['error_count']}")

            if self.results['response_times']:
                print(f"Average Response Time: {statistics.mean(self.results['response_times']):.2f}ms")
                print(f"95th Percentile: {sorted(self.results['response_times'])[int(len(self.results['response_times']) * 0.95)]:.2f}ms")

            if self.results['errors']:
                print(f"\n❌ Errors encountered:")
                for error in self.results['errors'][:5]:  # Show first 5 errors
                    print(f"   - {error}")

            success_rate = (self.results['success_count'] / (self.results['success_count'] + self.results['error_count'])) * 100
            print(f"\n🎯 Success Rate: {success_rate:.2f}%")

            if success_rate > 95 and statistics.mean(self.results['response_times']) < 500:
                print("🎉 STRESS TEST PASSED - System is production ready!")
            else:
                print("⚠️  STRESS TEST CONCERNS - Review performance")

        except Exception as e:
            print(f"❌ Stress test failed: {e}")

        finally:
            await self.cleanup_session()

async def main():
    """Main stress testing function"""
    tester = StressTester()
    await tester.run_comprehensive_stress_test()

if __name__ == "__main__":
    print("Prometric V2 Stress Testing Tool")
    print("Requirements: pip install aiohttp")
    print("Usage: python3 stress-test.py")
    print("=" * 40)

    asyncio.run(main())