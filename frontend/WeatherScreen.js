import React, { useState } from 'react';
import {
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    Button,
    StyleSheet,
    Alert,
    View,
    Image
} from 'react-native';
import { fetchWeatherByCity, fetchForecastByCity } from './utils/api';

const WeatherScreen = () => {
    const [city, setCity] = useState('');
    const [currentCity, setCurrentCity] = useState('');
    const [time, setTime] = useState('');
    const [temperature, setTemperature] = useState('');
    const [description, setDescription] = useState('');
    const [icon, setIcon] = useState('');
    const [forecastData, setForecastData] = useState([]);

    const onSubmit = async () => {
        try {
            const weather_data = await fetchWeatherByCity(city);
            const { name, dt, main, weather } = weather_data;
            const temp = main.temp;
            const desc = weather[0].description;
            const iconCode = weather[0].icon;
            const date = new Date(dt * 1000);
            const year = date.getFullYear();
            const month = ('0' + (date.getMonth() + 1)).slice(-2);
            const day = ('0' + date.getDate()).slice(-2);
            const hours = ('0' + date.getHours()).slice(-2);
            const minutes = ('0' + date.getMinutes()).slice(-2);
            const seconds = ('0' + date.getSeconds()).slice(-2);
            const dt_txt = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

            setCity(name);
            setCurrentCity(name);
            setTime(dt_txt);
            setTemperature(temp);
            setDescription(desc);
            setIcon(iconCode);

            const forecast = await fetchForecastByCity(city);
            setForecastData(forecast.list);
        } catch (error) {
            Alert.alert('Error', 'Could not fetch weather data.');
        }
    };

    const getIconUrl = (iconCode) => `http://openweathermap.org/img/wn/${iconCode}@2x.png`;

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.container}>
                <Text style={styles.title}>Real-time Weather Around the World</Text>
                <TextInput
                    style={styles.cityInput}
                    placeholder="Please enter a city here"
                    placeholderTextColor="#ffffff"
                    onChangeText={setCity}
                    value={city}
                />
                <Button title="Submit" onPress={onSubmit} />

                {currentCity !== '' && temperature !== '' && description !== '' && (
                    <View style={styles.weatherInfo}>
                        <Text style={styles.infoText}>City: {currentCity}</Text>
                        <Text style={styles.infoText}>Time: {time}</Text>
                        <Text style={styles.infoText}>Temperature: {temperature}{'\u00B0'}C</Text>
                        <View style={styles.descriptionContainer}>
                            <Text style={styles.infoText}>Description: {description}</Text>
                            {icon && (
                                <Image
                                    style={styles.weatherIcon}
                                    source={{ uri: getIconUrl(icon) }}
                                />
                            )}
                        </View>
                    </View>
                )}

                {forecastData.length > 0 && (
                    <>
                        <Text style={styles.headingInfo}>History / Forecast:</Text>
                        <View style={styles.forecastContainer}>
                            {forecastData.slice(0, 10).map((item, index) => {
                                const forecastIcon = item.weather[0].icon;
                                return (
                                    <View key={index} style={styles.forecastItem}>
                                        <Text style={styles.infoText}>Date/Time: {item.dt_txt}</Text>
                                        <Text style={styles.infoText}>Temperature: {item.main.temp}{'\u00B0'}C</Text>
                                        <View style={styles.descriptionContainer}>
                                            <Text style={styles.infoText}>
                                                Description: {item.weather[0].description}
                                            </Text>
                                            <Image
                                                style={styles.weatherIcon}
                                                source={{ uri: getIconUrl(forecastIcon) }}
                                            />
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </>
                )}
                <Text style={styles.bottom}></Text>
            </ScrollView>
        </SafeAreaView>
    );
};

export default WeatherScreen;

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#1a1a2e'
    },
    container: {
        flexGlow: 1,
        padding: 50,
        backgroundColor: '#1a1a2e'
    },
    title: {
        fontSize: 18,
        marginBottom: 20,
        color: '#ffffff'
    },
    cityInput: {
        height: 40,
        padding: 5,
        borderColor: '#ffffff',
        borderWidth: 1,
        marginBottom: 10,
        color: '#ffffff'
    },
    weatherInfo: {
        marginTop: 20,
    },
    headingInfo: {
        marginTop: 20,
        fontWeight: 'bold',
        color: '#ffffff'
    },
    infoText: {
        fontSize: 16,
        marginBottom: 5,
        color: '#ffffff'
    },
    forecastContainer: {
        marginTop: 20
    },
    forecastItem: {
        marginBottom: 10,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc'
    },
    descriptionContainer: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    weatherIcon: {
        width: 40,
        height: 40,
        marginLeft: 10,
        backgroundColor: '#FFD580'
    },
    bottom: {
        marginTop: 50
    }
});