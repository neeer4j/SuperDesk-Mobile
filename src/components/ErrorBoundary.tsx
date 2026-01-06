/**
 * ErrorBoundary - Catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing the whole app.
 *
 * Usage:
 *   <ErrorBoundary fallback={<CustomErrorUI />}>
 *     <ComponentThatMightError />
 *   </ErrorBoundary>
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Logger } from '../utils/Logger';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        // Update state so the next render shows the fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log the error
        Logger.error('ErrorBoundary caught an error:', error);
        Logger.error('Error info:', errorInfo.componentStack);

        // Update state with error info
        this.setState({ errorInfo });

        // Call custom error handler if provided
        this.props.onError?.(error, errorInfo);
    }

    handleRetry = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Render custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <View style={styles.container}>
                    <View style={styles.content}>
                        <Text style={styles.emoji}>😔</Text>
                        <Text style={styles.title}>Oops! Something went wrong</Text>
                        <Text style={styles.message}>
                            We're sorry, but something unexpected happened.
                        </Text>

                        {__DEV__ && this.state.error && (
                            <ScrollView style={styles.errorContainer}>
                                <Text style={styles.errorTitle}>Error Details:</Text>
                                <Text style={styles.errorText}>
                                    {this.state.error.toString()}
                                </Text>
                                {this.state.errorInfo && (
                                    <Text style={styles.stackTrace}>
                                        {this.state.errorInfo.componentStack}
                                    </Text>
                                )}
                            </ScrollView>
                        )}

                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={this.handleRetry}
                            activeOpacity={0.8}>
                            <Text style={styles.retryButtonText}>Try Again</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        return this.props.children;
    }
}

/**
 * withErrorBoundary - HOC to wrap a component with an error boundary
 *
 * Usage:
 *   const SafeComponent = withErrorBoundary(MyComponent);
 */
export function withErrorBoundary<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    fallback?: ReactNode,
): React.FC<P> {
    const ComponentWithBoundary: React.FC<P> = props => (
        <ErrorBoundary fallback={fallback}>
            <WrappedComponent {...props} />
        </ErrorBoundary>
    );

    ComponentWithBoundary.displayName = `withErrorBoundary(${
        WrappedComponent.displayName || WrappedComponent.name || 'Component'
    })`;

    return ComponentWithBoundary;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0f',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    content: {
        alignItems: 'center',
        maxWidth: 400,
    },
    emoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: '#888888',
        textAlign: 'center',
        marginBottom: 24,
    },
    errorContainer: {
        maxHeight: 200,
        width: '100%',
        backgroundColor: '#1a1a1a',
        borderRadius: 8,
        padding: 12,
        marginBottom: 24,
    },
    errorTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ef4444',
        marginBottom: 8,
    },
    errorText: {
        fontSize: 12,
        color: '#ff6b6b',
        fontFamily: 'monospace',
    },
    stackTrace: {
        fontSize: 10,
        color: '#666666',
        fontFamily: 'monospace',
        marginTop: 8,
    },
    retryButton: {
        backgroundColor: '#8b5cf6',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 12,
    },
    retryButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default ErrorBoundary;
