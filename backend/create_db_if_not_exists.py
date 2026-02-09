import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

# Parse DATABASE_URL explicitly or just use hardcoded for this specific fix since we know the issue
# URL is mysql+pymysql://root:@localhost:3306/autosqp
DB_HOST = "localhost"
DB_USER = "root"
DB_PASS = ""
DB_NAME = "autosqp"

try:
    conn = pymysql.connect(host=DB_HOST, user=DB_USER, password=DB_PASS)
    cursor = conn.cursor()
    print(f"Conectado a MySQL en {DB_HOST}. Verificando base de datos '{DB_NAME}'...")
    
    cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME}")
    print(f"Base de datos '{DB_NAME}' verificada/creada.")
    
    conn.commit()
    conn.close()
except Exception as e:
    print(f"Error creando base de datos: {e}")
