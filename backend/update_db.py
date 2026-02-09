from database import engine, Base
import models

# This will create tables that don't exist
models.Base.metadata.create_all(bind=engine)
print("Database schema updated.")
