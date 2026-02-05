from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Lead, Message, Conversation

# Adjust DB URL if needed (from .env)
# .env says: DATABASE_URL=mysql+pymysql://root:root@localhost:3306/autosqp
#But commented line says sqlite. I should check which one is active.
# .env content from previous turns showed:
# DATABASE_URL=mysql+pymysql://root:root@localhost:3306/autosqp

DATABASE_URL = "mysql+pymysql://root:root@localhost:3306/autosqp"

try:
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    print("--- LEADS ---")
    leads = db.query(Lead).order_by(Lead.id.desc()).limit(5).all()
    for l in leads:
        print(f"ID: {l.id} | Name: {l.name} | Phone: {l.phone} | Company: {l.company_id} | Status: {l.status}")

    print("\n--- CONVERSATIONS ---")
    convs = db.query(Conversation).order_by(Conversation.id.desc()).limit(5).all()
    for c in convs:
        print(f"ID: {c.id} | LeadID: {c.lead_id} | LastMsg: {c.last_message_at}")

    print("\n--- MESSAGES ---")
    msgs = db.query(Message).order_by(Message.id.desc()).limit(5).all()
    for m in msgs:
        print(f"ID: {m.id} | ConvID: {m.conversation_id} | Content: {m.content}")

    print("\n--- USERS ---")
    from models import User
    users = db.query(User).limit(10).all()
    for u in users:
        print(f"ID: {u.id} | Email: {u.email} | RoleID: {u.role_id} | Company: {u.company_id}")

except Exception as e:
    print(f"Error: {e}")
