import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    Button,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Switch
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { constants } from './constants.json';
import messaging from '@react-native-firebase/messaging';

export default function UserProfile({ navigation }) {
    const [username, setUsername] = useState('');
    const [city, setCity] = useState('');
    const [userId, setUserId] = useState(0);
    const [token, setToken] = useState('');
    const [pushEnabled, setPushEnabled] = useState(false);
    const [loading, setLoading] = useState(false);

    // Load saved profile info on mount
    useEffect(() => {
        const loadProfile = async () => {
            try {
                const savedUsername = await AsyncStorage.getItem('userProfile_username');
                const savedCity = await AsyncStorage.getItem('userProfile_city');
                if (savedUsername) setUsername(savedUsername);
                if (savedCity) setCity(savedCity);

                // Get the user ID from the backend
                const response = await fetch("http://" + constants.SERVER_IP + ":3001/user", {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: savedUsername })
                })
                const data = await response.json();
                if (response.ok) {
                    setUserId(data.userId);
                } else {
                    Alert.alert('Error', data.error || 'Failed to load user ID.');
                }

                // Check if push notifications are enabled
                const pushEnabled = await AsyncStorage.getItem('userProfile_pushEnabled');
                if (pushEnabled !== null) {
                    setPushEnabled(pushEnabled === 'true');
                } else {
                    // Request permission for push notifications
                    setPushEnabled(false);
                }

                // Get the FCM token
                const token = await AsyncStorage.getItem('userProfile_token');
                if (token) {
                    setToken(token);
                } else {
                    const newToken = await getFCMToken();
                    if (newToken) {
                        setToken(newToken);
                        await AsyncStorage.setItem('userProfile_token', newToken);
                    }
                }
            } catch (e) {
                console.log('Failed to load profile from storage');
            }
        };
        loadProfile();
    }, []);

    const handleSubmit = async () => {
        if (!username.trim() || !city.trim()) {
            Alert.alert('Error', 'Please enter both username and city.');
            return;
        }
        setLoading(true);
        try {
            // Save to local storage
            await AsyncStorage.setItem('userProfile_username', username);
            await AsyncStorage.setItem('userProfile_city', city);
            await AsyncStorage.setItem('userProfile_pushEnabled', pushEnabled.toString());

            // Optionally send to backend
            const response = await fetch("http://" + constants.SERVER_IP + ":3001/user", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    city
                }),
            });
            const data = await response.json();

            // Get the userID from the backend
            const userIdResponse = await fetch("http://" + constants.SERVER_IP + ":3001/user", {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            const userIdData = await userIdResponse.json();
            if (userIdResponse.ok) {
                setUserId(userIdData.userId);
            } else {
                Alert.alert('Error', userIdData.error || 'Failed to load user ID.');
            }

            // Handle push notifications
            if (pushEnabled){
                if (token == ''){
                    await requestUserPermission();
                    const token = await getFCMToken();
                    setToken(token);
                    await AsyncStorage.setItem('userProfile_token', token);
                }
                if (token) {
                    await sendTokenToBackend(token, userId);
                }
            }
            else{
                // Remove token from backend if push notifications are disabled
                await fetch("http://" + constants.SERVER_IP + ":3001/remove-fcm-token", {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId })
                });
            }

            if (response.ok) {
                Alert.alert('Success', 'Profile saved!');
                // navigation.navigate('Home');
            } else {
                Alert.alert('Error', data.error || 'Failed to create profile.');
            }
        } catch (error) {
            Alert.alert('Error', 'Network error. Please try again.');
        }
        setLoading(false);
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.container}>
                <Text style={styles.title}>User Profile</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Username"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                />
                <TextInput
                    style={styles.input}
                    placeholder="City"
                    value={city}
                    onChangeText={setCity}
                />
                <Switch
                    value={pushEnabled}
                    onValueChange={async (value) => {
                        setPushEnabled(value);
                    }}
                />
                <Button title={loading ? "Saving..." : "Save"} onPress={handleSubmit} disabled={loading} />
            </View>
        </KeyboardAvoidingView>
    );
}

async function requestUserPermission() {
    const authStatus = await messaging().requestPermission();
    const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
        console.log('Authorization status:', authStatus);
        // Permissions granted, now get the token
        getFCMToken(); // Call the function to get the token
    } else {
        console.log('User declined or has not granted permission');
        // You might want to inform the user why permissions are needed
    }
}

async function getFCMToken() {
    try {
        const token = await messaging().getToken();
        if (token) {
            return token;
        }
        else {
            console.log('Failed to get FCM token');
            return null;
        }
    } catch (error) {
        console.error('Error getting FCM token:', error);
        return null;
    }
}

async function sendTokenToBackend(token, userId) {
    // Replace with your actual backend API endpoint and logic
    try {
        const response = await fetch('YOUR_BACKEND_URL/register-fcm-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Add authentication headers if needed
            },
            body: JSON.stringify({
                userId: userId,
                fcmToken: token,
                platform: Platform.OS // Optional: send platform info
            }),
        });

        if (response.ok) {
            console.log('FCM token successfully sent to backend');
        } else {
            console.error('Failed to send FCM token to backend');
            // Handle error appropriately
        }
    } catch (error) {
        console.error('Error sending FCM token to backend:', error);
        // Handle network or other errors
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#f5f6fa',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 24,
        color: '#222b45',
    },
    input: {
        width: '100%',
        height: 48,
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 16,
        backgroundColor: '#fff',
        fontSize: 16,
    },
});