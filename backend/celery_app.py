from celery import Celery

celery_app = Celery(
    "play2study",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0"
)