from .celery_app import celery_app

@celery_app.task
def send_verification_email(email, code):
    print(f"Отправка письма на {email} с кодом {code}")