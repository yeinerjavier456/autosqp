import requests
import json

BASE_URL = "http://localhost:8000"

def test_health():
    try:
        print("Testing /health...")
        resp = requests.get(f"{BASE_URL}/health", timeout=5)
        print(f"Health Status: {resp.status_code}")
        print(f"Response: {resp.text}")
    except Exception as e:
        print(f"Health Check Failed: {e}")

def test_webhook():
    try:
        print("\nTesting /whatsapp/webhook POST...")
        payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "123456789",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {
                            "display_phone_number": "15555555555",
                            "phone_number_id": "123456"
                        },
                        "contacts": [{"profile": {"name": "Python User"}, "wa_id": "573005555555"}],
                        "messages": [{
                            "from": "573005555555",
                            "id": "wamid.PYTHON1",
                            "timestamp": "1672531200",
                            "text": {"body": "Test message via python script"},
                            "type": "text"
                        }]
                    },
                    "field": "messages"
                }]
            }]
        }
        resp = requests.post(f"{BASE_URL}/whatsapp/webhook", json=payload, timeout=10)
        print(f"Webhook Status: {resp.status_code}")
        print(f"Response: {resp.text}")
    except Exception as e:
        print(f"Webhook Failed: {e}")

if __name__ == "__main__":
    test_health()
    test_webhook()
