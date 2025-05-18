from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
from PIL import Image
import numpy as np
import os
import google.generativeai as genai
from io import BytesIO
import base64
import json
import requests
import datetime
import firebase_admin
from firebase_admin import credentials, messaging
from timezonefinder import TimezoneFinder
import pytz
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler

app = Flask(__name__)
CORS(app)

openweather_api_key = ""
gemini_api_key = ""
server_ip = ""
cred = ""
users = []
tf = TimezoneFinder()

# Load the API key from a JSON file
with open("constants.json") as f:
    data = json.load(f)
    openweather_api_key = data.get("OPENWEATHER_API_KEY", "")
    gemini_api_key = data.get("GEMINI_API_KEY", "")
    server_ip = data.get("SERVER_IP", "")
    cred = data.get("FIREBASE_CREDENTIALS", "")

# Initialize Firebase Admin SDK
if cred:
    firebase_admin.initialize_app(credentials.Certificate(cred))

with open("user.json", 'r') as f:
    users = json.load(f)

# Load your Keras model once at startup
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'cloud_model.keras')
model = tf.keras.models.load_model(MODEL_PATH)

CLASS_NAMES = [
    "cirrus", "cirrostratus", "cirrocumulus", "altocumulus", "altostratus",
    "cumulus", "cumulonimbus", "nimbostratus", "stratocumulus", "stratus", "contrail"
]
RAINFALL_PROB = {
    "cirrus": "Low", "cirrostratus": "Very Low", "cirrocumulus": "Very Low",
    "altocumulus": "Moderate", "altostratus": "Moderate", "cumulus": "Moderate",
    "cumulonimbus": "Very High", "nimbostratus": "High", "stratocumulus": "Moderate",
    "stratus": "Moderate", "contrail": "Very Low"
}

def preprocess_image(image_path):
    img = Image.open(image_path).convert('RGB')
    img = img.resize((224, 224))
    img = np.array(img) / 255.0
    img = np.expand_dims(img, axis=0)
    return img

@app.route('/generate-weather-image', methods=['POST'])
def generate_weather_image():
    data = request.get_json()
    prompt = data.get('prompt', '')
    prompt = f"Generate a realistic 200 x 200 image of a weather phenomenon based on the following description: {prompt}"

    try:
        genai.configure(api_key=gemini_api_key)
        client = genai.Client()
        response = client.models.generate_content(
            model="gemini-2.0-flash-preview-image-generation",
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_modalities=['TEXT', 'IMAGE']
            )
        )

        image_base64 = None
        text = None
        for part in response.candidates[0].content.parts:
            if getattr(part, 'text', None) is not None:
                text = part.text
            elif getattr(part, 'inline_data', None) is not None:
                # Convert binary image data to base64 string
                image = Image.open(BytesIO(part.inline_data.data))
                buffered = BytesIO()
                image.save(buffered, format="PNG")
                image_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')

        return jsonify({'imageBase64': image_base64, 'text': text})
    except Exception as e:
        return jsonify({'error': 'Failed to generate image.', 'details': str(e)}), 500

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded.'}), 400
    file = request.files['file']
    os.makedirs('uploads', exist_ok=True)
    file_path = os.path.join('uploads', file.filename)
    file.save(file_path)

    try:
        img = preprocess_image(file_path)
        pred = model.predict(img)[0]
        pred_idx = int(np.argmax(pred))
        pred_class = CLASS_NAMES[pred_idx]
        rainfall = RAINFALL_PROB[pred_class]
        os.remove(file_path)
        return jsonify({'class': pred_class, 'rainfall': rainfall})
    except Exception as e:
        return jsonify({'error': 'Failed to classify image.', 'details': str(e)}), 500

