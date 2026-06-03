from backend import tasks


def test_send_verification_email_task_callable():
    # Ensure the celery task function is available and callable (does not require running celery broker)
    assert hasattr(tasks, "send_verification_email")
    # call with test values; it should not raise
    tasks.send_verification_email("a@b.test", "000000")
