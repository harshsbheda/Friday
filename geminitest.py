import google.generativeai as genai
import config

genai.configure(api_key=config.apikey)

generation_config = {
    "temperature": 0.7,
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 1024,
}

safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]

model = genai.GenerativeModel(
    model_name='gemini-2.5-flash',
    generation_config=generation_config,
    safety_settings=safety_settings
)

print("Gemini model initialized successfully")


def get_ai_response_with_context(query, history=[]):
    
    if not query or not query.strip():
        return "Please ask me something!"
    
    try:
        # Build detailed context for Gemini
        context_prompt = f"""You are Friday, an AI assistant like JARVIS from Iron Man. You are helpful, friendly, and conversational.
        You remember previous parts of our conversation. Be concise but informative. Use a professional yet warm tone and Response Friendly.
        ."""
    
        # Add conversation history if available
        if history and len(history) > 0:
            context_prompt += "PREVIOUS CONVERSATION:\n"
            context_prompt += "="*50 + "\n"
            
            # Format last 30 messages for context
            for i, msg in enumerate(history[-30:], 1):
                role_name = "User" if msg['role'] == 'user' else "Friday"
                context_prompt += f"{role_name}: {msg['content']}\n"
            
            context_prompt += "="*50 + "\n\n"
            context_prompt += "Remember the above conversation. Now respond to the current question while maintaining context.\n\n"
        
        # Add current query
        context_prompt += f"CURRENT QUESTION:\nUser: {query}\n\nFriday:"
        
        # Debug: Print context being sent (optional)
        print(f"\n{'='*60}")
        print("CONTEXT BEING SENT TO GEMINI:")
        print(context_prompt)
        print(f"{'='*60}\n")
        
        # Generate response
        response = model.generate_content(context_prompt)
        
        if not response.text:
            return "I apologize, but I couldn't generate a response. Please try rephrasing your question."
        
        return response.text.strip()
        
    except Exception as e:
        error_msg = str(e)
        print(f"AI Error: {error_msg}")
        
        if "quota" in error_msg.lower():
            return "I've reached my API quota limit. Please try again later."
        elif "api key" in error_msg.lower() or "invalid" in error_msg.lower():
            return "There's an issue with my API key. Please check the configuration."
        elif "404" in error_msg or "not found" in error_msg.lower():
            return "The AI model is not available. Please check the model name."
        else:
            return f"Sorry, I'm having trouble: {error_msg}"


# Keep old function for backward compatibility
def get_ai_response(query):
    return get_ai_response_with_context(query, [])