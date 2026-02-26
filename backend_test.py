#!/usr/bin/env python3
import requests
import json
import sys
from typing import Dict, Any

# Backend URL from environment
BACKEND_URL = "https://compassion-space.preview.emergentagent.com"

# Test session tokens from setup
SESSION_TOKEN_1 = "test_session_1772123552937"
USER_ID_1 = "test-user-1772123552937"
SESSION_TOKEN_2 = "test_session2_1772123558200" 
USER_ID_2 = "test-user2-1772123558199"

class BackendTester:
    def __init__(self):
        self.session1 = requests.Session()
        self.session1.headers.update({
            "Authorization": f"Bearer {SESSION_TOKEN_1}",
            "Content-Type": "application/json"
        })
        
        self.session2 = requests.Session()
        self.session2.headers.update({
            "Authorization": f"Bearer {SESSION_TOKEN_2}",
            "Content-Type": "application/json"
        })
        
        self.results = {
            "passed": 0,
            "failed": 0,
            "errors": []
        }
    
    def log(self, message: str, level: str = "INFO"):
        print(f"[{level}] {message}")
    
    def assert_response(self, response: requests.Response, expected_status: int, test_name: str):
        """Assert response status and return JSON data"""
        if response.status_code == expected_status:
            self.log(f"✅ {test_name}: Status {response.status_code} OK")
            self.results["passed"] += 1
            try:
                return response.json()
            except:
                return {}
        else:
            error_msg = f"❌ {test_name}: Expected {expected_status}, got {response.status_code}"
            if response.text:
                error_msg += f" - {response.text[:200]}"
            self.log(error_msg, "ERROR")
            self.results["failed"] += 1
            self.results["errors"].append(error_msg)
            return None
    
    def test_health_check(self):
        """Test 1: Health Check Endpoint"""
        self.log("\n=== Testing Health Check ===")
        
        response = requests.get(f"{BACKEND_URL}/api/health")
        data = self.assert_response(response, 200, "Health Check")
        
        if data and "status" in data:
            self.log(f"✅ Health status: {data['status']}")
        
    def test_grief_topics(self):
        """Test 2: Grief Topics Endpoint (No Auth Required)"""
        self.log("\n=== Testing Grief Topics ===")
        
        response = requests.get(f"{BACKEND_URL}/api/grief-topics")
        data = self.assert_response(response, 200, "Grief Topics")
        
        if data and "topics" in data and len(data["topics"]) > 0:
            self.log(f"✅ Found {len(data['topics'])} grief topics")
            
    def test_auth_me(self):
        """Test 3: Authentication Check"""
        self.log("\n=== Testing Auth Me ===")
        
        response = self.session1.get(f"{BACKEND_URL}/api/auth/me")
        data = self.assert_response(response, 200, "Auth Me")
        
        if data and "user_id" in data:
            self.log(f"✅ Authenticated as user: {data.get('name', 'Unknown')}")
            return data
        return None
    
    def test_user_profile_get(self):
        """Test 4: Get User Profile"""
        self.log("\n=== Testing Get User Profile ===")
        
        response = self.session1.get(f"{BACKEND_URL}/api/users/profile")
        data = self.assert_response(response, 200, "Get Profile")
        
        if data and "user_id" in data:
            self.log(f"✅ Profile: {data.get('name', 'Unknown')} with {len(data.get('grief_topics', []))} topics")
    
    def test_user_profile_update(self):
        """Test 5: Update User Profile"""
        self.log("\n=== Testing Update User Profile ===")
        
        update_data = {
            "bio": "Updated test bio for grief support testing",
            "grief_topics": ["Loss of Parent", "Loss of Pet", "Loss of Friend"]
        }
        
        response = self.session1.put(f"{BACKEND_URL}/api/users/profile", json=update_data)
        data = self.assert_response(response, 200, "Update Profile")
        
        if data and data.get("bio") == update_data["bio"]:
            self.log(f"✅ Profile updated successfully")
    
    def test_browse_users(self):
        """Test 6: Browse Users"""
        self.log("\n=== Testing Browse Users ===")
        
        # Browse all users
        response = self.session1.get(f"{BACKEND_URL}/api/users/browse")
        data = self.assert_response(response, 200, "Browse All Users")
        
        if data and "users" in data:
            self.log(f"✅ Found {len(data['users'])} users")
        
        # Browse users by topic
        response = self.session1.get(f"{BACKEND_URL}/api/users/browse?topic=Loss of Parent")
        data = self.assert_response(response, 200, "Browse Users by Topic")
        
        if data and "users" in data:
            self.log(f"✅ Found {len(data['users'])} users with 'Loss of Parent' topic")
    
    def test_groups(self):
        """Test 7: Support Groups"""
        self.log("\n=== Testing Support Groups ===")
        
        # First seed groups
        response = requests.post(f"{BACKEND_URL}/api/seed-groups")
        self.assert_response(response, 200, "Seed Groups")
        
        # Get groups
        response = self.session1.get(f"{BACKEND_URL}/api/groups")
        data = self.assert_response(response, 200, "Get Groups")
        
        if data and "groups" in data and len(data["groups"]) > 0:
            self.log(f"✅ Found {len(data['groups'])} groups")
            
            # Test joining a group
            first_group = data["groups"][0]
            group_id = first_group["group_id"]
            
            response = self.session1.post(f"{BACKEND_URL}/api/groups/{group_id}/join")
            join_data = self.assert_response(response, 200, "Join Group")
            
            if join_data:
                self.log(f"✅ Joined group: {first_group['name']}")
                
                # Test getting group messages
                response = self.session1.get(f"{BACKEND_URL}/api/groups/{group_id}/messages")
                msg_data = self.assert_response(response, 200, "Get Group Messages")
                
                if msg_data and "messages" in msg_data:
                    self.log(f"✅ Retrieved {len(msg_data['messages'])} group messages")
                
                # Test sending group message
                message_data = {
                    "content": "Hello everyone, this is a test message from the grief support app testing.",
                    "message_type": "text"
                }
                
                response = self.session1.post(f"{BACKEND_URL}/api/groups/{group_id}/messages", json=message_data)
                send_data = self.assert_response(response, 200, "Send Group Message")
                
                if send_data and "message" in send_data:
                    self.log(f"✅ Sent group message successfully")
                    
                return group_id
        return None
    
    def test_connections(self):
        """Test 8: Connection Requests"""
        self.log("\n=== Testing Connection Requests ===")
        
        # Send connection request from user 1 to user 2
        message = "Hi, I'd like to connect with you for grief support. We share similar experiences."
        
        response = self.session1.post(f"{BACKEND_URL}/api/connections/request/{USER_ID_2}", 
                                    json={"message": message})
        request_data = self.assert_response(response, 200, "Send Connection Request")
        
        if not request_data:
            return None
            
        self.log(f"✅ Connection request sent")
        
        # Get connection requests for user 2
        response = self.session2.get(f"{BACKEND_URL}/api/connections/requests")
        requests_data = self.assert_response(response, 200, "Get Connection Requests")
        
        if requests_data and "requests" in requests_data and len(requests_data["requests"]) > 0:
            self.log(f"✅ Found {len(requests_data['requests'])} pending requests")
            
            # Accept the first request
            first_request = requests_data["requests"][0]
            request_id = first_request["request_id"]
            
            response = self.session2.post(f"{BACKEND_URL}/api/connections/respond/{request_id}?accept=true")
            accept_data = self.assert_response(response, 200, "Accept Connection")
            
            if accept_data and "conversation_id" in accept_data:
                self.log(f"✅ Connection accepted, conversation created")
                return accept_data["conversation_id"]
        
        return None
    
    def test_conversations(self, conversation_id=None):
        """Test 9: 1-to-1 Conversations"""
        self.log("\n=== Testing Conversations ===")
        
        if not conversation_id:
            self.log("❌ No conversation ID available for testing")
            self.results["failed"] += 1
            return
        
        # Get conversations list
        response = self.session1.get(f"{BACKEND_URL}/api/conversations")
        data = self.assert_response(response, 200, "Get Conversations")
        
        if data and "conversations" in data:
            self.log(f"✅ Found {len(data['conversations'])} conversations")
        
        # Get specific conversation
        response = self.session1.get(f"{BACKEND_URL}/api/conversations/{conversation_id}")
        conv_data = self.assert_response(response, 200, "Get Conversation")
        
        if conv_data and "conversation_id" in conv_data:
            self.log(f"✅ Retrieved conversation details")
        
        # Get messages in conversation
        response = self.session1.get(f"{BACKEND_URL}/api/conversations/{conversation_id}/messages")
        msg_data = self.assert_response(response, 200, "Get Conversation Messages")
        
        if msg_data and "messages" in msg_data:
            self.log(f"✅ Retrieved {len(msg_data['messages'])} conversation messages")
        
        # Send a message in conversation
        message_data = {
            "content": "Thank you for accepting my connection. I hope we can support each other through our grief journey.",
            "message_type": "text"
        }
        
        response = self.session1.post(f"{BACKEND_URL}/api/conversations/{conversation_id}/messages", 
                                    json=message_data)
        send_data = self.assert_response(response, 200, "Send Conversation Message")
        
        if send_data and "message" in send_data:
            self.log(f"✅ Sent conversation message successfully")
    
    def test_ai_crisis_detection(self):
        """Test 10: AI Crisis Detection"""
        self.log("\n=== Testing AI Crisis Detection ===")
        
        # Create a test conversation first
        response = self.session1.get(f"{BACKEND_URL}/api/conversations")
        conv_data = self.assert_response(response, 200, "Get Conversations for Crisis Test")
        
        if not conv_data or not conv_data.get("conversations"):
            self.log("⚠️ No conversations available for crisis detection test")
            return
        
        conversation_id = conv_data["conversations"][0]["conversation_id"]
        
        # Test with a message that might trigger crisis detection
        crisis_message = {
            "content": "I'm feeling really overwhelmed with grief and don't know how to cope anymore. Everything feels hopeless.",
            "message_type": "text"
        }
        
        response = self.session1.post(f"{BACKEND_URL}/api/conversations/{conversation_id}/messages", 
                                    json=crisis_message)
        crisis_data = self.assert_response(response, 200, "Send Crisis Message")
        
        if crisis_data and "message" in crisis_data:
            message = crisis_data["message"]
            self.log(f"✅ Crisis detection processed")
            
            if message.get("crisis_detected"):
                self.log(f"⚠️ Crisis detected in message")
                if "crisis_alert" in crisis_data:
                    self.log(f"✅ Crisis alert generated with resources")
            else:
                self.log(f"ℹ️ No crisis detected in test message")
    
    def run_all_tests(self):
        """Run all backend tests"""
        self.log("🚀 Starting Grief Support App Backend Testing")
        self.log(f"Backend URL: {BACKEND_URL}")
        
        try:
            # Core API tests
            self.test_health_check()
            self.test_grief_topics()
            
            # Auth and profile tests
            user_data = self.test_auth_me()
            if user_data:
                self.test_user_profile_get()
                self.test_user_profile_update()
                self.test_browse_users()
                
                # Group tests
                group_id = self.test_groups()
                
                # Connection and conversation tests
                conversation_id = self.test_connections()
                if conversation_id:
                    self.test_conversations(conversation_id)
                
                # AI crisis detection
                self.test_ai_crisis_detection()
            
        except Exception as e:
            self.log(f"❌ Test suite failed with exception: {str(e)}", "ERROR")
            self.results["failed"] += 1
        
        # Print final results
        self.log(f"\n📊 Test Results:")
        self.log(f"✅ Passed: {self.results['passed']}")
        self.log(f"❌ Failed: {self.results['failed']}")
        
        if self.results["errors"]:
            self.log(f"\n🚨 Errors:")
            for error in self.results["errors"]:
                self.log(f"  - {error}")
        
        success_rate = (self.results['passed'] / (self.results['passed'] + self.results['failed'])) * 100 if (self.results['passed'] + self.results['failed']) > 0 else 0
        self.log(f"\n🎯 Success Rate: {success_rate:.1f}%")
        
        return success_rate >= 80  # Consider 80%+ success rate as passing

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)