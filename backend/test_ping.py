import requests
response = requests.get("http://localhost:8000/ping")
print(f"Status: {response.status_code}")
print(f"Response: {response.text}")