@app.route('user', methods=['POST'])
def add_user():
    data = request.get_json()
    current_user_id = int(data.get('user_id', 0))
    
    new_user_id = current_user_id + 1
    new_username = data.get('username', '')
    new_location = data.get('location', '')
    
    # Check if the username and location are provided
    if not new_username:
        return jsonify({'error': 'Username is required.'}), 400
    if not new_location:
        return jsonify({'error': 'Location is required.'}), 400
    
    # Check if the user already exists
    existing_users = users.get('users', [])
    for user in existing_users:
        if user.get('username') == new_username:
            return jsonify({'error': 'This username has already used by other users. Please enter another one.'}), 400

    # Add the new user to the list
    new_user = {
        'user_id': new_user_id,
        'name': data.get('name', ''),
        'location': data.get('location', ''),
        'created_at': datetime.datetime.now().isoformat()
    }

    users['users'].append(new_user)
    users['user_id'] = new_user_id

    # Save the updated user data to the JSON file
    with open("user.json", 'w') as f:
        json.dump(users, f, indent=4)

    return jsonify({'message': 'User added successfully.'})

@app.route('/user', methods=['GET'])
def get_user():
    for user in users['users']:
        if user.get('username') == request.args.get('username'):
            return jsonify(user.get('user_id', 0))
    return jsonify({'error': 'User not found.'}), 404

@app.route('/fcm-token', methods=['POST'])
def register_fcm_token():
    data = request.get_json()
    user_id = data.get('user_id', 0)
    token = data.get('token', '')

    # Find the user and update/add the token attribute
    found = False
    for user in users.get('users', []):
        if user.get('user_id') == user_id:
            user['token'] = token
            found = True
            break

    if not found:
        return jsonify({'error': 'User not found.'}), 404

    # Save the updated user data to the JSON file
    with open("user.json", 'w') as f:
        json.dump(users, f, indent=4)

    return jsonify({'message': 'FCM token registered successfully.'})

@app.route('/remove-fcm-token', methods=['POST'])
def remove_fcm_token():
    data = request.get_json()
    user_id = data.get('user_id', 0)

    # Find the user and remove the token attribute
    found = False
    for user in users.get('users', []):
        if user.get('user_id') == user_id:
            if 'token' in user:
                user['token'] = ""
            found = True
            break

    if not found:
        return jsonify({'error': 'User not found.'}), 404

    # Save the updated user data to the JSON file
    with open("user.json", 'w') as f:
        json.dump(users, f, indent=4)

    return jsonify({'message': 'FCM token removed successfully.'})

def get_local_time(lat, lon):
    timezone_str = tf.timezone_at(lat=lat, lng=lon)
    if not timezone_str:
        return None  # Could not determine timezone

    # 2. Get the current time in that timezone
    tz = pytz.timezone(timezone_str)
    local_time = datetime.now(tz)
    return local_time

