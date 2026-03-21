import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  SafeAreaView, ActivityIndicator, Alert, ScrollView, Dimensions
} from 'react-native';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';

import { useAuth } from '../src/context/AuthContext';
import { incidentService, configService } from '../src/services/apiClient';
import { styles } from './styles/QuickReportScreenStyles';

const { width } = Dimensions.get('window');

const SEVERITIES = [
  { level: 'critical', label: 'Critical', color: '#FF0000', desc: 'Life threatening' },
  { level: 'high', label: 'High', color: '#FF6600', desc: 'Urgent response' },
  { level: 'medium', label: 'Medium', color: '#FFAA00', desc: 'Prompt attention' },
  { level: 'low', label: 'Low', color: '#00CC44', desc: 'Non-urgent' }
];

export default function QuickReportScreen({ navigation }) {
  const { user, isLoggedIn } = useAuth();
  const [incidentTypes, setIncidentTypes] = useState([]);
  const [incidentType, setIncidentType] = useState(null);
  const [severity, setSeverity] = useState(null);
  const [description, setDescription] = useState('');
  const [reporterContact, setReporterContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationReady, setLocationReady] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [showAllTypes, setShowAllTypes] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  
  // Map and location state
  const [userLocation, setUserLocation] = useState(null);
  const [incidentLocation, setIncidentLocation] = useState(null);
  const [incidentAddress, setIncidentAddress] = useState('');
  const webViewRef = useRef(null);

  const isAnonymous = !isLoggedIn;

  // Get displayed incident types (first 3 or all)
  const displayedTypes = showAllTypes ? incidentTypes : (incidentTypes || []).slice(0, 3);
  const hasMoreTypes = (incidentTypes || []).length > 3;

  // Fetch incident types from API
  useEffect(() => {
    const fetchIncidentTypes = async () => {
      try {
        const response = await incidentService.getTypes();
        // Handle different response structures
        let types = [];
        if (Array.isArray(response)) {
          types = response;
        } else if (Array.isArray(response?.data)) {
          types = response.data;
        } else if (Array.isArray(response?.data?.incidentTypes)) {
          types = response.data.incidentTypes;
        } else if (response?.success && Array.isArray(response.data)) {
          types = response.data;
        }
        setIncidentTypes(types);
      } catch (error) {
        console.log('Error fetching incident types:', error);
        // Fallback to basic types if API fails
        setIncidentTypes([
          { id: '1', name: 'fire', icon: '🔥', color_code: '#FF3300' },
          { id: '2', name: 'medical', icon: '🏥', color_code: '#0066FF' },
          { id: '3', name: 'police', icon: '🚨', color_code: '#0044CC' }
        ]);
      } finally {
        setLoadingTypes(false);
      }
    };
    fetchIncidentTypes();
  }, []);

  // Get user's current location on mount
  useEffect(() => {
    const getUserLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setHasLocationPermission(true);
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          const { latitude, longitude } = location.coords;
          
          setUserLocation({ latitude, longitude });
          // Set initial incident location to user's location
          setIncidentLocation({ latitude, longitude });
          
          // Get initial address
          const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (geocode.length > 0) {
            const g = geocode[0];
            const addr = `${g.street || ''} ${g.city || ''} ${g.region || ''}`.trim();
            setIncidentAddress(addr);
          }
        } else {
          // Permission denied - use fallback location
          console.log('Location permission denied, using fallback');
          setHasLocationPermission(false);
          setUserLocation({ latitude: 14.5995, longitude: 120.9842 });
          setIncidentLocation({ latitude: 14.5995, longitude: 120.9842 });
          
          // Get address for fallback location using Nominatim
          try {
            const response = await axios.get(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=14.5995&lon=120.9842&zoom=18&addressdetails=1`,
              { headers: { 'User-Agent': 'VeridianApp/1.0' } }
            );
            if (response.data && response.data.display_name) {
              const addr = response.data.address || {};
              const street = addr.road || addr.street || '';
              const city = addr.city || addr.town || addr.village || '';
              const region = addr.state || addr.county || '';
              const simplifiedAddr = [street, city, region].filter(Boolean).join(', ') || 'Manila, Philippines';
              setIncidentAddress(simplifiedAddr);
            }
          } catch (err) {
            setIncidentAddress('Manila, Philippines');
          }
        }
        setLocationReady(true);
      } catch (err) {
        console.log('Initial location error:', err);
        // Default to a location if GPS fails
        setUserLocation({ latitude: 14.5995, longitude: 120.9842 });
        setIncidentLocation({ latitude: 14.5995, longitude: 120.9842 });
        setLocationReady(true);
      }
    };
    getUserLocation();
  }, []);

  // Handle incident pin drag
  const handlePinDrag = async (coordinate) => {
    const { latitude, longitude } = coordinate;
    setIncidentLocation({ latitude, longitude });
    
    // Use OpenStreetMap Nominatim for reverse geocoding (free, no auth required)
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        { headers: { 'User-Agent': 'VeridianApp/1.0' } }
      );
      
      if (response.data && response.data.display_name) {
        // Simplify the address - just use the main parts
        const addr = response.data.address || {};
        const street = addr.road || addr.street || '';
        const city = addr.city || addr.town || addr.village || addr.municipality || '';
        const region = addr.state || addr.county || '';
        
        const simplifiedAddr = [street, city, region].filter(Boolean).join(', ') || response.data.display_name.split(',').slice(0, 3).join(',');
        setIncidentAddress(simplifiedAddr);
      }
    } catch (err) {
      console.log('Reverse geocode error:', err);
      setIncidentAddress('Location set on map');
    }
  };

  // Generate Leaflet map HTML
  const getLeafletMapHTML = () => {
    const centerLat = incidentLocation?.latitude || userLocation?.latitude || 14.5995;
    const centerLon = incidentLocation?.longitude || userLocation?.longitude || 120.9842;
    const userLat = userLocation?.latitude || centerLat;
    const userLon = userLocation?.longitude || centerLon;
    const incidentLat = incidentLocation?.latitude || centerLat;
    const incidentLon = incidentLocation?.longitude || centerLon;
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { 
      width: 100%; 
      height: 100%; 
      touch-action: pan-x pan-y pinch-zoom;
      overscroll-behavior: none;
    }
    .leaflet-container { 
      touch-action: pan-x pan-y pinch-zoom;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
    }
    .incident-marker { 
      background: #FF0000; 
      border: 3px solid #fff; 
      border-radius: 50% 50% 50% 0; 
      width: 30px; 
      height: 30px; 
      transform: rotate(-45deg);
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    }
    .user-marker {
      background: #0066FF;
      border: 3px solid #fff;
      border-radius: 50%;
      width: 16px;
      height: 16px;
      box-shadow: 0 0 10px rgba(0,102,255,0.5);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
      touchZoom: true,
      pinchZoom: true,
      doubleClickZoom: true,
      scrollWheelZoom: 'center',
      dragging: true,
      tap: true,
      bounceAtZoomLimits: false
    }).setView([${centerLat}, ${centerLon}], 16);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }).addTo(map);
    
    // User location marker (blue circle)
    var userIcon = L.divIcon({
      className: 'user-marker',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    var userMarker = L.marker([${userLat}, ${userLon}], { icon: userIcon, interactive: false }).addTo(map);
    
    // Incident marker (red pin, draggable)
    var incidentIcon = L.divIcon({
      className: 'incident-marker',
      iconSize: [30, 30],
      iconAnchor: [15, 30]
    });
    var incidentMarker = L.marker([${incidentLat}, ${incidentLon}], { 
      icon: incidentIcon, 
      draggable: true 
    }).addTo(map);
    
    // Send location to React Native on drag
    incidentMarker.on('dragend', function(e) {
      var pos = e.target.getLatLng();
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'locationUpdate',
        latitude: pos.lat,
        longitude: pos.lng
      }));
    });
    
    // Also allow tap on map to set location
    map.on('click', function(e) {
      incidentMarker.setLatLng(e.latlng);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'locationUpdate',
        latitude: e.latlng.lat,
        longitude: e.latlng.lng
      }));
    });
  </script>
</body>
</html>
    `;
  };

  // Handle messages from WebView
  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'locationUpdate') {
        handlePinDrag({ latitude: data.latitude, longitude: data.longitude });
      }
    } catch (err) {
      console.log('WebView message error:', err);
    }
  };

  const handleSubmit = async () => {
    if (!incidentType || !severity) {
      Alert.alert('Required Fields', 'Please select incident type and severity level.');
      return;
    }

    if (!incidentLocation) {
      Alert.alert('Location Required', 'Please set the incident location on the map.');
      return;
    }

    setSubmitting(true);

    try {
      const basePayload = {
        incident_type_id: incidentType,
        severity,
        latitude: incidentLocation.latitude,
        longitude: incidentLocation.longitude,
        address: incidentAddress || null,
        description: description || null,
        ...(isAnonymous && { reporter_contact: reporterContact || null })
      };

      console.log('[QuickReport] Submitting incident:', {
        isAnonymous,
        isLoggedIn,
        userId: user?.id?.slice(0, 8),
        userRole: user?.role
      });

      let response;
      if (isAnonymous) {
        // For anonymous reports, don't send reporter info
        response = await incidentService.createPublic({
          ...basePayload,
          anonymous: true
        });
      } else {
        // For authenticated users, include reporter info
        response = await incidentService.create({
          ...basePayload,
          reporter_id: user?.id,
          reporter_name: user?.full_name,
          anonymous: false
        });
      }

      const incident = response?.data?.incident || response?.incident || response?.data;
      const trackingId = response?.data?.tracking_id || response?.tracking_id;
      
      // Find the selected incident type for display
      const selectedType = incidentTypes.find(t => t.id === incidentType);
      
      // Show tracking ID for anonymous users AND citizens
      const showTrackingId = isAnonymous || user?.role === 'citizen';
      
      navigation.replace('Confirmation', {
        incident: {
          id: incident?.id?.slice(0, 8).toUpperCase() || 'NEW',
          typeId: incidentType,
          typeName: selectedType?.name || 'Unknown',
          typeIcon: selectedType?.icon || '⚠️',
          severity,
          address: incidentAddress || 'Location set on map',
          time: new Date().toLocaleTimeString(),
          trackingId: showTrackingId ? trackingId : null
        },
        isAnonymous
      });
    } catch (error) {
      console.log('Submit error:', error);
      const message = error?.message || 'Failed to submit incident. Please try again.';
      Alert.alert('Submission Failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSeverity = SEVERITIES.find(s => s.level === severity);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Quick Report</Text>
            <View style={styles.headerSpacer} />
          </View>
          <Text style={styles.headerSubtitle}>
            Report an emergency incident quickly
          </Text>
        </View>

        {/* Emergency Banner */}
        {isAnonymous && (
          <View style={styles.emergencyBanner}>
            <Text style={styles.emergencyIcon}>⚠️</Text>
            <Text style={styles.emergencyText}>
              You're reporting as an anonymous citizen. Add contact info for updates, or leave blank to remain unidentified.
            </Text>
          </View>
        )}

        {/* Incident Type Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Incident Type</Text>
            <View style={styles.requiredBadge}>
              <Text style={styles.requiredText}>REQUIRED</Text>
            </View>
          </View>
          
          {loadingTypes ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#00ff88" />
              <Text style={styles.loadingText}>Loading incident types...</Text>
            </View>
          ) : (
            <>
              <View style={styles.typeGridContainer}>
                {displayedTypes.map((item) => {
                  const isSelected = incidentType === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.typeCard,
                        isSelected && styles.typeCardSelected
                      ]}
                      onPress={() => setIncidentType(item.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.typeIcon}>{item.icon}</Text>
                      <Text style={[
                        styles.typeLabel,
                        isSelected && styles.typeLabelSelected
                      ]}>
                        {item.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              
              {/* Show More/Less Button */}
              {hasMoreTypes && (
                <TouchableOpacity
                  style={styles.showMoreBtn}
                  onPress={() => setShowAllTypes(!showAllTypes)}
                >
                  <Text style={styles.showMoreText}>
                    {showAllTypes ? '▲ Show Less' : `▼ Show More (${incidentTypes.length - 3} more)`}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Severity Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Severity Level</Text>
            <View style={styles.requiredBadge}>
              <Text style={styles.requiredText}>REQUIRED</Text>
            </View>
          </View>
          
          <View style={styles.severityContainer}>
            {SEVERITIES.map((item) => {
              const isSelected = severity === item.level;
              return (
                <TouchableOpacity
                  key={item.level}
                  style={[
                    styles.severityPill,
                    isSelected && styles.severityPillSelected
                  ]}
                  onPress={() => setSeverity(item.level)}
                  activeOpacity={0.8}
                >
                  <View 
                    style={[
                      styles.severityIndicator,
                      { backgroundColor: item.color }
                    ]} 
                  />
                  <Text style={[
                    styles.severityLabel,
                    isSelected && styles.severityLabelSelected
                  ]}>
                    {item.label}
                  </Text>
                  <Text style={styles.severityDesc}>{item.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Description Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.contactOptional}>Optional</Text>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Details</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe what's happening..."
              placeholderTextColor="#444"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={styles.characterCount}>{description.length}/500</Text>
          </View>
        </View>

        {/* Contact Section (Anonymous only) */}
        {isAnonymous && (
          <View style={styles.section}>
            <View style={styles.contactCard}>
              <View style={styles.contactHeader}>
                <Text style={styles.contactIcon}>📱</Text>
                <Text style={styles.contactTitle}>Your Contact</Text>
                <Text style={styles.contactOptional}>Optional</Text>
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Email or phone number"
                  placeholderTextColor="#444"
                  value={reporterContact}
                  onChangeText={setReporterContact}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>
            </View>
          </View>
        )}

        {/* Location Map Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Incident Location</Text>
            <Text style={styles.contactOptional}>Tap or drag pin to adjust</Text>
          </View>
          
          {userLocation ? (
            <>
              {/* Interactive Leaflet Map in WebView */}
              <View style={styles.mapContainer} nestedScrollEnabled={true}>
                <WebView
                  ref={webViewRef}
                  source={{ html: getLeafletMapHTML() }}
                  style={styles.map}
                  onMessage={handleWebViewMessage}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  scrollEnabled={true}
                  nestedScrollEnabled={true}
                  bounces={false}
                  showsVerticalScrollIndicator={false}
                  showsHorizontalScrollIndicator={false}
                  allowsInlineMediaPlayback={true}
                  mediaPlaybackRequiresUserAction={false}
                  scalesPageToFit={false}
                  mixedContentMode="compatibility"
                  originWhitelist={['*']}
                />
              </View>
              
              {/* Address Display */}
              <View style={styles.addressCard}>
                <Text style={styles.addressIcon}>📍</Text>
                <View style={styles.addressInfo}>
                  <Text style={styles.addressLabel}>INCIDENT ADDRESS</Text>
                  <Text style={styles.addressValue}>
                    {incidentAddress || 'Tap map to set location'}
                  </Text>
                </View>
              </View>
              
              {/* Location Legend */}
              <View style={styles.locationLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#0066FF' }]} />
                  <Text style={styles.legendText}>Your Location</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#FF0000' }]} />
                  <Text style={styles.legendText}>Incident Location</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#00ff88" />
              <Text style={styles.loadingText}>Getting your location...</Text>
            </View>
          )}
        </View>

        {/* Submit Button */}
        <View style={styles.submitContainer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!incidentType || !severity) && styles.submitButtonDisabled,
              submitting && styles.submitButtonSubmitting
            ]}
            onPress={handleSubmit}
            disabled={submitting || !incidentType || !severity}
            activeOpacity={0.9}
          >
            {submitting ? (
              <View style={styles.submittingRow}>
                <ActivityIndicator color={gettingLocation ? '#FF6600' : '#00ff88'} />
                <Text style={[styles.submitText, styles.submitTextLight]}>
                  {gettingLocation ? '  Getting GPS...' : '  Submitting...'}
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.submitIcon}>⚡</Text>
                <Text style={[
                  styles.submitText,
                  (!incidentType || !severity) && styles.submitTextDisabled
                ]}>
                  SUBMIT INCIDENT
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}