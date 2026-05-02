import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect } from 'react';
import { useAuthModal, useAuthStore, onboardingKey } from './store';


/**
 * This hook provides authentication functionality.
 * It may be easier to use the `useAuthModal` or `useRequireAuth` hooks
 * instead as those will also handle showing authentication to the user
 * directly.
 */
export const useAuth = () => {
  const { isReady, auth, setAuth, onboardingCompleted, setOnboardingCompleted } = useAuthStore();
  const { isOpen, close, open } = useAuthModal();

  const initiate = useCallback(() => {
    AsyncStorage.getItem(onboardingKey)
      .then((onboarding) => {
        useAuthStore.setState({
          auth: null,
          onboardingCompleted: onboarding === 'true',
          isReady: true,
        });
      })
      .catch((error) => {
        console.warn('Failed to retrieve onboarding state from AsyncStorage:', error);
        useAuthStore.setState({
          auth: null,
          onboardingCompleted: false,
          isReady: true,
        });
      });
  }, []);

  useEffect(() => {}, []);

  const signIn = useCallback(() => {
    open({ mode: 'signin' });
  }, [open]);
  const signUp = useCallback(() => {
    open({ mode: 'signup' });
  }, [open]);

  const signOut = useCallback(() => {
    setAuth(null);
    close();
  }, [close]);

  return {
    isReady,
    isAuthenticated: isReady ? !!auth : null,
    onboardingCompleted,
    signIn,
    signOut,
    signUp,
    auth,
    setAuth,
    setOnboardingCompleted,
    initiate,
  };
};

/**
 * This hook will automatically open the authentication modal if the user is not authenticated.
 */
export const useRequireAuth = (options) => {
  const { isAuthenticated, isReady } = useAuth();
  const { open } = useAuthModal();

  useEffect(() => {
    if (!isAuthenticated && isReady) {
      open({ mode: options?.mode });
    }
  }, [isAuthenticated, open, options?.mode, isReady]);
};

export default useAuth;