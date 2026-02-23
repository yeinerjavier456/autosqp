import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

# We configure to AutosQP AWS DB
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://autosqp_user:Autosqp2024*@localhost/autosqp"

engine = create_engine(SQLALCHEMY_DATABASE_URL)

try:
    with engine.connect() as conn:
        print("Conectado a la base de datos MySQL local.")
        
        print("Modificando facebook_access_token a TEXT...")
        conn.execute(text("ALTER TABLE integration_settings MODIFY COLUMN facebook_access_token TEXT;"))
        
        print("Modificando instagram_access_token a TEXT...")
        conn.execute(text("ALTER TABLE integration_settings MODIFY COLUMN instagram_access_token TEXT;"))
        
        print("Modificando tiktok_access_token a TEXT...")
        conn.execute(text("ALTER TABLE integration_settings MODIFY COLUMN tiktok_access_token TEXT;"))
        
        print("Modificando whatsapp_api_key a TEXT...")
        conn.execute(text("ALTER TABLE integration_settings MODIFY COLUMN whatsapp_api_key TEXT;"))
        
        print("Modificando openai_api_key a TEXT...")
        conn.execute(text("ALTER TABLE integration_settings MODIFY COLUMN openai_api_key TEXT;"))
        
        conn.commit()
        print("¡Columnas alteradas exitosamente para soportar tokens largos!")

except Exception as e:
    print(f"Error alterando esquema: {e}")