def get_weather_notification(code):
    match code:
        # Group 2xx: Thunderstorm
        case 200 | 230:
            body = "Thunderstorm with light rain. Carry umbrella."
        case 201 | 231:
            body = "Thunderstorm with rain. Stay indoors."
        case 202 | 232:
            body = "Heavy thunderstorm. Avoid going out."
        case 210:
            body = "Light thunderstorm. Be cautious."
        case 211:
            body = "Thunderstorm. Stay safe."
        case 212:
            body = "Severe thunderstorm. Seek shelter."
        case 221:
            body = "Ragged thunderstorm. Stay alert."

        # Group 3xx: Drizzle
        case 300 | 310:
            body = "Light drizzle. Umbrella recommended."
        case 301 | 311:
            body = "Drizzle. Stay dry."
        case 302 | 312:
            body = "Heavy drizzle. Wear waterproofs."
        case 313 | 321:
            body = "Shower drizzle. Be prepared."
        case 314:
            body = "Heavy shower drizzle. Stay indoors."

        # Group 5xx: Rain
        case 500 | 520:
            body = "Light rain. Umbrella advised."
        case 501 | 521:
            body = "Moderate rain. Wear waterproofs."
        case 502 | 522:
            body = "Heavy rain. Avoid going out."
        case 503:
            body = "Very heavy rain. Stay indoors."
        case 504:
            body = "Extreme rain. Seek shelter."
        case 511:
            body = "Freezing rain. Roads may be icy."
        case 531:
            body = "Ragged shower rain. Be cautious."

        # Group 6xx: Snow
        case 600 | 620:
            body = "Light snow. Dress warmly."
        case 601 | 621:
            body = "Snowfall. Roads may be slippery."
        case 602 | 622:
            body = "Heavy snow. Avoid travel."
        case 611 | 612 | 613:
            body = "Sleet. Slippery conditions."
        case 615 | 616:
            body = "Rain and snow mix. Dress appropriately."

        # Group 7xx: Atmosphere
        case 701:
            body = "Mist. Low visibility."
        case 711:
            body = "Smoke. Air quality may be poor."
        case 721:
            body = "Haze. Limit outdoor activities."
        case 731 | 751 | 761:
            body = "Dusty conditions. Wear mask."
        case 741:
            body = "Fog. Drive carefully."
        case 762:
            body = "Volcanic ash. Stay indoors."
        case 771:
            body = "Squalls. Secure loose items."
        case 781:
            body = "Tornado. Seek immediate shelter."

        # Group 800: Clear
        case 800:
            body = "Clear sky. Enjoy your day."

        # Group 80x: Clouds
        case 801:
            body = "Few clouds. Pleasant weather."
        case 802:
            body = "Scattered clouds. Mild conditions."
        case 803:
            body = "Broken clouds. Overcast skies."
        case 804:
            body = "Overcast clouds. Possible rain."

        # Default case
        case _:
            body = "Weather data unavailable."

    return body

def send_single_notification(registration_token, title, body, custom_data=None):
    """Sends a single FCM message to a specific device token."""
    if not firebase_admin._apps:
         print("Firebase Admin SDK not initialized. Cannot send message.")
         return False, "SDK not initialized"

    # Build the message payload
    message = messaging.Message(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        data=custom_data, # Optional: Include custom data
        token=registration_token,
    )

    try:
        # Send the message
        response = messaging.send(message)
        # The response is a message ID string on success
        print(f'Successfully sent message to token {registration_token}: {response}')
        return True, response
    except Exception as e:
        print(f'Error sending message to token {registration_token}: {e}')
        return False, str(e)

def filter_user():
    user = users.get('users', [])
    tokens = users.get('tokens', [])

    for person in user:
        person_id = person.get('user_id', 0)
        city = person.get('location', '')
        person_token = person.get('token', '')
        name = person.get('name', '')
        if (city != "" and person_id != 0 and person_token != ""):
            # Calculate the time at the location
            # First, Use reverse geocoding to get the coordinates
            url = f"http://api.openweathermap.org/geo/1.0/direct?q={city}&limit=1&appid={openweather_api_key}"
            response = requests.get(url)
            if response.status_code == 200:
                data = response.json()
                if data:
                    lat = data[0]['lat']
                    lon = data[0]['lon']
                    # Second, get the current time at that longitude and latitude
                    local_time = get_local_time(lat, lon)
                    if local_time and local_time.hour == 7 and local_time.minute >= 30:
                        # Send notification to the user if local time is between 7:30 AM and 8:00 AM
                        weather_url = f"http://api.openweathermap.org/data/2.5/weather?q={city}&appid={openweather_api_key}"
                        weather_response = requests.get(weather_url)
                        if weather_response.status_code == 200:
                            weather_data = weather_response.json()
                            weather_id = weather_data['weather'][0]['id']
                            title = f"Good Morning {person.get('name', '')}!"
                            body = get_weather_notification(weather_id)
                            send_single_notification(person_token, title, body)
                        else:
                            print(f"Failed to get weather data for {city}: {weather_response.status_code}")
            else:
                print(f"Failed to get coordinates for {city}: {response.status_code}")
            

scheduler = BackgroundScheduler()
scheduler.add_job(filter_user, 'cron', minute=30)
scheduler.start()
app.run(host='0.0.0.0', port=3001)