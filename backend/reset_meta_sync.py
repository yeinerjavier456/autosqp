from database import SessionLocal
from models import Lead, Conversation, Message, LeadHistory, Sale, LeadReminder, SentAlertLog
import time

def clear_meta_data():
    db = SessionLocal()
    try:
        print("Buscando todos los Leads sincronizados desde Facebook e Instagram...")
        leads = db.query(Lead).filter(Lead.source.in_(["facebook", "instagram"])).all()
        
        if not leads:
            print("No se encontraron leads de Meta. ¡Ya está todo limpio!")
            return

        count_leads = 0
        count_convs = 0
        count_msgs = 0

        print(f"Se encontraron {len(leads)} leads. Borrando mensajes y conversaciones...")

        for lead in leads:
            # 1. Borrar dependencias secundarias primero (Ventas, Recordatorios, Alertas, Historial de estados)
            db.query(Sale).filter(Sale.lead_id == lead.id).delete(synchronize_session=False)
            db.query(LeadReminder).filter(LeadReminder.lead_id == lead.id).delete(synchronize_session=False)
            db.query(SentAlertLog).filter(SentAlertLog.lead_id == lead.id).delete(synchronize_session=False)
            db.query(LeadHistory).filter(LeadHistory.lead_id == lead.id).delete(synchronize_session=False)
            
            # 2. Encontrar la Conversacion
            conv = db.query(Conversation).filter(Conversation.lead_id == lead.id).first()
            if conv:
                # 3. Borrar los Mensajes asociados a la conversacion
                msgs_deleted = db.query(Message).filter(Message.conversation_id == conv.id).delete(synchronize_session=False)
                count_msgs += msgs_deleted
                
                # 4. Borrar Conversacion
                db.delete(conv)
                count_convs += 1
                
            # 5. Borrar el Lead en si
            db.delete(lead)
            count_leads += 1
            
        db.commit()
        
        print("\n===============================")
        print(f"LIMPIEZA COMPLETADA CON EXITO:")
        print(f"- {count_leads} Leads Reiniciados")
        print(f"- {count_convs} Conversaciones Reiniciadas")
        print(f"- {count_msgs} Mensajes Reiniciados")
        print("===============================\n")
        print("Ahora puedes volver a hacer clic en el boton 'Sincronizar' en tu pagina web de AutosQP.")
        print("La información bajará correctamente separando Facebook de Instagram.")

    except Exception as e:
        print(f"Hubo un error al borrar los datos: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    clear_meta_data()
