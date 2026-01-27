from database import SessionLocal
import models
import datetime
import random

def seed_leads():
    db = SessionLocal()
    try:
        print("Seeding leads...")
        
        # Get existing companies to assign leads to
        companies = db.query(models.Company).all()
        if not companies:
            print("No companies found. Create a company first.")
            return

        sources = ['facebook', 'tiktok', 'whatsapp']
        statuses = ['new', 'contacted', 'converted', 'closed']
        
        # Mock names and messages
        names = ["Juan Perez", "Maria Garcia", "Carlos Lopez", "Ana Martinez", "Luis Rodriguez", "Sofia Hernandez", "Diego Gonzalez"]
        messages = [
            "Hola, estoy interesado en el modelo X.",
            "¿Cuál es el precio financiado?",
            "Vi su anuncio en TikTok, quiero más info.",
            "Agendar cita para test drive.",
            "¿Tienen disponibilidad inmediata?",
            "Información sobre garantía."
        ]

        for _ in range(20): # Generate 20 leads
            company = random.choice(companies)
            source = random.choice(sources)
            name = random.choice(names)
            
            lead = models.Lead(
                created_at=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                source=source,
                name=name,
                email=f"{name.lower().replace(' ', '.')}@example.com",
                phone=f"+57 300 {random.randint(1000000, 9999999)}",
                message=random.choice(messages),
                status=random.choice(statuses),
                company_id=company.id
            )
            db.add(lead)
        
        db.commit()
        print("Successfully seeded 20 mock leads.")
        
    except Exception as e:
        print(f"Error seeding leads: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_leads()
