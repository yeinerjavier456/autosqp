import requests
from database import SessionLocal
from models import User
from auth_utils import create_access_token

db = SessionLocal()
try:
    user = db.query(User).filter(User.email == "admin@autosqp.com").first()
    if not user:
        print("User not found")
        exit(1)
        
    token = create_access_token(data={"sub": str(user.id), "role": user.role.name})
    headers = {"Authorization": f"Bearer {token}"}
    
    payload = {
        "name": "Test Lead Python",
        "message": "Testing 400 error",
        "source": "web",
        "phone": "3000000000"
        # No company_id sent
    }
    
    print(f"Sending Payload: {payload}")
    response = requests.post("http://localhost:8000/leads/", json=payload, headers=headers)
    
    print(f"Status: {response.status_code}")
    print(f"Response Body: {response.text}")

finally:
    db.close()
