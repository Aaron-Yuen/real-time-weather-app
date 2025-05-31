from flask import Flask, request, jsonify, send_file, make_response
from flask_cors import CORS
from PIL import Image
import numpy as np
import os
from google import genai
from google.genai import types
from io import BytesIO
import base64
import threading
import json
import requests
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

with open("user.json", 'r') as f:
    users = json.load(f)

CLOUD_TYPES = [
    "cirrus", "cirrostratus", "cirrocumulus", "altocumulus", "altostratus",
    "cumulus", "cumulonimbus", "nimbostratus", "stratocumulus", "stratus", "contrail", "clear sky"
]
RAINFALL_PROB = {
    "cirrus": "Low", "cirrostratus": "Very Low", "cirrocumulus": "Very Low",
    "altocumulus": "Moderate", "altostratus": "Moderate", "cumulus": "Moderate",
    "cumulonimbus": "Very High", "nimbostratus": "High", "stratocumulus": "Moderate",
    "stratus": "Moderate", "contrail": "Very Low", "clear sky": "Very low"
}
WEATHER_NAMES = [
    "Lightning",
    "Thunder",
    "Rainbow",
    "Halo",
    "Glory",
    "Fogbow",
    "Aurora Borealis",
    "Aurora Australis",
    "Sandstorm",
    "Dust Storm",
    "Haboob",
    "Blizzard",
    "Snowstorm",
    "Ice Storm",
    "Freezing Rain",
    "Sleet",
    "Graupel",
    "Hailstorm",
    "Dew",
    "Frost",
    "Mist",
    "Fog",
    "Haze",
    "Smoke",
    "Smog",
    "Drizzle",
    "Rain",
    "Heavy Rain",
    "Showers",
    "Downpour",
    "Monsoon",
    "Cloudburst",
    "Thunderstorm",
    "Supercell",
    "Tornado",
    "Waterspout",
    "Cyclone",
    "Hurricane",
    "Typhoon",
    "Gale",
    "Squall",
    "Microburst",
    "Derecho",
    "Heatwave",
    "Cold Wave",
    "Drought",
    "Flood",
    "Flash Flood",
    "Avalanche",
    "Mudslide",
    "Landslide",
    "Volcanic Ash",
    "Ball Lightning",
    "Fire Whirl",
    "Chinook Wind",
    "Katabatic Wind",
    "Foehn Wind",
    "Polar Vortex",
    "Atmospheric River",
    "Clear Sky",
    "Overcast",
    "Partly Cloudy",
    "Scattered Clouds",
    "Broken Clouds",
    "Contrail",
    "Virga",
    "Sun Dog",
    "Moonbow",
    "Ice Crystals",
    "Rime",
    "Hoarfrost",
    "Sea Breeze",
    "Land Breeze",
    "Tropical Depression",
    "Tropical Storm",
    "Windstorm",
    "Dust Devil",
    "Sun Shower",
    "Radiation Fog",
    "Advection Fog",
    "Freezing Fog",
    "Black Ice",
    "Whiteout",
    "Glaze",
    "Funnel Cloud",
    "Meteor Shower"
]
weather_rotation = 0

def preprocess_image(image_path, save_path=None):
    img = Image.open(image_path).convert('RGB')
    img = img.resize((224, 224))
    img_np = np.array(img) / 255.0
    img_np = np.expand_dims(img_np, axis=0)
    
    # Save the preprocessed image if a save_path is provided
    if save_path:
        img_to_save = (img_np[0] * 255).astype(np.uint8)
        img_pil = Image.fromarray(img_to_save)
        img_pil.save(save_path)
    
    return img_np

@app.route('/get-fact', methods=['GET'])
def get_fact():
    global weather_rotation, gemini_api_key
    prompt = f"Give me a short interesting fact or knowledge about the weather, {WEATHER_NAMES[weather_rotation]}. Return only the content of the fact."
    try:
        client = genai.Client(api_key=gemini_api_key)
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[prompt]
        )

        fact = ""
        for part in response.candidates[0].content.parts:
            if getattr(part, 'text', None) is not None:
                fact += part.text.strip() + " "
        resp = jsonify({'fact': fact.strip()})
        resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        weather_rotation = (weather_rotation + 7) % len(WEATHER_NAMES)
        return resp
    except Exception as e:
        return jsonify({'error': 'Failed to fetch fact.', 'details' : str(e)}), 500


