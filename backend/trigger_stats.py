import requests
from database import SessionLocal
from models import User
from auth_utils import create_access_token

db = SessionLocal()
try:
    user = db.query(User).filter(User.id == 1).first() # Admin
    if not user:
        print("Admin user not found")
        exit(1)
        
    token = create_access_token(data={"sub": str(user.id), "role": user.role.name})
    print(f"Generated Token for {user.email}")
    
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get("http://localhost:8000/finance/stats", headers=headers)
    
    print(f"Status: {response.status_code}", flush=True)
    print(f"Raw Response: {response.text}", flush=True)
    # print(f"Response JSON: {response.json()}", flush=True)

finally:
    db.close()
