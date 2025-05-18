import React, { useState } from 'react';
import { View, Text, Image, Button, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { constants } from './constants.json';

export default function CloudClassifierScreen() {
    const [image, setImage] = useState(null);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const pickImage = async () => {
        setResult(null);
        let permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            alert("Permission to access camera roll is required!");
            return;
        }
        let pickerResult = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
        });
        if (!pickerResult.cancelled) {
            setImage(pickerResult.uri);
        }
    };

    const takePhoto = async () => {
        setResult(null);
        let permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        if (permissionResult.granted === false) {
            alert("Permission to access camera is required!");
            return;
        }
        let pickerResult = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
        });
        if (!pickerResult.cancelled) {
            setImage(pickerResult.uri);
        }
    };

    const submitImage = async () => {
        if (!image) return;
        setLoading(true);
        let formData = new FormData();
        formData.append('file', {
            uri: image,
            name: 'photo.jpg',
            type: 'image/jpeg'
        });
        try {
            // Replace with your server's IP address
            let response = await fetch("http://" + constants.SERVER_IP + ":3001/predict", {
                method: 'POST',
                body: formData,
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            let json = await response.json();
            setResult(json);
        } catch (error) {
            alert('Prediction failed.');
        }
        setLoading(false);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Cloud Type Classifier</Text>
            <TouchableOpacity onPress={pickImage} style={styles.imageBox}>
                {image ? (
                    <Image source={{ uri: image }} style={styles.image} />
                ) : (
                    <Text style={styles.imagePlaceholder}>Tap to choose image</Text>
                )}
            </TouchableOpacity>
            <Button title="Take Photo" onPress={takePhoto} />
            <Button title="Submit" onPress={submitImage} disabled={!image || loading} />
            {loading && <ActivityIndicator size="large" color="#0000ff" />}
            {result && (
                <View style={styles.resultBox}>
                    <Text style={styles.resultText}>Prediction: {result.class}</Text>
                    <Text style={styles.resultText}>Rainfall Probability: {result.rainfall}</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
    imageBox: { width: 256, height: 256, borderWidth: 2, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    image: { width: 256, height: 256, resizeMode: 'cover' },
    imagePlaceholder: { color: '#aaa', textAlign: 'center' },
    resultBox: { marginTop: 20, alignItems: 'center' },
    resultText: { fontSize: 18, marginVertical: 2 },
});