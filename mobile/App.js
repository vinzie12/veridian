import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import HomeScreen from './screens/HomeScreen';
import CitizenHomeScreen from './screens/CitizenHomeScreen';
import QuickReportScreen from './screens/QuickReportScreen';
import ConfirmationScreen from './screens/ConfirmationScreen';
import TrackReportScreen from './screens/TrackReportScreen';
import IncidentDetailScreen from './screens/IncidentDetailScreen';
import SettingsScreen from './screens/SettingsScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CitizenHome" component={CitizenHomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="QuickReport" component={QuickReportScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Confirmation" component={ConfirmationScreen} options={{ headerShown: false }} />
        <Stack.Screen name="TrackReport" component={TrackReportScreen} options={{ headerShown: false }} />
        <Stack.Screen name="IncidentDetail" component={IncidentDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}