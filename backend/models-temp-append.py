
class InternalMessage(Base):
    __tablename__ = "internal_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    sender_id = Column(Integer, ForeignKey("users.id"))
    content = Column(String(2000))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    company = relationship("Company")
    sender = relationship("User")
