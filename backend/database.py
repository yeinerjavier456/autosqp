from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

check_same_thread = False
if "sqlite" in DATABASE_URL:
    connect_args = {"check_same_thread": False}
    engine = create_engine(
        DATABASE_URL, connect_args=connect_args
    )
else:
    connect_args = {}
    engine = create_engine(
        DATABASE_URL,
        connect_args=connect_args,
        pool_size=20,
        max_overflow=40,
        pool_recycle=1800,
        pool_pre_ping=True,
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
