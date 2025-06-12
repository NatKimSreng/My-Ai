import google.generativeai as genai
import os
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
import logging
from datetime import datetime

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

def generate_content_from_gemini(model, user_prompt, temperature=0.7, max_output_tokens=500):
    if not model:
        return "AI model not initialized."

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
            return "No text content found."
        return f"Blocked: {response.prompt_feedback.block_reason}" if response.prompt_feedback else "No content generated."
    except genai.types.BlockedPromptException as e:
        logger.error(f"Prompt blocked: {e}")
        return f"Blocked by safety: {e}"
    except Exception as e:
        logger.error(f"Generation error: {e}")
        return f"Generation error: {e}"

def chat_view(request):
    chat_history = request.session.get('chat_history', [])
    return render(request, 'gemini_chat/index.html', {'chat_history': chat_history})

@csrf_exempt
def generate_ai_response(request):
    if request.method != 'POST':
        logger.warning(f"Invalid method: {request.method}")
        return JsonResponse({'error': 'Invalid request method'}, status=405)

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

        chat_history = request.session.get('chat_history', [])
        full_prompt = "\n".join([f"User: {entry['prompt']}\nAI: {entry['response']}" for entry in chat_history[-5:]]) + f"\nUser: {user_prompt}"
        ai_response = generate_content_from_gemini(gemini_model, full_prompt)

        chat_history.append({
            'prompt': user_prompt,
            'response': ai_response,
            'timestamp': datetime.now().isoformat()  # Store timestamp as ISO string
        })
        request.session['chat_history'] = chat_history[-10:]
        request.session.modified = True

        return JsonResponse({'response': ai_response, 'chat_history': chat_history[-10:]})
    except Exception as e:
        logger.error(f"Server error: {e}")
        return JsonResponse({'error': f'Server error: {str(e)}'}, status=500)