import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { HomeFonts } from '@/constants/homeFonts';
import StudyButton from '@/src/components/ui/StudyButton';

interface ErrorBoundaryProps {
  children: ReactNode;
  title?: string;
  resetKeys?: unknown[];
  onReset?: () => void;
  onExit?: () => void;
  exitLabel?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function ErrorFallback({
  error,
  title,
  onRetry,
  onExit,
  exitLabel,
}: {
  error: Error;
  title?: string;
  onRetry?: () => void;
  onExit?: () => void;
  exitLabel?: string;
}) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>
          {title ?? 'Something went wrong'}
        </Text>
        <Text style={styles.message}>
          {error.message || 'An unexpected error occurred.'}
        </Text>
        {__DEV__ && error.stack ? (
          <Text style={[styles.stack, { color: palette.subtext }]} selectable>
            {error.stack}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {onRetry ? (
            <StudyButton
              label="Try Again"
              variant="primary"
              size="medium"
              onPress={onRetry}
              style={styles.primaryBtn}
              textStyle={styles.primaryLabel}
            />
          ) : null}
          {onExit ? (
            <StudyButton
              label={exitLabel ?? 'Go Back'}
              variant="secondary"
              size="medium"
              onPress={onExit}
              style={styles.outlineBtn}
              textStyle={styles.outlineLabel}
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const { resetKeys } = this.props;
    if (
      this.state.error &&
      resetKeys !== undefined &&
      !arraysEqual(prevProps.resetKeys, resetKeys)
    ) {
      this.setState({ error: null });
    }
  }

  handleRetry = (): void => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <ErrorFallback
          error={error}
          title={this.props.title}
          onRetry={this.handleRetry}
          onExit={this.props.onExit}
          exitLabel={this.props.exitLabel}
        />
      );
    }
    return this.props.children;
  }
}

function arraysEqual(a?: unknown[], b?: unknown[]): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((val, i) => val === b[i]);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F5FD' },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 16,
  },
  title: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 22,
    color: '#F74856',
    textAlign: 'center',
  },
  message: {
    fontFamily: HomeFonts.jakartaRegular,
    fontWeight: 'normal',
    fontSize: 14,
    lineHeight: 18,
    color: 'rgba(0,0,0,0.6)',
    textAlign: 'center',
  },
  stack: {
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
    marginTop: 8,
  },
  actions: { gap: 12, marginTop: 16, alignItems: 'center' },
  primaryBtn: {
    height: 48,
    minWidth: 220,
    paddingVertical: 0,
    borderRadius: 12,
  },
  primaryLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
  },
  outlineBtn: {
    width: 220,
    height: 48,
    minWidth: 0,
    paddingVertical: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5E51A4',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  outlineLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#5E51A4',
  },
});
