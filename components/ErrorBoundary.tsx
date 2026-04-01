import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const msg = error instanceof Error ? error.message : String(error);
    return { hasError: true, errorMessage: msg };
  }

  componentDidCatch(error: unknown, info: unknown): void {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component info:', info);
  }

  handleRestart = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.root}>
          <View style={styles.card}>
            <Text style={styles.icon}>⚠️</Text>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.body}>
              {this.state.errorMessage || 'An unexpected error occurred. Please restart the screen.'}
            </Text>
            <TouchableOpacity style={styles.btn} onPress={this.handleRestart}>
              <Text style={styles.btnText}>Restart</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: '#000000',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
    padding: 28, alignItems: 'center', width: '100%',
  },
  icon: { fontSize: 44, marginBottom: 16 },
  title: {
    fontSize: 18, fontWeight: '700', color: '#FFFFFF',
    fontFamily: 'Inter_700Bold', marginBottom: 10, textAlign: 'center',
  },
  body: {
    fontSize: 13, color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20, marginBottom: 24,
  },
  btn: {
    backgroundColor: colors.teal, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 32,
  },
  btnText: { fontSize: 14, color: '#000000', fontFamily: 'Inter_800ExtraBold' },
});
