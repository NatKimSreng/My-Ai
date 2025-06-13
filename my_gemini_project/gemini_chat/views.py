import google.generativeai as genai
import os
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from .models import Conversation
import json
import logging

logger = logging.getLogger(__name__)

def configure_gemini_api():
    try:
        api_key = os.environ["GOOGLE_API_KEY"]
        genai.configure(api_key=api_key)
    except KeyError:
        logger.error("GOOGLE_API_KEY not found")
        raise

try:
    configure_gemini_api()
    gemini_model = genai.GenerativeModel(model_name="gemini-1.5-flash-latest")
except Exception as e:
    gemini_model = None
    logger.error(f"Failed to initialize Gemini: {e}")

def generate_content_from_gemini(model, user_prompt, temperature=0.7, max_output_tokens=10000):
    if not model:
        return "AI model not initialized. Please check server configuration."

    generation_config = genai.types.GenerationConfig(
        temperature=temperature,
        max_output_tokens=max_output_tokens,
    )

    safety_settings = {
        'HARM_CATEGORY_HARASSMENT': 'BLOCK_NONE',
        'HARM_CATEGORY_HATE_SPEECH': 'BLOCK_NONE',
        'HARM_CATEGORY_SEXUALLY_EXPLICIT': 'BLOCK_NONE',
        'HARM_CATEGORY_DANGEROUS_CONTENT': 'BLOCK_NONE',
    }

    try:
        response = model.generate_content(
            user_prompt,
            generation_config=generation_config,
            safety_settings=safety_settings
        )
        if response.candidates:
            if hasattr(response.candidates[0].content, 'parts'):
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'text'):
                        return part.text
            elif hasattr(response.candidates[0], 'text'):
                return response.candidates[0].text
            return "No text content found in response."
        block_reason = response.prompt_feedback.block_reason if response.prompt_feedback else "unknown reason"
        return f"Content blocked by safety filters: {block_reason}. Please rephrase your prompt."
    except genai.types.BlockedPromptException as e:
        logger.warning(f"Prompt blocked: {e}")
        return f"Prompt blocked by safety filters: {e}. Try a different phrasing."
    except Exception as e:
        logger.error(f"Generation error: {e}")
        return f"Error generating response: {str(e)}. Please try again."

def chat_view(request):
    return render(request, 'gemini_chat/index.html', {})

@csrf_exempt
def generate_ai_response(request):
    if request.method == 'POST':
        try:
            if not request.body:
                logger.error("Empty request body")
                return JsonResponse({'error': 'Empty request body'}, status=400)

            try:
                data = json.loads(request.body.decode('utf-8'))
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {e}")
                return JsonResponse({'error': 'Invalid JSON'}, status=400)

            user_prompt = data.get('prompt')
            if user_prompt is None or not user_prompt.strip():
                logger.warning("No valid prompt provided")
                return JsonResponse({'error': 'No valid prompt provided'}, status=400)

            # Build full prompt with all history (ignore is_visible)
            all_history = Conversation.objects.all().order_by('timestamp')
            full_prompt = "\n".join([f"User: {entry.user_prompt}\n {entry.ai_response}" for entry in all_history if entry.ai_response]) + f"\nUser: {user_prompt}"

            # Generate AI response
            ai_response = generate_content_from_gemini(gemini_model, full_prompt)

            # Save to database
            conversation = Conversation.objects.create(
                user_prompt=user_prompt,
                ai_response=ai_response,
                timestamp=timezone.now(),
                is_visible=True
            )

            # Retrieve visible chat history
            chat_history = Conversation.objects.filter(is_visible=True).order_by('timestamp')
            formatted_history = [
                {
                    'prompt': entry.user_prompt,
                    'response': entry.ai_response,
                    'timestamp': entry.timestamp.strftime('%H:%M')
                } for entry in chat_history
            ]

            return JsonResponse({'response': ai_response, 'chat_history': formatted_history})

        except Exception as e:
            logger.error(f"Server error: {e}")
            return JsonResponse({'error': f'Server error: {str(e)}'}, status=500)

    elif request.method == 'GET':
        try:
            # Retrieve visible chat history
            chat_history = Conversation.objects.filter(is_visible=True).order_by('timestamp')
            formatted_history = [
                {
                    'prompt': entry.user_prompt,
                    'response': entry.ai_response,
                    'timestamp': entry.timestamp.strftime('%H:%M')
                } for entry in chat_history
            ]

            return JsonResponse({'chat_history': formatted_history})
        except Exception as e:
            logger.error(f"Error fetching history: {e}")
            return JsonResponse({'error': f'Error fetching history: {str(e)}'}, status=500)

    logger.warning(f"Invalid method: {request.method}")
    return JsonResponse({'error': 'Invalid request method'}, status=405)

@csrf_exempt
def clear_history(request):
    if request.method == 'POST':
        try:
            Conversation.objects.filter(is_visible=True).update(is_visible=False)
            logger.info("Chat history marked as invisible")
            return JsonResponse({'message': 'Chat history cleared successfully'})
        except Exception as e:
            logger.error(f"Error clearing history: {e}")
            return JsonResponse({'error': f'Error clearing history: {str(e)}'}, status=500)
    return JsonResponse({'error': 'Invalid request method'}, status=405)