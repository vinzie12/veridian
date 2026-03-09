import { View, Text, StyleSheet } from 'react-native';

export default function QuickReportScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Quick Report</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  text: { color: '#00ff88', fontSize: 24, fontWeight: 'bold' }
});
