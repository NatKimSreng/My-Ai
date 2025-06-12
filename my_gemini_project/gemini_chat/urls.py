# gemini_chat/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.chat_view, name='chat'),
    path('generate/', views.generate_ai_response, name='generate'),
]