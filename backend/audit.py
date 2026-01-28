from typing import Any, Dict, Optional
from datetime import datetime, date
from backend.models import Base

def calculate_diff(old_obj: Base, new_data: Dict[str, Any], exclude: list = None) -> Optional[Dict[str, Any]]:
    """
    Calculates the difference between an SQLAlchemy model instance and a dictionary of new values.
    Returns a dictionary of changes: {field: {'old': val, 'new': val}}
    """
    if not old_obj:
        return None

    changes = {}
    exclude = exclude or ['updated_at', 'created_at', '_sa_instance_state']

    for key, new_value in new_data.items():
        if key in exclude:
            continue

        if not hasattr(old_obj, key):
            continue

        old_value = getattr(old_obj, key)

        # Normalize comparison
        if old_value != new_value:
            # Handle special types like Enum or Date if needed
            # For simplicity, strict equality check

            # Skip if both are falsy/none and equal logic
            if not old_value and not new_value:
                continue

            # Convert to string for serialization if needed, or keep as native JSON types
            # Pydantic/FastAPI will handle JSON serialization of common types
            # But specific objects might need str()

            def serialize(v):
                if isinstance(v, (datetime, date)):
                    return v.isoformat()
                if hasattr(v, 'value'): # Enum
                    return v.value
                return v

            changes[key] = {
                'old': serialize(old_value),
                'new': serialize(new_value)
            }

    return changes if changes else None
