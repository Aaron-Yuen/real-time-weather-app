import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Dimensions,
    Linking
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import HomeScreen from './HomeScreen';
import WeatherScreen from './WeatherScreen';
import CloudClassifierScreen from './CloudClassifierScreen';
import Icon from 'react-native-vector-icons/Feather';
import { ScrollView } from 'react-native-gesture-handler';
import UserProfile from './UserProfile';

const Drawer = createDrawerNavigator();

const SCREEN_WIDTH = Dimensions.get('window').width;

const Navigation = () => {
    const [infoVisible, setInfoVisible] = useState(false);
    const [slideAnim] = useState(new Animated.Value(-1 * SCREEN_WIDTH));

    const openInfo = () => {
        setInfoVisible(true);
        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
        }).start();
    };

    const closeInfo = () => {
        Animated.timing(slideAnim, {
            toValue: -1 * SCREEN_WIDTH,
            duration: 300,
            useNativeDriver: false,
        }).start(() => setInfoVisible(false));
    };

    return (
        <>
            <NavigationContainer>
                <Drawer.Navigator
                    screenOptions={({ navigation }) => ({
                        headerLeft: () => (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 15 }}>
                                <Icon
                                    name="menu"
                                    size={28}
                                    color="#fff"
                                    onPress={() => navigation.toggleDrawer()}
                                />
                                <Text style={{ color: '#fff', fontSize: 18, marginLeft: 8 }} onPress={() => navigation.toggleDrawer()}>Menu</Text>
                            </View>
                        ),
                        headerRight: () => (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 15 }}>
                                <Text style={{ color: '#fff', fontSize: 18, marginRight: 8 }} onPress={openInfo}>Info</Text>
                                <Icon
                                    name="info"
                                    size={24}
                                    color="#fff"
                                    onPress={openInfo}
                                />
                            </View>
                        ),
                        headerStyle: { backgroundColor: '#1a1a2e' },
                        headerTintColor: '#fff'
                    })}
                >
                    <Drawer.Screen name="Home" component={HomeScreen} />
                    <Drawer.Screen name="Current Weather" component={WeatherScreen} />
                    <Drawer.Screen name="Rainfall Prediction" component={CloudClassifierScreen} />
                    <Drawer.Screen name="User Profile" component={UserProfile} />
                </Drawer.Navigator>
            </NavigationContainer>

            {/* Info Modal sliding from the right */}
            <Modal
                visible={infoVisible}
                transparent
                animationType="none"
                onRequestClose={closeInfo}
            >
                <View style={styles.modalOverlay}>
                    <Animated.View style={[styles.infoPanel, { right: slideAnim }]}>
                        <TouchableOpacity style={styles.closeButton} onPress={closeInfo}>
                            <Icon name="x" size={24} color="#fff" />
                        </TouchableOpacity>
                        <View style={{ flex: 1, justifyContent: 'space-between' }}>
                            {/* Top cluster */}
                            <ScrollView>
                                <Text style={styles.infoTitle}>Weather App Info</Text>
                                <Text style={[styles.infoText, { marginTop: 12 }]}>
                                    This app shows weather-related information! 🌦️ {'\n\n'}
                                    Google's Gemini API is used to generate weather images and facts and classify cloud types. {'\n\n'}
                                    OpenWeather's API is used to fetch real-time weather data and weather forecast. {'\n\n'}
                                    The app is built using React Native and Expo. {'\n\n'}
                                    The source code is available on GitHub. {'\n\n'}
                                    <Text style={{ color: '#00eaff' }} onPress={() => Linking.openURL('https://github.com/Aaron-Yuen/real-time-weather-app')}>Click here to view the source code</Text>
                                </Text>
                            </ScrollView>
                            {/* Bottom text */}
                            <Text style={[styles.infoText, { marginBottom: 12 }]}>
                                Developed by Aaron Lee & Aaron Yuen.
                            </Text>
                        </View>
                    </Animated.View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.2)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
    },
    infoPanel: {
        backgroundColor: '#222b45',
        width: 300,
        height: '100%',
        padding: 24,
        paddingTop: 48,
        borderTopLeftRadius: 24,
        borderBottomLeftRadius: 24,
        elevation: 10,
        position: 'absolute',
        top: 0,
        bottom: 0,
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        padding: 4,
        zIndex: 1
    },
    infoTitle: {
        fontSize: 20,
        color: '#00eaff',
        fontWeight: 'bold',
        marginBottom: 12,
        marginTop: 8
    },
    infoText: {
        fontSize: 16,
        color: '#fff',
        textAlign: 'left',
        alignContent: 'top',
    }
});

export default Navigation;