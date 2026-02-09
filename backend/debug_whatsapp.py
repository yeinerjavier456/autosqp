from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models

def check_data():
    db = SessionLocal()
    try:
        conversations = db.query(models.Conversation).all()
        print(f"Total Conversations: {len(conversations)}")
        for c in conversations:
            print(f" - ID: {c.id}, Lead: {c.lead.name} ({c.lead.phone}), Messages: {len(c.messages)}")
            
        leads = db.query(models.Lead).all()
        print(f"Total Leads: {len(leads)}")
        
        messages = db.query(models.Message).all()
        print(f"Total Messages: {len(messages)}")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_data()
