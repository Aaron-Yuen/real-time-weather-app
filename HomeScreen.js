import { GoogleGenAI } from '@google/genai';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, ScrollView } from 'react-native';
import { constants } from './constants.json';

const HomeScreen = () => {
	const [fact, setFact] = useState('');
	const [image, setImage] = useState(null);
	const [imageVisible, setImageVisible] = useState(true);
	const [imageError, setImageError] = useState(false);
	const [imageLoading, setImageLoading] = useState(true);
	const [textLoading, setTextLoading] = useState(true);

	const AI = new GoogleGenAI({ apiKey: constants.GEMINI_API_KEY });

	useEffect(() => {
		const fetchGeminiFact = async () => {
			setTextLoading(true);
			setImageLoading(true);
			try {
				const textResponse = await AI.models.generateContent({
					model: "gemini-2.0-flash",
					contents: "Give me a short interesting fact or knowledge about weather.",
				});
				const geminiText =
					textResponse?.candidates?.[0]?.content?.parts?.[0]?.text || 'No fact found.';
				setFact(geminiText);

				const imageRes = await fetch("http://" + constants.SERVER_IP + ":3001/generate-weather-image", {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: geminiText }),
                });
				const { imageBase64 } = await imageRes.json();
                setImage(`data:image/png;base64,${imageBase64}`);
				setTextLoading(false);
				setImageLoading(false);
			}
			catch (error) {
				setFact('Failed to fetch weather knowledge.');
				setTextLoading(false);
				setImageVisible(false);
				setImageLoading(false);
				setImageError(true);
			}
		};

		fetchGeminiFact();
	}, []);

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
			<Text style={styles.title}>Welcome to the Weather App!</Text>
			<View style={{ height: 16 }} />
			<Text style={styles.sectionTitle}>Did You Know? Weather Edition</Text>
			{textLoading ? (<ActivityIndicator color="#fff" />) : (<Text style={styles.fact}>{fact}</Text>)}
			{(imageLoading || imageVisible) ? (
				<ActivityIndicator color="#fff" />
			) : (
				<Image source={{ uri: image }} style={[styles.image, !imageVisible && { display: 'none' }]} />
			)}
			{imageError ? (<Text style={styles.warning}>Please check your internet connection</Text>) : null}
		</ScrollView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#1a1a2e',
		padding: 16
	},
	contentContainer: {
		alignItems: 'center',
		justifyContent: 'flex-start'
	},
	title: {
		fontSize: 24,
		color: '#fff',
		marginBottom: 10
	},
	subtitle: {
		fontSize: 16,
		color: '#fff',
		marginBottom: 20
	},
	sectionTitle: {
		fontSize: 20,
		color: '#00eaff',
		marginBottom: 8,
		fontWeight: 'bold',
	},
	fact: {
		fontSize: 18,
		color: '#fff',
		textAlign: 'center'
	},
	warning:{
		fontSize: 18,
		color: '#ff0000',
		textAlign: 'center',
		marginTop: 20
	},
	image: {
		width: 200,
		height: 200,
		borderWidth: 4,
		borderColor: '#cccccc',
		borderRadius: 12,
		marginTop: 20
	}
});

export default HomeScreen;