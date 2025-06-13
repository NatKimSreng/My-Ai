from django.db import models
from django.utils import timezone

class Conversation(models.Model):
    user_prompt = models.TextField()  # User's input
    ai_response = models.TextField(blank=True, null=True)  # AI's response
    timestamp = models.DateTimeField(default=timezone.now)  # Timestamp
    is_visible = models.BooleanField(default=True)  # Visibility in UI

    class Meta:
        ordering = ['timestamp']  # Order by timestamp (oldest first)

    def __str__(self):
        return f"{self.user_prompt} - {self.timestamp}"