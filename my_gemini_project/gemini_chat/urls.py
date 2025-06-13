from django.urls import path
from . import views

urlpatterns = [
    path('', views.chat_view, name='chat_view'),
    path('generate/', views.generate_ai_response, name='generate_ai_response'),
    path('clear_history/', views.clear_history, name='clear_history'),
]