@app.route('/generate-weather-image', methods=['GET'])
def generate_weather_image():
    prompt = request.args.get('text', '')
    prompt = f"Generate a realistic 200 x 200 png image based on the following description: {prompt}"

    try:
        client = genai.Client(api_key=gemini_api_key)
        response = client.models.generate_content(
            model="gemini-2.0-flash-preview-image-generation",
            contents=(prompt),
            config=genai.types.GenerateContentConfig(
                response_modalities=['TEXT', 'IMAGE']
            )
        )

        image_bytes = None
        image = None
        for part in response.candidates[0].content.parts:
            if getattr(part, 'inline_data', None) and getattr(part.inline_data, 'data', None):
                data = part.inline_data.data
                try:
                    image_bytes = base64.b64decode(data)
                except Exception as decode_err:
                    print(f"Base64 decode error: {decode_err}")
                    continue
                try:
                    image = Image.open(BytesIO(image_bytes))
                except Exception as img_err:
                    print(f"Failed to process image part: {img_err}")
                    image_bytes = None

        if image_bytes is None:
            return jsonify({'error': 'No image generated'}), 501
        
        response = make_response(send_file(
            BytesIO(image_bytes),
            mimetype='image/png',
            as_attachment=False,
            download_name='weather.png'
        ))
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        return response
    except Exception as e:
        print(f"Error generating image: {e}")
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
        new_file_path = os.path.join('uploads', 'processed_' + file.filename)
        preprocess_image(image_path=file_path, save_path=new_file_path)
        client = genai.Client(api_key=gemini_api_key)
        my_file = client.files.upload(file=new_file_path)

        for file in client.files.list():
            print(file)

        # Prepare the Gemini prompt
        class_names_str = ', '.join(CLOUD_TYPES)
        prompt = (
            f"This is a photo of clouds. "
            f"Classify the cloud in this image into one of these classes: {class_names_str}. "
            "Return only the class name."
        )

        # Use Gemini API for classification
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                {"text": prompt}, {"file_data": {"mime_type": "image/jpeg", "fileUri": my_file.uri}},
            ]
        )

        # Extract the class name from Gemini's response
        classification = None
        for part in response.candidates[0].content.parts:
            if getattr(part, 'text', None):
                classification = part.text.strip().lower()
                break


        client.files.delete(name=my_file.name)
        os.remove(file_path)
        os.remove(new_file_path)

        if classification and classification in CLOUD_TYPES:
            rainfall = RAINFALL_PROB[classification]
            return jsonify({'class': classification.title(), 'rainfall': rainfall})
        else:
            print(f"Unexpected classification response: {classification}")
            return jsonify({'error': 'Failed to classify the cloud image.', 'details': classification}), 500

    except Exception as e:
        print(f"Error during classification: {e}")
        client.files.delete(name=my_file.name)
        os.remove(file_path)
        os.remove(new_file_path)
        return jsonify({'error': 'Failed to classify the cloud image.', 'details': str(e)}), 500

user_file_lock = threading.Lock()

@app.route('/user', methods=['POST'])
def add_user():
    data = request.get_json()
    with user_file_lock:
        with open("user.json", 'r') as f:
            user_data = json.load(f)

        new_user_id = user_data.get('user_id', 0) + 1
        stored_user_id = data.get('userId', -1)
        new_username = data.get('username', '').strip()
        new_location = data.get('city', '').strip()

        print("Received data:", data)

        if not new_username:
            return jsonify({'error': 'Username is required.'}), 401
        if not new_location:
            return jsonify({'error': 'Location is required.'}), 402

        for u in user_data.get('users', []):
            if u.get('user_id', -1) == stored_user_id:
                u.update({
                    'user_id': u.get('user_id', -1),
                    'username': new_username,
                    'location': new_location,
                    'token': u.get('token', ''),
                    'created_at': u.get('created_at', datetime.now().isoformat())
                })
                with open("user.json", 'w') as f:
                    json.dump(user_data, f, indent=4)
                return jsonify({'message': 'Profile updated successfully.'}), 200


        new_user = {
            'user_id': new_user_id,
            'username': new_username,
            'location': new_location,
            'token': "",
            'created_at': datetime.now().isoformat()
        }
        user_data['users'].append(new_user)
        user_data['user_id'] = new_user_id

        with open("user.json", 'w') as f:
            json.dump(user_data, f, indent=4)

        return jsonify({'message': 'User added successfully.', 'user_id': new_user_id})

