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
    db.close() # Close session to release lock
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Payload similar to frontend
    payload = {
        "name": "Test Lead Crash",
        "message": "Testing 500 error",
        "source": "web",
        "phone": "3000000000",
        "company_id": 1 
    }
    
    print(f"Sending Payload: {payload}")
    response = requests.post("http://localhost:8000/leads", json=payload, headers=headers)
    
    print(f"Status: {response.status_code}", flush=True)
    try:
        data = response.json()
        print(f"Assigned To ID: {data.get('assigned_to_id')}", flush=True)
        print(f"Raw Response: {data}")
    except Exception as e:
        print(f"Raw Response: {response.text}", flush=True)

finally:
    db.close()
