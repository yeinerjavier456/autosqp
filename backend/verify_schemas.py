import sys
import os

try:
    import schemas
    print("Schemas imported successfully.")
    if hasattr(schemas, 'CreditApplicationUpdate'):
        print("CreditApplicationUpdate found.")
    else:
        print("CreditApplicationUpdate NOT found.")
        print("Dir(schemas):", dir(schemas))
except Exception as e:
    print(f"Error importing schemas: {e}")