@app.route('/expo-token', methods=['POST'])
def register_expo_token():
    with open("user.json", 'r') as f:
        users = json.load(f)
    data_payload = request.get_json()
    user_id = data_payload.get('user_id', 0)
    expo_token = data_payload.get('token', '').strip()

    if not expo_token:
        print("expo token is empty")
        return jsonify({'error': 'Token is required.'}), 400

    found = False
    for u in users.get('users', []):
        print(u)
        if u.get('user_id') == user_id:
            u['token'] = expo_token
            found = True
            break

    if not found:
        print("user not found")
        return jsonify({'error': 'User not found.'}), 404

    with open("user.json", 'w') as f:
        json.dump(users, f, indent=4)

    print(f"Expo token registered for user {user_id}: {expo_token}")
    return jsonify({'message': 'Expo token registered successfully.'})

@app.route('/remove-expo-token', methods=['POST'])
def remove_expo_token():
    with open("user.json", 'r') as f:
        users = json.load(f)
    data_payload = request.get_json()
    user_id = data_payload.get('user_id', 0)

    found = False
    for u in users.get('users', []):
        if u.get('user_id') == user_id:
            u['token'] = ""
            found = True
            break

    if not found:
        return jsonify({'error': 'User not found.'}), 404

    with open("user.json", 'w') as f:
        json.dump(users, f, indent=4)

    return jsonify({'message': 'Expo token removed successfully.'})

def get_local_time(lat, lon):
    timezone_str = tf.timezone_at(lat=lat, lng=lon)
    if not timezone_str:
        return None

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

def send_expo_notification(expo_push_token, title, body, custom_data = None):
    
    payload = {
        "to": expo_push_token,
        "sound": "default",
        "title": title,
        "body": body,
        "data": custom_data or {}
    }

    res = requests.post(
        "https://exp.host/--/api/v2/push/send",
        json=payload,
        headers={"Accept": "application/json", "Accept-Encoding": "gzip, deflate"}
    )

    if res.status_code != 200:
        print(f"Error sending Expo push: {res.status_code} -> {res.text}")
        return False, res.text
    try:
        result = res.json()
        if isinstance(result, dict) and result.get("data") and result["data"].get("status") == "ok":
            return True, result
        return False, result
    except Exception as e:
        return False, str(e)

def filter_user():
    """
    This job runs periodically (e.g., every day at local 7:30–8:00) 
    and sends weather pushes to users whose local time is right.
    """
    with open("user.json", 'r') as f:
        users = json.load(f)

    for person in users.get('users', []):
        person_id = person.get('user_id', 0)
        city = person.get('location', '')
        expo_token = person.get('token', '')
        username = person.get('username', '')

        if city and person_id and expo_token:
            url_geo = f"http://api.openweathermap.org/geo/1.0/direct?q={city}&limit=1&appid={openweather_api_key}"
            resp_geo = requests.get(url_geo)
            if resp_geo.status_code != 200:
                print(f"Geo lookup failed for {city}: {resp_geo.status_code}")
                continue

            data_geo = resp_geo.json()
            if not data_geo:
                print(f"No geocoding data for {city}")
                continue

            lat = data_geo[0]['lat']
            lon = data_geo[0]['lon']
            local_time = get_local_time(lat, lon)
            if not local_time:
                continue

            # Send notification only if local time is between 7:30 and 8:00:
            if local_time.hour == 7 and 30 <= local_time.minute < 60:
                weather_url = f"http://api.openweathermap.org/data/2.5/weather?q={city}&appid={openweather_api_key}"
                weather_resp = requests.get(weather_url)
                if weather_resp.status_code != 200:
                    print(f"Weather fetch failed for {city}: {weather_resp.status_code}")
                    continue

                weather_data = weather_resp.json()
                weather_id = weather_data['weather'][0]['id']
                title = f"Good Morning {username}!"
                body = get_weather_notification(weather_id)

                success, result = send_expo_notification(expo_token, title, body)
                if not success:
                    print(f"Failed Expo push to {expo_token}: {result}")
            

scheduler = BackgroundScheduler()
scheduler.add_job(filter_user, 'cron', minute=30)
scheduler.start()
app.run(host='0.0.0.0', port=3001)