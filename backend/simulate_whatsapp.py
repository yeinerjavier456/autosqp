import requests
import json
import datetime


# URL of your local backend
URL = "http://localhost:8000/whatsapp/webhook"

def simulate_incoming_message(from_number, text):
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "display_phone_number": "15555555555",
                                "phone_number_id": "PHONE_NUMBER_ID"
                            },
                            "contacts": [{
                                "profile": {"name": "Test User"},
                                "wa_id": from_number
                            }],
                            "messages": [
                                {
                                    "from": from_number,
                                    "id": "wamid.HBgM...",
                                    "timestamp": str(int(datetime.datetime.now().timestamp())),
                                    "text": {"body": text},
                                    "type": "text"
                                }
                            ]
                        },
                        "field": "messages"
                    }
                ]
            }
        ]
    }
    
    try:
        print(f"Sending message from {from_number}: {text}")
        response = requests.post(URL, json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("--- WhatsApp Webhook Simulator ---")
    phone = input("Enter sender phone number (e.g. 573001234567): ") or "573001234567"
    msg = input("Enter message text: ") or "Hola, estoy interesado en un vehículo."
    simulate_incoming_message(phone, msg)
