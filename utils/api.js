import constants from '../constants.json';

const WEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather';
const FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast';
const API_KEY = constants.OPENWEATHER_API_KEY;

export const fetchWeatherByCity = async (city) => {
    try {
        const response = await fetch(`${WEATHER_URL}?q=${city}&appid=${API_KEY}&units=metric`);
        if (!response.ok) {
            throw new Error('Weather data not found');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching weather data:', error);
        throw error;
    }
};

export const fetchWeatherByCoordinates = async (lat, lon) => {
    try {
        const response = await fetch(`${WEATHER_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`);
        if (!response.ok) {
            throw new Error('Weather data not found');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching weather data:', error);
        throw error;
    }
};

export const fetchForecastByCity = async (city) => {
  try {
        const response = await fetch(`${FORECAST_URL}?q=${city}&appid=${API_KEY}&units=metric`);
        if (!response.ok) {
            throw new Error('Weather forecast data not found');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching weather forecast data:', error);
        throw error;
    }
};