/**
 * Reusable UI Components
 * Standardized components for consistent UX
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// BUTTON COMPONENTS
// ============================================

/**
 * Primary Button
 */
export const Button = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary', // primary, secondary, danger, ghost
  size = 'medium', // small, medium, large
  icon = null,
  style = {},
}) => {
  const variantStyles = {
    primary: { bg: '#00ff88', text: '#0a0a0a' },
    secondary: { bg: '#1a1a1a', text: '#00ff88', border: '#00ff88' },
    danger: { bg: '#FF3333', text: '#fff' },
    ghost: { bg: 'transparent', text: '#00ff88' },
  };

  const sizeStyles = {
    small: { padding: 10, fontSize: 12 },
    medium: { padding: 16, fontSize: 14 },
    large: { padding: 20, fontSize: 18 },
  };

  const v = variantStyles[variant] || variantStyles.primary;
  const s = sizeStyles[size] || sizeStyles.medium;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: v.bg },
        v.border && { borderWidth: 2, borderColor: v.border },
        disabled && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <View style={styles.buttonContent}>
          {icon && <Text style={styles.buttonIcon}>{icon}</Text>}
          <Text style={[styles.buttonText, { color: v.text, fontSize: s.fontSize }]}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

/**
 * Icon Button
 */
export const IconButton = ({
  icon,
  onPress,
  size = 40,
  backgroundColor = '#1a1a1a',
  color = '#00ff88',
  style = {},
}) => (
  <TouchableOpacity
    style={[
      styles.iconButton,
      { width: size, height: size, backgroundColor },
      style,
    ]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[styles.iconButtonText, { fontSize: size * 0.5 }]}>{icon}</Text>
  </TouchableOpacity>
);

// ============================================
// LOADING COMPONENTS
// ============================================

/**
 * Loading Spinner
 */
export const LoadingSpinner = ({
  size = 'large',
  color = '#00ff88',
  message = null,
  style = {},
}) => (
  <View style={[styles.loadingContainer, style]}>
    <ActivityIndicator size={size} color={color} />
    {message && <Text style={styles.loadingText}>{message}</Text>}
  </View>
);

/**
 * Full Screen Loading
 */
export const FullScreenLoading = ({ message = 'Loading...' }) => (
  <View style={styles.fullScreenLoading}>
    <ActivityIndicator size="large" color="#00ff88" />
    <Text style={styles.fullScreenLoadingText}>{message}</Text>
  </View>
);

// ============================================
// ERROR COMPONENTS
// ============================================

/**
 * Error Display
 */
export const ErrorDisplay = ({
  message,
  onRetry = null,
  retryText = 'Try Again',
  style = {},
}) => (
  <View style={[styles.errorContainer, style]}>
    <Text style={styles.errorIcon}>⚠️</Text>
    <Text style={styles.errorMessage}>{message}</Text>
    {onRetry && (
      <Button
        title={retryText}
        onPress={onRetry}
        variant="secondary"
        size="small"
      />
    )}
  </View>
);

/**
 * Network Error
 */
export const NetworkError = ({ onRetry }) => (
  <ErrorDisplay
    message="Network error. Please check your connection."
    onRetry={onRetry}
  />
);

// ============================================
// EMPTY STATE COMPONENTS
// ============================================

/**
 * Empty State
 */
export const EmptyState = ({
  icon = '📭',
  title = 'No Data',
  message = '',
  action = null,
  style = {},
}) => (
  <View style={[styles.emptyContainer, style]}>
    <Text style={styles.emptyIcon}>{icon}</Text>
    <Text style={styles.emptyTitle}>{title}</Text>
    {message && <Text style={styles.emptyMessage}>{message}</Text>}
    {action && (
      <Button
        title={action.label}
        onPress={action.onPress}
        variant="secondary"
      />
    )}
  </View>
);

// ============================================
// CARD COMPONENTS
// ============================================

/**
 * Card Container
 */
export const Card = ({
  children,
  style = {},
  onPress = null,
  padding = 16,
}) => {
  const cardStyle = [
    styles.card,
    { padding },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.8}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

/**
 * Badge
 */
export const Badge = ({
  label,
  color = '#00ff88',
  textColor = '#0a0a0a',
  size = 'medium',
}) => {
  const sizeStyles = {
    small: { padding: 4, fontSize: 8 },
    medium: { padding: 6, fontSize: 10 },
    large: { padding: 8, fontSize: 12 },
  };

  const s = sizeStyles[size] || sizeStyles.medium;

  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={[styles.badgeText, { color: textColor, fontSize: s.fontSize }]}>
        {label}
      </Text>
    </View>
  );
};

// ============================================
// INPUT COMPONENTS
// ============================================

/**
 * Input Field
 */
export const Input = ({
  label,
  value,
  onChangeText,
  placeholder = '',
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  error = null,
  required = false,
  multiline = false,
  numberOfLines = 1,
  maxLength = null,
  style = {},
}) => (
  <View style={[styles.inputContainer, style]}>
    {label && (
      <Text style={styles.inputLabel}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
    )}
    <TextInput
      style={[
        styles.input,
        multiline && styles.textArea,
        error && styles.inputError,
      ]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#444"
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      multiline={multiline}
      numberOfLines={numberOfLines}
      maxLength={maxLength}
    />
    {error && <Text style={styles.inputErrorText}>{error}</Text>}
  </View>
);

// ============================================
// MODAL COMPONENTS
// ============================================

/**
 * Modal Container
 */
export const ModalContainer = ({
  visible,
  onClose,
  title,
  children,
  showClose = true,
}) => (
  <Modal
    visible={visible}
    animationType="slide"
    transparent
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <SafeAreaView style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          {showClose && (
            <IconButton icon="✕" onPress={onClose} size={32} backgroundColor="transparent" color="#666" />
          )}
        </View>
        <ScrollView style={styles.modalBody}>
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  </Modal>
);

// ============================================
// HEADER COMPONENTS
// ============================================

/**
 * Screen Header
 */
export const ScreenHeader = ({
  title,
  subtitle,
  leftAction = null,
  rightAction = null,
  style = {},
}) => (
  <View style={[styles.header, style]}>
    <View style={styles.headerLeft}>
      {leftAction}
    </View>
    <View style={styles.headerCenter}>
      <Text style={styles.headerTitle}>{title}</Text>
      {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
    </View>
    <View style={styles.headerRight}>
      {rightAction}
    </View>
  </View>
);

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  // Button
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  iconButton: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: {
    textAlign: 'center',
  },

  // Loading
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#666',
    marginTop: 12,
    fontSize: 14,
  },
  fullScreenLoading: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenLoadingText: {
    color: '#00ff88',
    marginTop: 16,
    fontSize: 16,
  },

  // Error
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorMessage: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyMessage: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },

  // Card
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  // Input
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
  },
  required: {
    color: '#FF3333',
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#FF3333',
  },
  inputErrorText: {
    color: '#FF3333',
    fontSize: 12,
    marginTop: 4,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerLeft: {
    width: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 40,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
});

// Need to import TextInput
import { TextInput } from 'react-native';

export default {
  Button,
  IconButton,
  LoadingSpinner,
  FullScreenLoading,
  ErrorDisplay,
  NetworkError,
  EmptyState,
  Card,
  Badge,
  Input,
  ModalContainer,
  ScreenHeader,
};
