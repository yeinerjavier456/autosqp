from database import engine, Base
from models import AutomationRule, SentAlertLog, Lead
from sqlalchemy import text
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def update_schema():
    logger.info("Connecting to database...")
    
    # Create new tables
    Base.metadata.create_all(bind=engine)
    logger.info("Tables checked/created.")

    # Check and add column status_updated_at to leads if not exists
    with engine.connect() as conn:
        try:
            # Check if column exists
            result = conn.execute(text("SHOW COLUMNS FROM leads LIKE 'status_updated_at'"))
            if result.fetchone():
                logger.info("Column 'status_updated_at' already exists in 'leads'.")
            else:
                logger.info("Adding 'status_updated_at' to 'leads'...")
                conn.execute(text("ALTER TABLE leads ADD COLUMN status_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP"))
                conn.commit()
                logger.info("Column added successfully.")
                
            # Check automation_rules company_id
            result_rules = conn.execute(text("SHOW COLUMNS FROM automation_rules LIKE 'company_id'"))
            if result_rules.fetchone():
                 logger.info("Column 'company_id' already exists in 'automation_rules'.")
            else:
                 logger.info("Adding 'company_id' to 'automation_rules'...")
                 conn.execute(text("ALTER TABLE automation_rules ADD COLUMN company_id INTEGER"))
                 conn.execute(text("ALTER TABLE automation_rules ADD CONSTRAINT fk_ar_company FOREIGN KEY (company_id) REFERENCES companies(id)"))
                 conn.commit()
                 
            # Check repetition
            result_rep = conn.execute(text("SHOW COLUMNS FROM automation_rules LIKE 'is_repeating'"))
            if not result_rep.fetchone():
                 logger.info("Adding repetition columns...")
                 conn.execute(text("ALTER TABLE automation_rules ADD COLUMN is_repeating BOOLEAN DEFAULT FALSE"))
                 conn.execute(text("ALTER TABLE automation_rules ADD COLUMN repeat_interval INTEGER DEFAULT 0"))
                 conn.commit()

        except Exception as e:
            logger.error(f"Error updating schema: {e}")

if __name__ == "__main__":
    update_schema()
