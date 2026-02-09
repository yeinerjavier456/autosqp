import requests
from auth_utils import create_access_token

token = create_access_token(data={"sub": "1", "role": "super_admin"})
headers = {"Authorization": f"Bearer {token}"}

print(f"\nTesting with valid token: {token}")
try:
    response = requests.get("http://localhost:8000/users/me", headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")
except Exception as e:
    print(f"Request failed: {e}")
