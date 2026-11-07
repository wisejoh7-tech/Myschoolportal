import time
from django.http import JsonResponse
from django.db import connection

START_TIME = time.time()

def health_check(request):
    """
    Health check endpoint for AWS ALB, App Runner, and ECS target groups.
    Checks database connection and reports service status.
    """
    db_status = "connected"
    status_code = 200
    try:
        connection.ensure_connection()
    except Exception as e:
        db_status = f"disconnected: {str(e)}"
        status_code = 503

    return JsonResponse({
        "status": "healthy" if status_code == 200 else "unhealthy",
        "service": "uniportal-django-api",
        "database": db_status,
        "uptimeSeconds": round(time.time() - START_TIME, 2),
    }, status=status_code)
