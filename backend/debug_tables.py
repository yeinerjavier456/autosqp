import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

connection = pymysql.connect(
    host='localhost',
    user='root',
    password='root',
    database='autosqp',
    charset='utf8mb4'
)

try:
    with connection.cursor() as cursor:
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()
        print("Tables in database 'autosqp':")
        for table in tables:
            print(table)
finally:
    connection.close()
