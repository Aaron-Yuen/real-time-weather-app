import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, ScrollView } from 'react-native';
import constants from './constants.json';

const HomeScreen = () => {
	const [fact, setFact] = useState('');
	const [image, setImage] = useState("");
	const [imageError, setImageError] = useState(false);
	const [imageLoading, setImageLoading] = useState(true);

	useEffect(() => {
		const fetchGeminiFact = async () => {
			setImageLoading(true);
			setImageError(false);
			try {
				const textResponse = await fetch("http://" + constants.SERVER_IP + ":3001/get-fact");
                if (!textResponse.ok) {
                    throw new Error('Failed to fetch weather fact');
                }
                const textData = await textResponse.json();
				const geminiText = textData.fact || 'No fact found.';
				setFact(geminiText);

				const imageUrl = "http://" + constants.SERVER_IP + ":3001/generate-weather-image?text=" + encodeURIComponent(geminiText) + "&t=" + Date.now();
                setImage(imageUrl);
			}
			catch (error) {
                console.log(error);
				setFact('Failed to fetch weather fact.');
                setImage("");
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
			<Text style={styles.fact}>{fact}</Text>
			<View style={{ height: 16 }} />
            {imageLoading ? (<ActivityIndicator
                    color="#fff"
                    size="large"
                    style={{ marginVertical: 20 }}
            />) : null}
            <Image
                source={{ uri: image }}
                style={[styles.image, imageLoading && { opacity: 0 }, imageError && { display: 'none' }]}
                onLoadStart={() => {setImageLoading(true); setImageError(false);}}
                onLoadEnd={() => {setImageLoading(false);}}
                onError={() => {setImageError(true); setImageLoading(false);}}
            />
            {imageError ? (
                <Text style={styles.warning}>
                    Please check your internet connection{"\n"}(Or because of the location of the server and the rate limit of the Gemini API, the image may not be available at this time)
                </Text>
            ) : null}
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