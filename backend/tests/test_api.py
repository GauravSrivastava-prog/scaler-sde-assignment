"""
Signal Clone Backend Test Suite
Automated integration tests for Authentication, Mock OTP,
Conversations, Groups, Contacts, and Messaging APIs.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data


def test_auth_login_seeded_user():
    # Login as seeded user 'moxie'
    response = client.post(
        "/api/auth/login",
        json={"phone_or_username": "moxie", "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["username"] == "moxie"
    assert data["user"]["display_name"] in ["Moxie Marlinspike", "Gaurav"]


def test_mock_otp_flow():
    test_phone = "+15559998888"
    # Step 1: Request OTP
    req_resp = client.post("/api/auth/send-otp", json={"phone_number": test_phone})
    assert req_resp.status_code == 200
    req_data = req_resp.json()
    assert req_data["success"] is True
    assert req_data["mock_otp"] == "123456"

    # Step 2: Verify OTP
    verify_resp = client.post(
        "/api/auth/verify-otp",
        json={
            "phone_number": test_phone,
            "otp": "123456",
            "username": "otp_test_user",
            "display_name": "OTP Test User"
        }
    )
    assert verify_resp.status_code == 200
    v_data = verify_resp.json()
    assert "access_token" in v_data
    assert v_data["user"]["phone_number"] == test_phone


def test_conversations_and_messaging_flow():
    # Authenticate as Moxie
    login_resp = client.post(
        "/api/auth/login",
        json={"phone_or_username": "moxie", "password": "password123"}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch conversations
    conv_resp = client.get("/api/conversations", headers=headers)
    assert conv_resp.status_code == 200
    conversations = conv_resp.json()
    assert len(conversations) >= 3

    # Pick first conversation
    target_conv = conversations[0]
    conv_id = target_conv["id"]

    # Send a message
    msg_resp = client.post(
        f"/api/conversations/{conv_id}/messages",
        headers=headers,
        json={"content": "Automated test message for Signal clone evaluation", "message_type": "text"}
    )
    assert msg_resp.status_code == 200
    msg_data = msg_resp.json()
    assert msg_data["content"] == "Automated test message for Signal clone evaluation"
    assert msg_data["conversation_id"] == conv_id

    # Toggle reaction
    react_resp = client.post(
        f"/api/messages/{msg_data['id']}/reactions",
        headers=headers,
        json={"emoji": "🚀"}
    )
    assert react_resp.status_code == 200
    reactions = react_resp.json()
    assert any(r["emoji"] == "🚀" for r in reactions)

    # Mark as read
    read_resp = client.post(f"/api/conversations/{conv_id}/read", headers=headers)
    assert read_resp.status_code == 200


def test_group_creation_flow():
    # Authenticate as Edward
    login_resp = client.post(
        "/api/auth/login",
        json={"phone_or_username": "edward", "password": "password123"}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Search for user to add
    search_resp = client.get("/api/users/search?q=sarah", headers=headers)
    assert search_resp.status_code == 200
    users = search_resp.json()
    sarah = next(u for u in users if u["username"] == "sarah")

    # Create Group
    group_resp = client.post(
        "/api/groups",
        headers=headers,
        json={
            "title": "🔐 Red Team Ops",
            "member_user_ids": [sarah["id"]]
        }
    )
    assert group_resp.status_code == 201
    group_data = group_resp.json()
    assert group_data["is_group"] is True
    assert group_data["title"] == "🔐 Red Team Ops"
    assert len(group_data["participants"]) >= 2
