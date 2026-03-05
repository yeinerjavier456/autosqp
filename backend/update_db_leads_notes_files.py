from database import engine
from models import Base, LeadNote, LeadFile

def main():
    print("Creating new tables (lead_notes, lead_files) if they don't exist...")
    try:
        Base.metadata.create_all(bind=engine)
        print("Success! The new tables were created in the database.")
    except Exception as e:
        print(f"Error creating tables: {e}")

if __name__ == "__main__":
    main()
