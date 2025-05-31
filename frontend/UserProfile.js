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
import constants from './constants.json';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

export default function UserProfile() {
    const [username, setUsername] = useState('');
    const [city, setCity] = useState('');
    const [userId, setUserId] = useState(-1);
    const [expoToken, setExpoToken] = useState('');
    const [pushEnabled, setPushEnabled] = useState(false);
    const [loading, setLoading] = useState(false);

    // Load saved profile info
    useEffect(() => {
        const loadProfile = async () => {
            try {
                const savedUsername = await AsyncStorage.getItem('userProfile_username');
                const savedCity = await AsyncStorage.getItem('userProfile_city');
                const savedUserId = await AsyncStorage.getItem('userProfile_userId');
                if (savedUsername) setUsername(savedUsername);
                if (savedCity) setCity(savedCity);
                if (savedUserId) setUserId(parseInt(savedUserId));

                const storedPush = await AsyncStorage.getItem('userProfile_pushEnabled');
                if (storedPush !== null) {
                    setPushEnabled(storedPush === 'true');
                }

                const savedToken = await AsyncStorage.getItem('userProfile_token');
                if (savedToken) setExpoToken(savedToken);
            }
            catch (e) {
                console.log('Failed to load profile from storage:', e);
            }
        };

        loadProfile();

        // Register notification listeners
        const subscription1 = Notifications.addNotificationReceivedListener(notification => {
            console.log('Notification Received →', notification);
        });
        const subscription2 = Notifications.addNotificationResponseReceivedListener(response => {
            console.log('Notification Response →', response);
        });

        return () => {
            subscription1.remove();
            subscription2.remove();
        };
    }, []);

    const handleSubmit = async () => {
        if (!username.trim() || !city.trim()) {
            Alert.alert('Error', 'Please enter both username and city.');
            return;
        }
        setLoading(true);

        try {
            // Remove previously saved data and save to local AsyncStorage:
            await AsyncStorage.multiRemove([
                'userProfile_username',
                'userProfile_city',
                'userProfile_pushEnabled'
            ]);
            await AsyncStorage.setItem('userProfile_username', username);
            await AsyncStorage.setItem('userProfile_city', city);
            await AsyncStorage.setItem('userProfile_pushEnabled', pushEnabled.toString());

            // POST /user to create or update user
            const createResp = await fetch(`http://${constants.SERVER_IP}:3001/user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, city, userId }),
            });
            const createData = await createResp.json();
            if (!createResp.ok) {
                Alert.alert('Error', createData.error || 'Failed to create/update profile.');
                setLoading(false);
                return;
            }

            // Save userId to AsyncStorage
            if (!userId && userId != createData.user_id) {
                setUserId(createData.user_id);
                await AsyncStorage.removeItem('userProfile_userId');
                await AsyncStorage.setItem('userProfile_userId', createData.user_id.toString());
            }

            // If push is enabled, register/get Expo token and send it to backend
            if (pushEnabled) {
                let token = expoToken;
                if (!token) {
                    token = await registerForPushNotificationsAsync();
                    if (token) {
                        setExpoToken(token);
                        await AsyncStorage.setItem('userProfile_token', token);
                    }
                }
                if (token) {
                    await sendTokenToBackend(token, (userId != -1) ? userId : createData.user_id);
                }
            }
            else {
                // If push is disabled, notify backend to remove the Expo token
                await fetch(`http://${constants.SERVER_IP}:3001/remove-expo-token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: (userId == -1) ? createData.user_id : userId }),
                });
            }

            Alert.alert('Success', 'Profile saved!');
        } catch (err) {
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
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ marginRight: 8, fontSize: 16 }}>Enable Push Notifications:</Text>
                    <Switch
                        value={pushEnabled}
                        onValueChange={(value) => setPushEnabled(value)}
                    />
                </View>
                <Button
                    title={loading ? "Saving…" : "Save"}
                    onPress={handleSubmit}
                    disabled={loading}
                />
            </View>
        </KeyboardAvoidingView>
    );
}

// Ask for permission and get an Expo Push Token
async function registerForPushNotificationsAsync() {
    let token;
    if (!Device.isDevice) {
        Alert.alert('Must use a physical device for Push Notifications');
        return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    if (finalStatus !== 'granted') {
        Alert.alert('Failed to get push token for push notifications!');
        return null;
    }

    // Get the token from Expo
    token = (await Notifications.getExpoPushTokenAsync()).data;
    return token;
}

// Send the Expo Push Token to backend
async function sendTokenToBackend(token, userId) {
    try {
        const resp = await fetch(`http://${constants.SERVER_IP}:3001/expo-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                token: token,
                platform: Platform.OS
            }),
        });
        if (!resp.ok) {
            console.error('Failed to send Expo token to backend');
        }
    } catch (error) {
        console.error('Error sending Expo token to backend:', error);
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