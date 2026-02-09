import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

# Connect to MySQL server (no database selected yet)
# We assume root:root as per user request
connection = pymysql.connect(
    host='localhost',
    user='root',
    password='root',
    charset='utf8mb4',
    cursorclass=pymysql.cursors.DictCursor
)

try:
    with connection.cursor() as cursor:
        print("Resetting database 'autosqp'...")
        cursor.execute("DROP DATABASE IF EXISTS autosqp")
        cursor.execute("CREATE DATABASE autosqp")
        print("Database 'autosqp' reset successfully.")
finally:
    connection.close()
